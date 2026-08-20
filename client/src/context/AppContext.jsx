import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [config, setConfig] = useState({ clientId: '', projectId: '', apiKey: '' });
  const [accounts, setAccounts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [migrationAuthState, setMigrationAuthState] = useState({
    sourceValid: false,
    destinationValid: false,
    ready: false,
    state: 'BOTH_REAUTH_REQUIRED',
    checking: false
  });

  const parseTokenData = (account) => {
    if (!account || !account.token_data) return null;
    try {
      return typeof account.token_data === 'string' ? JSON.parse(account.token_data) : account.token_data;
    } catch {
      return null;
    }
  };

  const normalizeTimestamp = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const getStoredTokenExpiry = (account) => {
    const tokenData = parseTokenData(account);
    if (!tokenData) return null;

    if (typeof tokenData.expires_at === 'string') {
      const explicitExpiry = normalizeTimestamp(tokenData.expires_at);
      if (explicitExpiry) return explicitExpiry;
    }

    const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : null;
    if (expiresIn == null) return null;

    const issuedAt = normalizeTimestamp(tokenData.issued_at)
      || normalizeTimestamp(tokenData.saved_at)
      || normalizeTimestamp(account && account.updated_at);

    if (!issuedAt) return null;
    return issuedAt + (expiresIn * 1000);
  };

  const getAccountLifetimeInfo = (account) => {
    if (!account) {
      return {
        connected: false,
        expiresAt: null,
        remainingMs: null,
        expired: false,
        expiringSoon: false,
        statusLabel: 'Not connected',
        detailLabel: 'Not connected',
        remainingLabel: 'Not connected'
      };
    }

    const tokenData = parseTokenData(account);
    const expiresIn = tokenData && typeof tokenData.expires_in === 'number' ? tokenData.expires_in : null;
    const issuedAt = normalizeTimestamp(tokenData && (tokenData.issued_at || tokenData.saved_at))
      || normalizeTimestamp(account.updated_at);

    let expiresAt = null;
    if (tokenData && typeof tokenData.expires_at === 'string') {
      expiresAt = normalizeTimestamp(tokenData.expires_at);
    }
    if (!expiresAt && issuedAt && expiresIn != null) {
      expiresAt = issuedAt + (expiresIn * 1000);
    }

    if (!expiresAt) {
      return {
        connected: true,
        expiresAt: null,
        remainingMs: null,
        expired: false,
        expiringSoon: false,
        statusLabel: 'Connected',
        detailLabel: 'Expiry information unavailable',
        remainingLabel: 'Expiry information unavailable'
      };
    }

    const remainingMs = expiresAt - nowTick;
    const expired = remainingMs <= 0;
    const expiringSoon = !expired && remainingMs <= 5 * 60 * 1000;
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    let remainingLabel = 'Expiry information unavailable';
    if (expired) {
      remainingLabel = 'Expired';
    } else if (hours > 0) {
      remainingLabel = `${hours}h ${minutes}m remaining`;
    } else if (minutes > 0) {
      remainingLabel = `${minutes}m ${seconds}s remaining`;
    } else {
      remainingLabel = `${seconds}s remaining`;
    }

    return {
      connected: true,
      expiresAt,
      remainingMs,
      expired,
      expiringSoon,
      statusLabel: expired ? 'Expired' : 'Connected',
      detailLabel: expired ? 'Authentication expired' : `Expires at ${new Date(expiresAt).toLocaleString()}`,
      remainingLabel
    };
  };

  const validateStoredAccount = async (account) => {
    const tokenData = parseTokenData(account);
    if (!account || !tokenData || !tokenData.access_token) return false;

    const expiry = getStoredTokenExpiry(account);
    if (expiry && expiry <= Date.now()) return false;

    return true;
  };

  const refreshMigrationAuthState = async (accountsOverride = null) => {
    const currentAccounts = accountsOverride || accounts;
    const source = currentAccounts.find(a => a.id === 'source');
    const destination = currentAccounts.find(a => a.id === 'destination');

    setMigrationAuthState(prev => ({ ...prev, checking: true }));

    const [sourceValid, destinationValid] = await Promise.all([
      validateStoredAccount(source),
      validateStoredAccount(destination)
    ]);

    let state = 'BOTH_REAUTH_REQUIRED';
    if (sourceValid && destinationValid) state = 'READY';
    else if (!sourceValid && !destinationValid) state = 'BOTH_REAUTH_REQUIRED';
    else if (!sourceValid) state = 'A_REAUTH_REQUIRED';
    else state = 'B_REAUTH_REQUIRED';

    const nextState = {
      sourceValid,
      destinationValid,
      ready: sourceValid && destinationValid,
      state,
      checking: false
    };

    setMigrationAuthState(nextState);
    return nextState;
  };

  const ensureMigrationAccountsReady = async () => {
    const latest = await refreshMigrationAuthState();
    if (latest.ready) return true;

    const hasSource = !!accounts.find(a => a.id === 'source');
    const hasDestination = !!accounts.find(a => a.id === 'destination');
    const sourceOk = latest.sourceValid;
    const destinationOk = latest.destinationValid;

    if (!sourceOk) {
      const ok = await promptLogin('source');
      if (!ok) return false;
    }

    const afterSource = await refreshMigrationAuthState();
    if (!afterSource.destinationValid) {
      if (hasDestination || sourceOk) {
        const ok = await promptLogin('destination');
        if (!ok) return false;
      } else if (!hasDestination) {
        const ok = await promptLogin('destination');
        if (!ok) return false;
      }
    }

    const finalState = await refreshMigrationAuthState();
    return finalState.ready;
  };

  const refreshAccounts = async () => {
    try {
      const data = await api.getAccounts();
      setAccounts(data);
      refreshMigrationAuthState(data);
      return data;
    } catch (e) {
      console.error('Failed to load accounts:', e);
      return [];
    }
  };

  const refreshJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }
  };

  const refreshAudit = async () => {
    try {
      const data = await api.getAuditLogs(50);
      setAuditLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  };

  useEffect(() => {
    api.getConfig().then(cfg => {
      setConfig(cfg);
    }).catch(console.error);

    refreshAccounts();
    refreshJobs();
    refreshAudit();

    const es = new EventSource('/api/events');
    es.addEventListener('open', () => setSseConnected(true));
    es.addEventListener('error', () => setSseConnected(false));
    es.addEventListener('JOB_STATUS', () => { refreshJobs(); refreshAudit(); });
    es.addEventListener('ITEM_PROGRESS', () => { refreshJobs(); refreshAudit(); });
    es.addEventListener('JOB_CREATED', () => { refreshJobs(); refreshAudit(); });

    const timer = setInterval(() => setNowTick(Date.now()), 1000);

    return () => {
      es.close();
      clearInterval(timer);
    };
  }, []);

  // Universal 1-Click Authenticator / Token Refresher
  const promptLogin = async (role) => {
    let currentClientId = config.clientId;
    if (!currentClientId) {
      const freshConfig = await api.getConfig();
      setConfig(freshConfig);
      currentClientId = freshConfig.clientId;
    }

    if (!currentClientId) {
      alert('Error: Google Client ID is missing. Please verify server/credentials.json.');
      return false;
    }

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      alert('Google Sign-In library is loading. Please wait 2 seconds and try again.');
      return false;
    }

    setIsAuthenticating(true);
    const scope = role === 'source'
      ? 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
      : 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/photoslibrary.appendonly';

    return new Promise((resolve) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: currentClientId,
        scope: scope,
        callback: async (res) => {
          setIsAuthenticating(false);
          if (res.error) {
            alert('OAuth Error: ' + (res.error_description || res.error));
            resolve(false);
            return;
          }

          let email = '';
          // 1. Try Drive about API (works with drive.file scope)
          try {
            const driveAboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)', {
              headers: { 'Authorization': 'Bearer ' + res.access_token }
            });
            if (driveAboutRes.ok) {
              const d = await driveAboutRes.json();
              if (d.user && d.user.emailAddress) {
                email = d.user.emailAddress;
              }
            }
          } catch (e) {}

          // 2. Fallback to userinfo API
          if (!email) {
            try {
              const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': 'Bearer ' + res.access_token }
              });
              if (userinfoRes.ok) {
                const u = await userinfoRes.json();
                if (u.email) email = u.email;
              }
            } catch (e) {}
          }

          if (!email) {
            email = role === 'source' ? 'source_account@gmail.com' : 'destination_account@gmail.com';
          }

          await api.saveAccount({
            id: role,
            email: email,
            role: role === 'source' ? 'Source Account A' : 'Destination Account B',
            scopes: scope,
            tokenData: {
              access_token: res.access_token,
              expires_in: res.expires_in,
              issued_at: new Date().toISOString()
            }
          });

          await refreshAccounts();
          await refreshMigrationAuthState();
          resolve(true);
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  };

  const sourceAccount = accounts.find(a => a.id === 'source');
  const destAccount = accounts.find(a => a.id === 'destination');
  const sourceLifetime = getAccountLifetimeInfo(sourceAccount);
  const destLifetime = getAccountLifetimeInfo(destAccount);

  return (
    <AppContext.Provider value={{
      config,
      accounts,
      sourceAccount,
      destAccount,
      sourceLifetime,
      destLifetime,
      getAccountLifetimeInfo,
      refreshAccounts,
      promptLogin,
      refreshMigrationAuthState,
      ensureMigrationAccountsReady,
      migrationAuthState,
      isAuthenticating,
      jobs,
      refreshJobs,
      activeJobId,
      setActiveJobId,
      auditLogs,
      refreshAudit,
      sseConnected
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

