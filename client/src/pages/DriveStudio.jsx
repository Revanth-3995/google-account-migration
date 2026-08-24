import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { HardDrive, FolderPlus, FileCheck, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw, Loader } from 'lucide-react';

export function DriveStudio({ setActiveTab }) {
  const { config, sourceAccount, destAccount, promptLogin, setActiveJobId, isAuthenticating } = useApp();
  const [migrationMode, setMigrationMode] = useState('HIERARCHY');
  const [rootFolder, setRootFolder] = useState(null);
  const [discoveredManifest, setDiscoveredManifest] = useState(null);
  const [directSelectedFiles, setDirectSelectedFiles] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  const [pickerReady, setPickerReady] = useState(false);

  // Pre-load Google Picker API on component mount
  useEffect(() => {
    const loadPicker = () => {
      if (typeof gapi !== 'undefined') {
        gapi.load('picker', () => {
          setPickerReady(true);
        });
      } else {
        // Retry every 500ms until gapi is available
        setTimeout(loadPicker, 500);
      }
    };
    loadPicker();
  }, []);

  const getOAuthToken = () => {
    if (!sourceAccount) return null;
    if (sourceAccount.token_data) {
      try {
        const data = typeof sourceAccount.token_data === 'string'
          ? JSON.parse(sourceAccount.token_data)
          : sourceAccount.token_data;
        if (data && data.access_token) return data.access_token;
      } catch (e) {}
    }
    if (sourceAccount.access_token) return sourceAccount.access_token;
    return null;
  };

  // Step 1: Open Picker to select root folder
  const openFolderPicker = async () => {
    let token = getOAuthToken();
    if (!token) {
      const ok = await promptLogin('source');
      if (!ok) return;
      // Re-get token after login
      token = getOAuthToken();
      if (!token) return;
    }

    if (!pickerReady) {
      // Force-load picker now and retry
      if (typeof gapi !== 'undefined') {
        gapi.load('picker', () => {
          setPickerReady(true);
          openFolderPicker();
        });
      } else {
        alert('Google API is loading. Please try again in a moment.');
      }
      return;
    }

    {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const appId = config.clientId ? config.clientId.split('-')[0] : '';
      const apiKey = config.apiKey || 'YOUR_GOOGLE_API_KEY';

      const builder = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.protocol + '//' + window.location.host)
        .setCallback(async (data) => {
          const action = data[google.picker.Response.ACTION] || data.action;
          if (action === google.picker.Action.PICKED) {
            const docs = data[google.picker.Response.DOCUMENTS] || data.docs || [];
            if (docs.length > 0) {
              const doc = docs[0];
              const folderId = doc[google.picker.Document.ID] || doc.id;
              const folderName = doc[google.picker.Document.NAME] || doc.name;
              setRootFolder({ id: folderId, name: folderName });
              await scanFolderHierarchy(folderId, folderName);
            }
          }
        });

      const picker = builder.build();
      picker.setVisible(true);
    }
  };

  // Step 2: Open Multi-select Picker for Direct Files
  const openFilesPicker = async () => {
    let token = getOAuthToken();
    if (!token) {
      const ok = await promptLogin('source');
      if (!ok) return;
      token = getOAuthToken();
      if (!token) return;
    }

    if (!pickerReady) {
      if (typeof gapi !== 'undefined') {
        gapi.load('picker', () => {
          setPickerReady(true);
          openFilesPicker();
        });
      } else {
        alert('Google API is loading. Please try again in a moment.');
      }
      return;
    }

    {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const appId = config.clientId ? config.clientId.split('-')[0] : '';
      const apiKey = config.apiKey || 'YOUR_GOOGLE_API_KEY';

      const builder = new google.picker.PickerBuilder()
        .addView(view)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.protocol + '//' + window.location.host)
        .setCallback((data) => {
          const action = data[google.picker.Response.ACTION] || data.action;
          if (action === google.picker.Action.PICKED) {
            const docs = data[google.picker.Response.DOCUMENTS] || data.docs || [];
            const files = docs.map(d => ({
              id: d[google.picker.Document.ID] || d.id,
              name: d[google.picker.Document.NAME] || d.name,
              mimeType: d[google.picker.Document.MIME_TYPE] || d.mimeType,
              size: d[google.picker.Document.SIZE_BYTES] || d.sizeBytes || 0,
              path: '/'
            }));
            setDirectSelectedFiles(files);
          }
        });

      const picker = builder.build();
      picker.setVisible(true);
    }
  };

  // Scan hierarchy via backend API (uses drive.readonly - no file-by-file auth needed!)
  const scanFolderHierarchy = async (folderId, folderName) => {
    setIsScanning(true);
    try {
      const manifest = await api.discoverDriveManifest(folderId, folderName);
      setDiscoveredManifest(manifest);
    } catch (e) {
      alert('Error scanning folder: ' + e.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Launch Job - no descendant authorization step needed with drive.readonly
  const launchMigration = async () => {
    if (!destAccount) {
      const ok = await promptLogin('destination');
      if (!ok) return;
    }

    setIsCreatingJob(true);
    try {
      let items = [];
      if (migrationMode === 'FILES') {
        items = directSelectedFiles;
      } else {
        const folderItems = (discoveredManifest.folders || []).map(f => ({
          id: f.id,
          name: f.name,
          mimeType: 'application/vnd.google-apps.folder',
          path: f.path,
          parentId: f.parentId || null,
          itemType: 'FOLDER'
        }));

        const fileItems = (discoveredManifest.files || []).map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          path: f.path,
          parentId: f.parentId || null,
          itemType: 'FILE'
        }));

        items = [...folderItems, ...fileItems];
      }

      const res = await api.createDriveJob(migrationMode, items);
      if (res.success && res.jobId) {
        await api.startJob(res.jobId);
        setActiveJobId(res.jobId);
        setActiveTab('/migration');
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
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Drive migration studio</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Rebalance Drive storage with verified server-to-server copy (0 local bytes transferred).
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
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Account A</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
              {sourceAccount ? sourceAccount.email : 'Not connected'}
            </div>
            <div style={{ fontSize: '0.8rem', color: sourceAccount ? '#10b981' : '#ef4444' }}>
              {sourceAccount ? 'Connected and ready for Drive browsing' : 'Source account missing'}
            </div>
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Account B</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
              {destAccount ? destAccount.email : 'Not connected'}
            </div>
            <div style={{ fontSize: '0.8rem', color: destAccount ? '#10b981' : '#ef4444' }}>
              {destAccount ? 'Connected and ready for Drive upload' : 'Destination account missing'}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>Select Migration Mode</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className={`btn ${migrationMode === 'HIERARCHY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setMigrationMode('HIERARCHY');
              setDirectSelectedFiles([]);
            }}
          >
            <FolderPlus size={16} /> Complete Folder Hierarchy
          </button>
          <button
            className={`btn ${migrationMode === 'FILES' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setMigrationMode('FILES');
              setRootFolder(null);
              setDiscoveredManifest(null);
            }}
          >
            <FileCheck size={16} /> Direct Multi-File Selection
          </button>
        </div>
      </div>

      {migrationMode === 'HIERARCHY' ? (
        <div>
          {/* Step 1: Root Folder Select */}
          <div className="card">
            <div className="card-header">
              <div>
                <div style={{ fontWeight: 600 }}>1. Select Root Source Folder</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose folder in Account A to migrate</div>
              </div>
              {rootFolder && <Badge type="COMPLETED" text="Root Selected" />}
            </div>

            {rootFolder ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8' }}>
                  📁 {rootFolder.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>({rootFolder.id})</span>
                </div>
                <button className="btn btn-secondary" onClick={openFolderPicker}>Change Folder</button>
              </div>
            ) : (
              <button className="btn btn-drive" onClick={openFolderPicker} disabled={isScanning}>
                {isScanning ? 'Scanning Directory...' : 'Open Google Drive Picker (Select Folder)'}
              </button>
            )}
          </div>

          {/* Loading Spinner During Scan */}
          {isScanning && (
            <div className="card" style={{ textAlign: 'center', padding: 32 }}>
              <Loader size={32} className="animate-spin" style={{ color: '#38bdf8', marginBottom: 12 }} />
              <div style={{ fontWeight: 600, color: '#38bdf8' }}>Recursively scanning folder contents...</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Discovering all subfolders and files. This may take a few seconds for large directories.
              </div>
            </div>
          )}

          {/* Step 2: Discovered Manifest - Auto-authorized, no manual file selection needed! */}
          {discoveredManifest && !isScanning && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ fontWeight: 600 }}>2. Discovered Folder Tree</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Found {discoveredManifest.totalFolders} folder(s) and {discoveredManifest.totalFiles} file(s)
                  </div>
                </div>
                <Badge type="COMPLETED" text="All Files Ready" />
              </div>

              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 8,
                padding: 12,
                fontSize: '0.85rem',
                marginBottom: 16
              }}>
                <strong>✅ No Manual File Authorization Needed!</strong> All files inside the selected folder are automatically
                ready for server-to-server migration. Just click "Start Migration" below.
              </div>

              {/* Summary Stats */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#38bdf8' }}>{discoveredManifest.totalFolders}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Folders</div>
                </div>
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981' }}>{discoveredManifest.totalFiles}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Files</div>
                </div>
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b' }}>
                    {((discoveredManifest.files || []).reduce((sum, f) => sum + (parseInt(f.size) || 0), 0) / (1024 * 1024)).toFixed(1)} MB
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Size</div>
                </div>
              </div>

              {/* Tree View */}
              <div style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                maxHeight: 250,
                overflowY: 'auto',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>Discovered Tree:</div>
                {(discoveredManifest.folders || []).map(f => (
                  <div key={f.id} style={{ color: '#93c5fd', marginLeft: (f.path.split('/').length - 2) * 16 }}>
                    📁 {f.path} <span style={{ color: 'var(--text-dim)' }}>({f.parentId || 'root'})</span>
                  </div>
                ))}
                {(discoveredManifest.files || []).map(f => (
                  <div key={f.id} style={{
                    color: '#4ade80',
                    marginLeft: (f.path.split('/').length - 1) * 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <CheckCircle2 size={12} />
                    📄 {f.name} <span style={{ color: 'var(--text-dim)' }}>({f.parentId || 'root'})</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                      ({f.mimeType}{f.size ? `, ${(parseInt(f.size) / 1024).toFixed(0)} KB` : ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Migration Execution */}
          {discoveredManifest && !isScanning && (
            <div className="card" style={{ borderTop: '3px solid #10b981' }}>
              <div className="card-header">
                <div>
                  <div style={{ fontWeight: 600 }}>3. Launch Cloud-to-Cloud Migration</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Recreates folders & copies all files directly on Google servers (0 local bytes)
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: 8,
                padding: 12,
                fontSize: '0.85rem',
                marginBottom: 16
              }}>
                <strong>Zero Local Transfer:</strong> File bytes travel directly between Google's servers.
                Your laptop only sends lightweight API commands.
              </div>

              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#10b981', fontSize: '1rem', padding: '12px 24px' }}
                onClick={launchMigration}
                disabled={isCreatingJob || isAuthenticating}
              >
                <ArrowRight size={18} /> Start Migration ({(discoveredManifest.totalFiles || 0)} Files + {(discoveredManifest.totalFolders || 0)} Folders)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Direct Multi-file mode */
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontWeight: 600 }}>Direct File Selection</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select one or multiple files in Account A</div>
            </div>
            {directSelectedFiles.length > 0 && (
              <Badge type="COMPLETED" text={`${directSelectedFiles.length} Selected`} />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-drive" onClick={openFilesPicker}>
              Open Multi-File Picker
            </button>
          </div>

          {directSelectedFiles.length > 0 && (
            <div>
              <div style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                maxHeight: 180,
                overflowY: 'auto',
                fontSize: '0.8rem'
              }}>
                {directSelectedFiles.map(f => (
                  <div key={f.id} style={{ color: '#4ade80', marginBottom: 4 }}>
                    📄 {f.name}
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#10b981' }}
                onClick={launchMigration}
                disabled={isCreatingJob || isAuthenticating}
              >
                <ArrowRight size={16} /> Migrate {directSelectedFiles.length} File(s) to Account B
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

