import React from 'react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/Badge';

export function History() {
  const { jobs, auditLogs } = useApp();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Migration History & Audit Trail</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Historical record of completed, partial, and cancelled migration jobs stored in local SQLite database.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Completed & Past Jobs</div>
        </div>

        {jobs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No historical jobs recorded.</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Service</th>
                  <th>Source Account</th>
                  <th>Destination Account</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="mono" style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{j.id}</td>
                    <td><Badge type={j.service_type} /></td>
                    <td style={{ fontSize: '0.8rem' }}>{j.source_email}</td>
                    <td style={{ fontSize: '0.8rem' }}>{j.dest_email}</td>
                    <td style={{ fontSize: '0.8rem' }}>{j.completed_items} / {j.total_items}</td>
                    <td><Badge type={j.status} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {j.completed_at ? new Date(j.completed_at).toLocaleString() : 'In Progress'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Full Audit Trail</div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 12,
          maxHeight: 300,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}>
          {auditLogs.map((l) => (
            <div key={l.id} style={{ marginBottom: 4 }}>
              <span style={{ color: 'var(--text-dim)' }}>[{new Date(l.timestamp).toLocaleString()}]</span>{' '}
              <span style={{ color: l.level === 'ERROR' ? '#ef4444' : l.level === 'WARN' ? '#f59e0b' : '#38bdf8' }}>
                [{l.event_type}]
              </span>{' '}
              <span style={{ color: '#e2e8f0' }}>{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
