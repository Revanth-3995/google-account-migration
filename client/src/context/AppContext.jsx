import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { computeMigrationAuthState, getAccountLifetimeInfo } from '../utils/accountAuthState';

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

  const refreshMigrationAuthState = (accountsOverride = null) => {
    const nextState = computeMigrationAuthState(accountsOverride || accounts);
    setMigrationAuthState(nextState);
    return nextState;
  };

  const ensureMigrationAccountsReady = async () => {
    const latest = refreshMigrationAuthState();
    if (latest.ready) return true;

    const hasSource = !!accounts.find(a => a.role === 'source');
    const hasDestination = !!accounts.find(a => a.role === 'destination');
    const sourceOk = latest.sourceValid;
    const destinationOk = latest.destinationValid;

    if (!sourceOk) {
      const ok = await promptLogin('source');
      if (!ok) return false;
    }

    const afterSource = refreshMigrationAuthState();
    if (!afterSource.destinationValid) {
      if (hasDestination || sourceOk) {
        const ok = await promptLogin('destination');
        if (!ok) return false;
      } else if (!hasDestination) {
        const ok = await promptLogin('destination');
        if (!ok) return false;
      }
    }

    const finalState = refreshMigrationAuthState();
    return finalState.ready;
  };

  const getAccountLifetimeInfoForTick = (account) => getAccountLifetimeInfo(account, nowTick);

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
            email: email,
            role: role,
            scopes: scope,
            tokenData: {
              access_token: res.access_token,
              expires_in: res.expires_in,
              issued_at: new Date().toISOString()
            }
          });

          await refreshAccounts();
          resolve(res.access_token);
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  };

  const sourceAccount = accounts.find(a => a.role === 'source');
  const destAccount = accounts.find(a => a.role === 'destination');
  const sourceLifetime = getAccountLifetimeInfoForTick(sourceAccount);
  const destLifetime = getAccountLifetimeInfoForTick(destAccount);

  return (
    <AppContext.Provider value={{
      config,
      accounts,
      sourceAccount,
      destAccount,
      sourceLifetime,
      destLifetime,
      getAccountLifetimeInfo: getAccountLifetimeInfoForTick,
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
