import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { Image, Play, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw, Key } from 'lucide-react';

export function PhotosStudio({ setActiveTab }) {
  const {
    sourceAccount,
    destAccount,
    sourceLifetime,
    destLifetime,
    promptLogin,
    ensureMigrationAccountsReady,
    migrationAuthState,
    refreshAccounts,
    setActiveJobId,
    isAuthenticating
  } = useApp();
  const [activeSession, setActiveSession] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pickedItems, setPickedItems] = useState([]);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    refreshAccounts();
  }, []);

  const createSession = async () => {
    const ok = await ensureMigrationAccountsReady();
    if (!ok) return;

    try {
      const data = await api.createPhotosSession();
      if (data && data.id) {
        setActiveSession(data);
        setPickedItems([]);
        setAuthError(false);
      } else if (data && data.error && (data.error.code === 401 || data.error.status === 'UNAUTHENTICATED')) {
        setAuthError(true);
      } else {
        alert('Failed to create Photos Picker session: ' + JSON.stringify(data));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleRefreshAndCreate = async () => {
    const ok = await promptLogin('source');
    if (ok) {
      setAuthError(false);
      await createSession();
    }
  };

  const openPickerUi = () => {
    if (!migrationAuthState.ready || migrationAuthState.checking) {
      return;
    }

    if (activeSession && activeSession.pickerUri) {
      window.open(activeSession.pickerUri, '_blank', 'width=800,height=700');
    }
  };

  const pollSession = async () => {
    if (!activeSession) return;
    setIsPolling(true);

    try {
      const status = await api.getPhotosSession(activeSession.id);
      if (status.mediaItemsSet) {
        setIsPolling(false);
        const itemsRes = await api.getPhotosMediaItems(activeSession.id);
        if (itemsRes && itemsRes.mediaItems) {
          setPickedItems(itemsRes.mediaItems);
        }
      } else {
        setTimeout(pollSession, 4000);
      }
    } catch (e) {
      setIsPolling(false);
      alert('Error polling session: ' + e.message);
    }
  };

  const launchMigration = async () => {
    const ok = await ensureMigrationAccountsReady();
    if (!ok) return;

    setIsCreatingJob(true);
    try {
      const res = await api.createPhotosJob(pickedItems);
      if (res.success && res.jobId) {
        await api.startJob(res.jobId);
        setActiveJobId(res.jobId);
        setActiveTab('jobs');
      }
    } catch (e) {
      alert('Error starting migration: ' + e.message);
    } finally {
      setIsCreatingJob(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Google Photos Migration Studio</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Stream photos & full-length videos from Account A to Account B via in-memory ephemeral relay with intact EXIF metadata.
        </p>
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
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge type={migrationAuthState.ready ? 'COMPLETED' : 'WARNING'} text={migrationAuthState.ready ? 'Migration Accounts Ready' : `Migration Accounts: ${migrationAuthState.state}`} />
          {sourceAccount ? <Badge type="COMPLETED" text="Account A Connected" /> : <Badge type="READY" text="Account A Missing" />}
          {destAccount ? <Badge type="COMPLETED" text="Account B Connected" /> : <Badge type="READY" text="Account B Missing" />}
          {sourceAccount && (
            <Badge
              type={sourceLifetime.expired ? 'FAILED' : (sourceLifetime.expiringSoon ? 'WARNING' : 'COMPLETED')}
              text={`A expires: ${sourceLifetime.remainingLabel}`}
            />
          )}
          {destAccount && (
            <Badge
              type={destLifetime.expired ? 'FAILED' : (destLifetime.expiringSoon ? 'WARNING' : 'COMPLETED')}
              text={`B expires: ${destLifetime.remainingLabel}`}
            />
          )}
        </div>
      </div>

      {authError && (
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
            <div style={{ fontWeight: 600, color: '#ef4444' }}>Source Account A Token Expired (1-Hour Limit)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Google access tokens expire after 1 hour. Click to refresh Account A's token instantly.
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleRefreshAndCreate} disabled={isAuthenticating}>
            <RefreshCw size={14} className={isAuthenticating ? 'animate-spin' : ''} /> Refresh Account A Token Now
          </button>
        </div>
      )}

      {/* Step 1 & 2: Picker Session & Selection */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ fontWeight: 600 }}>1. Google Photos Picker Selection</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official picker UI hosted by Google</div>
          </div>
          {pickedItems.length > 0 ? (
            <Badge type="COMPLETED" text={`${pickedItems.length} Item(s) Selected`} />
          ) : activeSession ? (
            <Badge type="RUNNING" text="Session Active" />
          ) : (
            <Badge type="READY" text="Ready" />
          )}
        </div>

        {!activeSession ? (
          <button className="btn btn-photos" onClick={createSession} disabled={isAuthenticating || migrationAuthState.checking || !migrationAuthState.ready}>
            <Image size={16} /> Create Google Photos Picker Session
          </button>
        ) : (
          <div>
            <div style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              fontSize: '0.8rem'
            }}>
              <div><strong>Session ID:</strong> <span className="mono">{activeSession.id}</span></div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                Expires: {new Date(activeSession.expireTime).toLocaleString()} (7 days)
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-photos" onClick={openPickerUi} disabled={!migrationAuthState.ready || migrationAuthState.checking}>
                1. Open Google Photos Picker UI
              </button>
              <button className="btn btn-secondary" onClick={pollSession} disabled={isPolling}>
                <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
                {isPolling ? 'Polling Selection...' : '2. Detect Picked Photos'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Descriptors Inspection & Privacy Guardrail */}
      {pickedItems.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 600 }}>2. Selected Media Descriptors</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pickedItems.length} item(s) ready for migration</div>
            </div>
            <Badge type="COMPLETED" text="Metadata Verified" />
          </div>

          <div style={{
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: 8,
            padding: 12,
            fontSize: '0.85rem',
            marginBottom: 16
          }}>
            <strong>Zero Disk Persistence Guarantee:</strong> Media bytes stream directly through temporary RAM buffer in Node.js and are immediately released after destination upload. No files are written to disk.
          </div>

          <div style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            maxHeight: 200,
            overflowY: 'auto',
            fontSize: '0.8rem'
          }}>
            {pickedItems.map((item, idx) => {
              const filename = (item.mediaFile && item.mediaFile.filename) || item.filename || `photo_${idx + 1}.jpg`;
              const mimeType = (item.mediaFile && item.mediaFile.mimeType) || item.mimeType || 'image/jpeg';
              const isVideo = item.type === 'VIDEO' || mimeType.startsWith('video/');

              return (
                <div key={item.id} style={{
                  padding: '6px 0',
                  borderBottom: idx < pickedItems.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ marginRight: 6 }}>{isVideo ? '🎥' : '🖼️'}</span>
                    <span style={{ fontWeight: 500 }}>{filename}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>({mimeType})</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-primary"
            style={{ backgroundColor: '#e11d48' }}
            onClick={launchMigration}
            disabled={isCreatingJob || isAuthenticating || migrationAuthState.checking || !migrationAuthState.ready}
          >
            <ArrowRight size={16} /> Start Migration ({pickedItems.length} Items)
          </button>
        </div>
      )}
    </div>
  );
}
