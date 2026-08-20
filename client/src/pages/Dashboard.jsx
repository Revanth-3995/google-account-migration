import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { HardDrive, Image, Activity, CheckCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export function Dashboard({ setActiveTab }) {
  const { accounts, jobs, sourceAccount, destAccount, auditLogs, setActiveJobId } = useApp();

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'COMPLETED_WITH_ERRORS').length;
  const runningJobs = jobs.filter(j => j.status === 'RUNNING').length;
  const totalItemsMigrated = jobs.reduce((sum, j) => sum + (j.completed_items || 0), 0);

  return (
    <div>
      {/* Top Banner if accounts are missing */}
      {(!sourceAccount || !destAccount) && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>Account Connection Required</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Connect both Source Account A and Destination Account B to start rebalancing Drive or Photos storage.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setActiveTab('accounts')}>
            Connect Accounts <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Overview Stat Grid */}
      <div className="grid-4">
        <StatCard title="Total Migrations" value={totalJobs} subtitle="Created jobs" icon={Activity} color="#38bdf8" />
        <StatCard title="Completed Jobs" value={completedJobs} subtitle="100% finished" icon={CheckCircle} color="#10b981" />
        <StatCard title="Active Queued" value={runningJobs} subtitle="Running right now" icon={ShieldCheck} color="#f59e0b" />
        <StatCard title="Total Items Rebalanced" value={totalItemsMigrated} subtitle="Files & Photos" icon={HardDrive} color="#a855f7" />
      </div>

      {/* Quick Launch Cards */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ borderTop: '3px solid #38bdf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <HardDrive size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>Google Drive Rebalancer</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Server-to-Server zero byte cloud copy</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Migrate individual files, batch selections, or deep folder hierarchies from Account A into Account B with mapped folder reconstruction.
          </p>
          <button className="btn btn-drive" onClick={() => setActiveTab('drive')}>
            Open Drive Studio <ArrowRight size={14} />
          </button>
        </div>

        <div className="card" style={{ borderTop: '3px solid #f43f5e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              <Image size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>Google Photos Rebalancer</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-Memory Ephemeral RAM Stream</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Select photos via Google's official Photos Picker, stream high-res bytes with full EXIF capture date fidelity, and upload directly to Account B.
          </p>
          <button className="btn btn-photos" onClick={() => setActiveTab('photos')}>
            Open Photos Studio <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Jobs & Activity */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Migration Jobs</div>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setActiveTab('jobs')}>
            View All Jobs
          </button>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No migration jobs created yet. Launch your first Drive or Photos migration above!
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Service</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 5).map((job) => (
                  <tr key={job.id}>
                    <td className="mono" style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{job.id}</td>
                    <td><Badge type={job.service_type} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.migration_mode}</td>
                    <td><Badge type={job.status} /></td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {job.completed_items} / {job.total_items} items
                      {job.failed_items > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>({job.failed_items} failed)</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {new Date(job.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setActiveJobId(job.id);
                          setActiveTab('jobs');
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Audit Log Feed */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Live Audit Stream</div>
          <Badge type="COMPLETED" text="Verified Local Logging" />
        </div>
        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 12,
          maxHeight: 180,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}>
          {auditLogs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>Awaiting system events...</div>
          ) : (
            auditLogs.slice(0, 15).map((log) => (
              <div key={log.id} style={{ marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span style={{ color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : '#38bdf8' }}>
                  [{log.event_type}]
                </span>{' '}
                <span style={{ color: '#e2e8f0' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
