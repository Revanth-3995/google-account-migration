import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { PageHeader, SectionHeader, ProgressBar, EmptyState, ConfirmDialog, StatusBadge } from '../components/ui';
import { Play, Pause, XCircle, RefreshCw, Key, Folder, FileVideo, Image as ImageIcon, ShieldAlert, Clock3 } from 'lucide-react';

export function Jobs() {
  const { jobs, refreshJobs, activeJobId, setActiveJobId, promptLogin, isAuthenticating } = useApp();
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const loadJobDetails = async (id) => {
    try {
      const data = await api.getJobDetails(id);
      setSelectedJobDetails(data);
    } catch (e) {
      console.error('Error loading job details:', e);
    }
  };

  useEffect(() => {
    if (activeJobId) loadJobDetails(activeJobId);
    else if (jobs.length > 0) loadJobDetails(jobs[0].id);
    else setSelectedJobDetails(null);
  }, [activeJobId, jobs]);

  const handleStart = async (id) => { await api.startJob(id); refreshJobs(); loadJobDetails(id); };
  const handleRetry = async (id) => { await api.retryJob(id); refreshJobs(); loadJobDetails(id); };
  const handlePause = async (id) => { await api.pauseJob(id); refreshJobs(); loadJobDetails(id); };
  const handleCancel = async (id) => { await api.cancelJob(id); refreshJobs(); loadJobDetails(id); setConfirmCancel(null); };
  const handleReauthAndRetry = async (id) => { const ok = await promptLogin('destination'); if (ok) { await api.retryJob(id); refreshJobs(); loadJobDetails(id); } };

  const handleRecovery = async (jobId) => {
    setIsRecovering(true);
    try {
      const session = await api.createPhotosSession();
      if (!session || !session.pickerUri) throw new Error('Failed to create recovery picker session');
      window.open(session.pickerUri, '_blank', 'width=800,height=700');
      alert('Please select the unfinished items in the popup. Click OK only after you have finished selecting.');

      let status;
      let maxPolls = 15;
      while (maxPolls > 0) {
        status = await api.getPhotosSession(session.id);
        if (status.mediaItemsSet) break;
        await new Promise((r) => setTimeout(r, 4000));
        maxPolls--;
      }

      if (!status.mediaItemsSet) throw new Error('Timed out waiting for selection.');
      const itemsRes = await api.getPhotosMediaItems(session.id);
      if (itemsRes && itemsRes.mediaItems && itemsRes.mediaItems.length > 0) {
        const result = await api.resumeRecoveryPhotos(jobId, itemsRes.mediaItems);
        alert(`Recovery report:\nMatched: ${result.matched}\nAlready completed: ${result.alreadyVerified}\nMissing: ${result.requiredRemaining}`);
        refreshJobs();
        loadJobDetails(jobId);
      }
    } catch (e) {
      alert('Recovery failed: ' + e.message);
    } finally {
      setIsRecovering(false);
    }
  };

  const hasAuthError = selectedJobDetails && (selectedJobDetails.job.status === 'AUTH_REQUIRED' || selectedJobDetails.items.some((it) => it.status === 'AUTH_REQUIRED'));
  const hasRecoveryError = selectedJobDetails && (selectedJobDetails.job.status === 'RECOVERY_REQUIRED' || selectedJobDetails.items.some((it) => it.status === 'SOURCE_ACCESS_EXPIRED'));

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Migration center"
        title="Job execution monitor"
        description="Inspect live migrations, manage pause/resume/cancel controls, and review item-by-item status."
        meta={<StatusBadge tone={jobs.some((j) => j.status === 'RUNNING') ? 'green' : 'neutral'} mono>{jobs.length} jobs</StatusBadge>}
      />

      {hasRecoveryError && (
        <div className="notice-card" style={{ borderLeftColor: 'var(--amber)' }}>
          <div>
            <h3>Source access expired</h3>
            <p>Completed items are safe. Renew source selection to continue the remaining items.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => handleRecovery(selectedJobDetails.job.id)} disabled={isRecovering}>
            <RefreshCw size={14} className={isRecovering ? 'spin' : ''} /> Renew source access
          </button>
        </div>
      )}

      {hasAuthError && (
        <div className="notice-card" style={{ borderLeftColor: 'var(--red)' }}>
          <div>
            <h3>Destination account token expired</h3>
            <p>Refresh Account B and resume the job.</p>
          </div>
          <button className="btn btn-primary" onClick={() => handleReauthAndRetry(selectedJobDetails.job.id)} disabled={isAuthenticating}>
            <Key size={14} /> Refresh and resume
          </button>
        </div>
      )}

      <section className="content-grid content-grid--two">
        <div className="card-surface">
          <SectionHeader number="01" title="Jobs" description="Select a job to inspect details." />
          <div className="activity-list">
            {jobs.length === 0 ? (
              <EmptyState title="No jobs yet." description="Your migrations will appear here after they start." />
            ) : jobs.map((j) => {
              const isSelected = selectedJobDetails && selectedJobDetails.job.id === j.id;
              return (
                <button key={j.id} className={`job-pill ${isSelected ? 'active' : ''}`} onClick={() => { setActiveJobId(j.id); loadJobDetails(j.id); }}>
                  <div className="job-pill__row">
                    <span className="mono">{j.id}</span>
                    <Badge type={j.service_type} />
                  </div>
                  <div className="job-pill__row">
                    <span className="mono">{j.completed_items} / {j.total_items} items</span>
                    <Badge type={j.status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-surface">
          {selectedJobDetails ? (
            <>
              <SectionHeader number="02" title="Active migration" description={`${selectedJobDetails.job.source_email} → ${selectedJobDetails.job.dest_email}`} />
              <div className="migration-summary">
                <div className="migration-summary__status">
                  <Badge type={selectedJobDetails.job.service_type} />
                  <Badge type={selectedJobDetails.job.status} />
                </div>
                <ProgressBar
                  value={selectedJobDetails.job.total_items > 0 ? (selectedJobDetails.job.completed_items / selectedJobDetails.job.total_items) * 100 : 0}
                  label="Migration progress"
                  detail={`${selectedJobDetails.job.completed_items} / ${selectedJobDetails.job.total_items}`}
                />
                <div className="migration-summary__meta mono">
                  <span><Clock3 size={14} /> {selectedJobDetails.job.created_at ? new Date(selectedJobDetails.job.created_at).toLocaleString() : '—'}</span>
                </div>
                <div className="card-actions">
                  {selectedJobDetails.job.failed_items > 0 && selectedJobDetails.job.status !== 'RUNNING' && (
                    <button className="btn btn-secondary" onClick={() => handleRetry(selectedJobDetails.job.id)}><RefreshCw size={14} /> Retry failed items</button>
                  )}
                  {selectedJobDetails.job.status === 'RUNNING' ? (
                    <button className="btn btn-secondary" onClick={() => handlePause(selectedJobDetails.job.id)}><Pause size={14} /> Pause</button>
                  ) : selectedJobDetails.job.status === 'PAUSED' || selectedJobDetails.job.status === 'READY' ? (
                    <button className="btn btn-primary" onClick={() => handleStart(selectedJobDetails.job.id)}><Play size={14} /> Resume / start</button>
                  ) : null}
                  {selectedJobDetails.job.status !== 'COMPLETED' && selectedJobDetails.job.status !== 'CANCELLED' && (
                    <button className="btn btn-danger" onClick={() => setConfirmCancel(selectedJobDetails.job.id)}><XCircle size={14} /> Cancel</button>
                  )}
                </div>
              </div>

              <div className="table-container" style={{ marginTop: 16, maxHeight: 420 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Item</th>
                      <th>Path</th>
                      <th>Status</th>
                      <th>Destination / Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJobDetails.items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.item_type === 'FOLDER' ? <Folder size={14} /> : it.item_type === 'VIDEO' ? <FileVideo size={14} /> : <ImageIcon size={14} />}</td>
                        <td>{it.source_name}</td>
                        <td className="mono">{it.parent_path}</td>
                        <td><Badge type={it.status} /></td>
                        <td className="mono">{it.error_message || it.dest_item_id || 'Pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState title="Select a job to inspect." description="The migration center shows live progress once a job exists." />
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this migration job?"
        description="This will stop the selected migration job."
        confirmLabel="Cancel job"
        destructive
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => handleCancel(confirmCancel)}
      />
    </div>
  );
}
