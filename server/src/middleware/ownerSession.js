import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'gma_owner_session';

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function buildCookie(value, { secure }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=31536000'
  ];

  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function ensureOwnerSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  let ownerSessionId = cookies[SESSION_COOKIE_NAME];

  if (!ownerSessionId) {
    ownerSessionId = crypto.randomUUID();
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const host = String(req.headers.host || '').toLowerCase();
    const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
    const isHttps = req.secure || forwardedProto === 'https';
    const secure = process.env.NODE_ENV === 'production' && isHttps && !isLocalHost;
    res.setHeader('Set-Cookie', buildCookie(ownerSessionId, { secure }));
  }

  req.ownerSessionId = ownerSessionId;
  next();
}

