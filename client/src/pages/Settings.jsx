import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, Database, Key } from 'lucide-react';

export function Settings() {
  const { config } = useApp();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>System Settings & Verification</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Local control plane configuration, scope verification, and storage invariants.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={18} color="#38bdf8" /> OAuth configuration
            </div>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Client ID</div>
              <div className="mono" style={{ color: '#38bdf8', wordBreak: 'break-all', marginTop: 2 }}>
                {config.clientId || 'Not Loaded'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Project ID</div>
              <div className="mono" style={{ color: '#f3f4f6', marginTop: 2 }}>
                {config.projectId}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#10b981" /> Architecture Invariants
            </div>
          </div>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong>Drive Data Plane:</strong> 0 local file bytes (server copy).</li>
            <li><strong>Photos Data Plane:</strong> In-memory RAM stream only (0 disk writes).</li>
            <li><strong>Scope Discipline:</strong> Least-privilege non-restricted scopes exclusively.</li>
            <li><strong>Source Safety:</strong> Strictly non-destructive (no deletions).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
