import React from 'react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/Badge';
import { PageHeader, SectionHeader, EmptyState } from '../components/ui';

export function History() {
  const { jobs, auditLogs } = useApp();

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Migration history"
        title="A polished record of what moved"
        description="Completed, partial, failed, and cancelled migrations stay visible here for the current workspace only."
      />

      <section className="card-surface">
        <SectionHeader number="01" title="Jobs" description="A compact migration record." />
        {jobs.length === 0 ? (
          <EmptyState title="No historical jobs recorded." description="Once a migration runs, it will appear here." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="mono">{j.created_at ? new Date(j.created_at).toLocaleString() : '—'}</td>
                    <td>{j.source_email}</td>
                    <td>{j.dest_email}</td>
                    <td><Badge type={j.service_type} /></td>
                    <td><Badge type={j.status} /></td>
                    <td className="mono">{j.completed_items} / {j.total_items}</td>
                    <td className="mono">{j.completed_at ? `${Math.max(0, Math.round((new Date(j.completed_at) - new Date(j.created_at || j.completed_at)) / 60000))}m` : 'In progress'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-surface">
        <SectionHeader number="02" title="Activity log" description="The current workspace’s audit trail." />
        <div className="activity-list">
          {auditLogs.length === 0 ? (
            <EmptyState title="No audit events yet." description="Migration events will appear here as activity is recorded." />
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="activity-item">
                <span className="mono activity-item__time">{new Date(log.timestamp).toLocaleString()}</span>
                <span className={`activity-item__level level-${log.level.toLowerCase()}`}>{log.level}</span>
                <div>{log.message}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
