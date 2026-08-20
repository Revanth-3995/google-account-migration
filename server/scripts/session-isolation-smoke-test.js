function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchWithCookie(baseUrl, path, options = {}, cookie = '') {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers
  });
  const setCookie = res.headers.get('set-cookie');
  return { res, setCookie };
}

function firstCookie(setCookie) {
  return (setCookie || '').split(';')[0];
}

async function createSession(baseUrl) {
  const { setCookie } = await fetchWithCookie(baseUrl, '/api/config');
  const cookie = firstCookie(setCookie);
  assert(cookie, 'Expected server to issue an owner session cookie');
  return cookie;
}

async function main() {
  const baseUrl = process.env.SESSION_SMOKE_BASE_URL || 'http://localhost:3000';
  console.log(`[SESSION-SMOKE] Target: ${baseUrl}`);

  const cookieA = await createSession(baseUrl);
  const saveA1 = await fetchWithCookie(baseUrl, '/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'session-a-source@example.com',
      role: 'source',
      scopes: 'scope-a',
      tokenData: { access_token: 'token-a-source', expires_in: 3600, issued_at: new Date().toISOString() }
    })
  }, cookieA);
  assert(saveA1.res.ok, 'Session A source account save failed');

  const saveA2 = await fetchWithCookie(baseUrl, '/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'session-a-destination@example.com',
      role: 'destination',
      scopes: 'scope-b',
      tokenData: { access_token: 'token-a-destination', expires_in: 3600, issued_at: new Date().toISOString() }
    })
  }, cookieA);
  assert(saveA2.res.ok, 'Session A destination account save failed');

  const accountsARes = await fetchWithCookie(baseUrl, '/api/accounts', {}, cookieA);
  const accountsA = await accountsARes.res.json();
  assert(accountsA.length === 2, `Session A should see 2 accounts, saw ${accountsA.length}`);

  const jobARes = await fetchWithCookie(baseUrl, '/api/photos/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          mediaFile: {
            baseUrl: 'https://example.invalid/photo-a',
            filename: 'photo-a.jpg',
            mimeType: 'image/jpeg'
          },
          type: 'IMAGE'
        }
      ]
    })
  }, cookieA);
  assert(jobARes.res.ok, 'Session A job creation failed');
  const jobA = await jobARes.res.json();
  assert(jobA.jobId, 'Session A jobId missing');

  const cookieB = await createSession(baseUrl);
  const accountsBRes = await fetchWithCookie(baseUrl, '/api/accounts', {}, cookieB);
  const accountsB = await accountsBRes.res.json();
  assert(Array.isArray(accountsB) && accountsB.length === 0, `Session B should see 0 accounts, saw ${accountsB.length}`);

  const directJobB = await fetchWithCookie(baseUrl, `/api/jobs/${jobA.jobId}`, {}, cookieB);
  assert(directJobB.res.status === 404, `Session B should not access Session A job; got ${directJobB.res.status}`);

  const saveB1 = await fetchWithCookie(baseUrl, '/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'session-b-source@example.com',
      role: 'source',
      scopes: 'scope-a',
      tokenData: { access_token: 'token-b-source', expires_in: 3600, issued_at: new Date().toISOString() }
    })
  }, cookieB);
  assert(saveB1.res.ok, 'Session B source account save failed');

  const saveB2 = await fetchWithCookie(baseUrl, '/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'session-b-destination@example.com',
      role: 'destination',
      scopes: 'scope-b',
      tokenData: { access_token: 'token-b-destination', expires_in: 3600, issued_at: new Date().toISOString() }
    })
  }, cookieB);
  assert(saveB2.res.ok, 'Session B destination account save failed');

  const accountsBAfterRes = await fetchWithCookie(baseUrl, '/api/accounts', {}, cookieB);
  const accountsBAfter = await accountsBAfterRes.res.json();
  assert(accountsBAfter.length === 2, `Session B should see 2 accounts, saw ${accountsBAfter.length}`);

  const accountsAAfterRes = await fetchWithCookie(baseUrl, '/api/accounts', {}, cookieA);
  const accountsAAfter = await accountsAAfterRes.res.json();
  assert(accountsAAfter.length === 2, `Session A should still see 2 accounts, saw ${accountsAAfter.length}`);
  assert(accountsAAfter.some(a => a.email === 'session-a-source@example.com'), 'Session A account A missing after Session B changes');
  assert(accountsBAfter.some(a => a.email === 'session-b-source@example.com'), 'Session B account A missing after isolation');

  console.log('[SESSION-SMOKE] Passed');
}

main().catch(err => {
  console.error('[SESSION-SMOKE] FAILED:', err.message);
  process.exit(1);
});
