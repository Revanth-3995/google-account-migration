import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Play, Pause, XCircle, RefreshCw, Key, Folder, FileVideo, Image as ImageIcon } from 'lucide-react';

export function Jobs() {
  const { jobs, refreshJobs, activeJobId, setActiveJobId, promptLogin, isAuthenticating } = useApp();
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const loadJobDetails = async (id) => {
    try {
      const data = await api.getJobDetails(id);
      setSelectedJobDetails(data);
    } catch (e) {
      console.error('Error loading job details:', e);
    }
  };

  useEffect(() => {
    if (activeJobId) {
      loadJobDetails(activeJobId);
    } else if (jobs.length > 0) {
      loadJobDetails(jobs[0].id);
    }
  }, [activeJobId, jobs]);

  const handleStart = async (id) => {
    await api.startJob(id);
    refreshJobs();
    loadJobDetails(id);
  };

  const handleRetry = async (id) => {
    await api.retryJob(id);
    refreshJobs();
    loadJobDetails(id);
  };

  const handleReauthAndRetry = async (id) => {
    // Re-authenticate Account B first
    const ok = await promptLogin('destination');
    if (ok) {
      await api.retryJob(id);
      refreshJobs();
      loadJobDetails(id);
    }
  };

  const handlePause = async (id) => {
    await api.pauseJob(id);
    refreshJobs();
    loadJobDetails(id);
  };

  const handleRecovery = async (jobId) => {
    setIsRecovering(true);
    try {
      const session = await api.createPhotosSession();
      if (!session || !session.pickerUri) {
        throw new Error('Failed to create recovery picker session');
      }
      window.open(session.pickerUri, '_blank', 'width=800,height=700');
      
      alert('Please select the unfinished items in the popup. Click OK ONLY after you have finished selecting.');
      
      let status;
      let maxPolls = 15;
      while (maxPolls > 0) {
        status = await api.getPhotosSession(session.id);
        if (status.mediaItemsSet) break;
        await new Promise(r => setTimeout(r, 4000));
        maxPolls--;
      }
      
      if (!status.mediaItemsSet) {
        throw new Error('Timed out waiting for selection.');
      }
      
      const itemsRes = await api.getPhotosMediaItems(session.id);
      if (itemsRes && itemsRes.mediaItems && itemsRes.mediaItems.length > 0) {
        const result = await api.resumeRecoveryPhotos(jobId, itemsRes.mediaItems);
        const msg = 'Recovery Report:\n' + '  - Safely matched: ' + result.matched + '\n' + '  - Already completed: ' + result.alreadyVerified + '\n' + '  - Not matched: ' + result.unmatched + '\n' + '  - Ambiguous collisions: ' + result.ambiguous + '\n' + '  - Still missing/required: ' + result.requiredRemaining + '\n\n';

        if (result.canResume) {
          alert(msg + 'All required items safely matched! Job resumed.');
          refreshJobs();
          loadJobDetails(jobId);
        } else {
          alert(msg + 'Job CANNOT resume yet. You must resolve ambiguities or select all missing required items.');
          loadJobDetails(jobId);
        }
      } else {
        alert('No items were selected.');
      }
    } catch (e) {
      alert('Recovery failed: ' + e.message);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCancel = async (id) => {
    if (confirm('Cancel this migration job?')) {
      await api.cancelJob(id);
      refreshJobs();
      loadJobDetails(id);
    }
  };

  const hasAuthError = selectedJobDetails && (selectedJobDetails.job.status === 'AUTH_REQUIRED' || selectedJobDetails.items.some(it => it.status === 'AUTH_REQUIRED'));

  const hasRecoveryError = selectedJobDetails && (selectedJobDetails.job.status === 'RECOVERY_REQUIRED' || selectedJobDetails.items.some(it => it.status === 'SOURCE_ACCESS_EXPIRED'));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Job Execution Monitor</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Real-time telemetry, concurrency queue management, and per-item inspection.
        </p>
      </div>

      {hasRecoveryError && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>Source Media Access Expired</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Access to some unfinished selected media has expired. Completed items are safe. Renew source selection/access to continue remaining items.
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ backgroundColor: '#f59e0b', color: '#1a1a1a' }}
            onClick={() => handleRecovery(selectedJobDetails.job.id)} disabled={isRecovering}
          >
            <RefreshCw size={14} className={isRecovering ? 'animate-spin' : ''} /> {isRecovering ? 'Waiting for Selection...' : 'Renew Source Access'}
          </button>
        </div>
      )}

      {hasAuthError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#ef4444' }}>Destination Account B Token Expired</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Account B's 1-hour token expired during upload. Click to re-authenticate Account B and automatically resume!
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ backgroundColor: '#10b981' }}
            onClick={() => handleReauthAndRetry(selectedJobDetails.job.id)}
            disabled={isAuthenticating}
          >
            <Key size={14} /> Refresh Accounts & Resume Job
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* Left: Job List */}
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, padding: '0 4px' }}>
            Migration Jobs ({jobs.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
            {jobs.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', padding: 12 }}>No jobs yet</div>
            ) : (
              jobs.map((j) => {
                const isSelected = selectedJobDetails && selectedJobDetails.job.id === j.id;
                return (
                  <div
                    key={j.id}
                    onClick={() => {
                      setActiveJobId(j.id);
                      loadJobDetails(j.id);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-input)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{j.id}</span>
                      <Badge type={j.service_type} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {j.completed_items} / {j.total_items} items
                      </span>
                      <Badge type={j.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Job Details */}
        {selectedJobDetails ? (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedJobDetails.job.id}</span>
                    <Badge type={selectedJobDetails.job.service_type} />
                    <Badge type={selectedJobDetails.job.status} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {selectedJobDetails.job.source_email} &rarr; {selectedJobDetails.job.dest_email}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedJobDetails.job.failed_items > 0 && selectedJobDetails.job.status !== 'RUNNING' && (
                    <button className="btn btn-primary" style={{ backgroundColor: '#f59e0b' }} onClick={() => handleRetry(selectedJobDetails.job.id)}>
                      <RefreshCw size={14} /> Retry {selectedJobDetails.job.failed_items} Failed Items
                    </button>
                  )}

                  {selectedJobDetails.job.status === 'RUNNING' ? (
                    <button className="btn btn-secondary" onClick={() => handlePause(selectedJobDetails.job.id)}>
                      <Pause size={14} /> Pause
                    </button>
                  ) : selectedJobDetails.job.status === 'PAUSED' || selectedJobDetails.job.status === 'READY' ? (
                    <button className="btn btn-primary" onClick={() => handleStart(selectedJobDetails.job.id)}>
                      <Play size={14} /> Resume / Start
                    </button>
                  ) : null}

                  {selectedJobDetails.job.status !== 'COMPLETED' && selectedJobDetails.job.status !== 'CANCELLED' && (
                    <button className="btn btn-danger" onClick={() => handleCancel(selectedJobDetails.job.id)}>
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                  <span>Migration Progress</span>
                  <span style={{ fontWeight: 600 }}>
                    {selectedJobDetails.job.total_items > 0
                      ? Math.round((selectedJobDetails.job.completed_items / selectedJobDetails.job.total_items) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill success"
                    style={{
                      width: `${selectedJobDetails.job.total_items > 0 ? (selectedJobDetails.job.completed_items / selectedJobDetails.job.total_items) * 100 : 0}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Item Manifest Table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Item Manifest ({selectedJobDetails.items.length})</div>
              </div>

              <div className="table-container" style={{ maxHeight: 350, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Item Name</th>
                      <th>Path</th>
                      <th>Status</th>
                      <th>Destination ID / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJobDetails.items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ fontSize: '0.8rem' }}>{it.item_type === 'FOLDER' ? <Folder size={14} /> : (it.item_type === 'VIDEO' ? <FileVideo size={14} /> : <ImageIcon size={14} />)}</td>
                        <td style={{ fontWeight: 500, fontSize: '0.8rem' }}>{it.source_name}</td>
                        <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{it.parent_path}</td>
                        <td><Badge type={it.status} /></td>
                        <td className="mono" style={{ fontSize: '0.75rem', color: it.status === 'FAILED' ? '#ef4444' : '#10b981' }}>
                          {it.error_message ? it.error_message : (it.dest_item_id || 'Pending')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div style={{ color: 'var(--text-muted)' }}>Select a job from the list to inspect.</div>
          </div>
        )}
      </div>
    </div>
  );
}






