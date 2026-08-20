import React from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { UserCheck, Shield, Check, Trash2, Key, RefreshCw } from 'lucide-react';

export function Accounts() {
  const {
    sourceAccount,
    destAccount,
    sourceLifetime,
    destLifetime,
    promptLogin,
    refreshAccounts,
    isAuthenticating,
    migrationAuthState
  } = useApp();

  const disconnectAccount = async (id) => {
    if (confirm(`Disconnect ${id === 'source' ? 'Source Account A' : 'Destination Account B'}?`)) {
      await api.deleteAccount(id);
      refreshAccounts();
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Account Hub</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Connect and manage your personal Google Accounts. Click "Refresh Token" anytime an account token reaches its 1-hour limit.
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge type={migrationAuthState.ready ? 'COMPLETED' : 'WARNING'} text={migrationAuthState.ready ? 'Migration Session Ready' : `Migration Session: ${migrationAuthState.state}`} />
          {sourceAccount ? <Badge type="COMPLETED" text="A Connected" /> : <Badge type="READY" text="A Missing" />}
          {destAccount ? <Badge type="COMPLETED" text="B Connected" /> : <Badge type="READY" text="B Missing" />}
        </div>
        <div style={{
          marginTop: 14,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid rgba(96, 165, 250, 0.35)',
          background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.18), rgba(16, 185, 129, 0.10))',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Account A lifetime</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: sourceLifetime.expired ? '#ef4444' : '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
              {sourceLifetime.remainingLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sourceLifetime.detailLabel}</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Account B lifetime</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: destLifetime.expired ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              {destLifetime.remainingLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{destLifetime.detailLabel}</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Source Account Card */}
        <div className="card" style={{ borderTop: '3px solid #38bdf8' }}>
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#38bdf8' }}>Source Account (Account A)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Origin of files & photos</div>
            </div>
            {sourceAccount ? (
              <Badge type="COMPLETED" text="Connected" />
            ) : (
              <Badge type="READY" text="Not Connected" />
            )}
          </div>

          {sourceAccount ? (
            <div>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authenticated Email</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{sourceAccount.email}</div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: 4, wordBreak: 'break-all' }}>
                  Scopes: {sourceAccount.scopes}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => promptLogin('source')}
                  disabled={isAuthenticating}
                >
                  <RefreshCw size={14} className={isAuthenticating ? 'animate-spin' : ''} /> Refresh Token / Re-auth
                </button>
                <button className="btn btn-danger" onClick={() => disconnectAccount('source')}>
                  <Trash2 size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Connect Source Account A for Drive selection and Google Photos Picker access.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => promptLogin('source')}
                disabled={isAuthenticating}
              >
                <UserCheck size={16} /> Connect Source Account A
              </button>
            </div>
          )}
        </div>

        {/* Destination Account Card */}
        <div className="card" style={{ borderTop: '3px solid #10b981' }}>
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#10b981' }}>Destination Account (Account B)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target for copied files & photos</div>
            </div>
            {destAccount ? (
              <Badge type="COMPLETED" text="Connected" />
            ) : (
              <Badge type="READY" text="Not Connected" />
            )}
          </div>

          {destAccount ? (
            <div>
              <div style={{ backgroundColor: 'var(--bg-input)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authenticated Email</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{destAccount.email}</div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 4, wordBreak: 'break-all' }}>
                  Scopes: {destAccount.scopes}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981' }}
                  onClick={() => promptLogin('destination')}
                  disabled={isAuthenticating}
                >
                  <RefreshCw size={14} className={isAuthenticating ? 'animate-spin' : ''} /> Refresh Token / Re-auth
                </button>
                <button className="btn btn-danger" onClick={() => disconnectAccount('destination')}>
                  <Trash2 size={14} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Connect Destination Account B for Drive copying and Google Photos library uploading.
              </p>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#10b981' }}
                onClick={() => promptLogin('destination')}
                disabled={isAuthenticating}
              >
                <UserCheck size={16} /> Connect Destination Account B
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
