import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { PageHeader, SectionHeader, ProgressBar, EmptyState } from '../components/ui';
import { HardDrive, Image as ImageIcon, Activity, CheckCircle2, ArrowRight, ShieldCheck, History, Clock3 } from 'lucide-react';

export function Dashboard({ setActiveTab }) {
  const { jobs, sourceAccount, destAccount, auditLogs, setActiveJobId } = useApp();

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'COMPLETED_WITH_ERRORS').length;
  const runningJobs = jobs.filter((j) => j.status === 'RUNNING').length;
  const totalItemsMigrated = jobs.reduce((sum, j) => sum + (j.completed_items || 0), 0);
  const latestJob = jobs[0] || null;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Your migration workspace"
        title="Migration command center"
        description="See source and destination status, current migration activity, and recent events in one place."
        actions={<button className="btn btn-primary" onClick={() => setActiveTab('/connect')}><ArrowRight size={16} /> Connect accounts</button>}
        meta={<Badge type={sourceAccount && destAccount ? 'COMPLETED' : 'WARNING'} text={sourceAccount && destAccount ? 'Workspace ready' : 'Accounts needed'} />}
      />

      {(!sourceAccount || !destAccount) && (
        <div className="notice-card">
          <div>
            <h3>Connection required</h3>
            <p>Connect both Account A and Account B to unlock the migration tools.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setActiveTab('/connect')}>Open accounts</button>
        </div>
      )}

      <section className="stat-grid">
        <StatCard title="Total migrations" value={totalJobs} subtitle="Created jobs" icon={Activity} />
        <StatCard title="Completed jobs" value={completedJobs} subtitle="Finished jobs" icon={CheckCircle2} color="#2f6f4f" />
        <StatCard title="Active jobs" value={runningJobs} subtitle="Running now" icon={ShieldCheck} color="#33517c" />
        <StatCard title="Items migrated" value={totalItemsMigrated} subtitle="Files and photos" icon={HardDrive} color="#9c6b22" />
      </section>

      <section className="feature-grid">
        <article className="feature-card feature-card--accent">
          <div className="feature-top"><HardDrive size={18} /> <span>Drive</span></div>
          <p>Server-side copy, folder hierarchy reconstruction, and resume-aware job handling already in place.</p>
          <button className="btn btn-secondary" onClick={() => setActiveTab('/drive')}>Open Drive Studio</button>
        </article>
        <article className="feature-card feature-card--accent feature-card--green">
          <div className="feature-top"><ImageIcon size={18} /> <span>Photos</span></div>
          <p>Picker-based selection for photos and videos with the existing streaming migration pipeline.</p>
          <button className="btn btn-secondary" onClick={() => setActiveTab('/photos')}>Open Photos Studio</button>
        </article>
      </section>

      <section className="content-grid content-grid--two">
        <div className="card-surface">
          <SectionHeader number="01" title="Current migration" description="A concise operational view of the latest job." />
          {latestJob ? (
            <div className="migration-summary">
              <div className="migration-summary__row">
                <span className="mono">{latestJob.source_email}</span>
                <ArrowRight size={14} />
                <span className="mono">{latestJob.dest_email}</span>
              </div>
              <div className="migration-summary__status">
                <Badge type={latestJob.service_type} />
                <Badge type={latestJob.status} />
              </div>
              <ProgressBar
                value={latestJob.total_items ? (latestJob.completed_items / latestJob.total_items) * 100 : 0}
                label="Migration progress"
                detail={`${latestJob.completed_items || 0} / ${latestJob.total_items || 0} items`}
              />
              <div className="migration-summary__meta mono">
                <span><Clock3 size={14} /> {latestJob.created_at ? new Date(latestJob.created_at).toLocaleString() : '—'}</span>
                <span><History size={14} /> {latestJob.status}</span>
              </div>
              <button className="btn btn-primary" onClick={() => { setActiveJobId(latestJob.id); setActiveTab('/migration'); }}>Inspect job</button>
            </div>
          ) : (
            <EmptyState
              title="Nothing is moving yet."
              description="Connect your accounts and choose what you want to take with you."
              action={<button className="btn btn-primary" onClick={() => setActiveTab('/connect')}>Connect accounts</button>}
            />
          )}
        </div>

        <div className="card-surface">
          <SectionHeader number="02" title="Recent activity" description="The latest events from the migration workspace." />
          <div className="activity-list">
            {auditLogs.length === 0 ? (
              <EmptyState title="No activity yet." description="Once migrations start, recent events appear here." />
            ) : (
              auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="activity-item">
                  <span className="mono activity-item__time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`activity-item__level level-${log.level.toLowerCase()}`}>{log.level}</span>
                  <div>{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
