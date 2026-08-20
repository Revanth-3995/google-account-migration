function parseTokenData(account) {
  if (!account || !account.token_data) return null;
  try {
    return typeof account.token_data === 'string' ? JSON.parse(account.token_data) : account.token_data;
  } catch {
    return null;
  }
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function getStoredTokenExpiry(account) {
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
}

export function getAccountLifetimeInfo(account, nowTick = Date.now()) {
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
}

export function validateStoredAccount(account) {
  if (!account) return false;
  if (account.has_token_data === false) return false;

  const expiry = getStoredTokenExpiry(account);
  if (expiry && expiry <= Date.now()) return false;

  return true;
}

export function computeMigrationAuthState(accounts) {
  const source = (accounts || []).find(a => a.role === 'source');
  const destination = (accounts || []).find(a => a.role === 'destination');
  const sourceValid = validateStoredAccount(source);
  const destinationValid = validateStoredAccount(destination);

  let state = 'BOTH_REAUTH_REQUIRED';
  if (sourceValid && destinationValid) state = 'READY';
  else if (!sourceValid && !destinationValid) state = 'BOTH_REAUTH_REQUIRED';
  else if (!sourceValid) state = 'A_REAUTH_REQUIRED';
  else state = 'B_REAUTH_REQUIRED';

  return {
    sourceValid,
    destinationValid,
    ready: sourceValid && destinationValid,
    state,
    checking: false
  };
}
