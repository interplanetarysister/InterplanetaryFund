// Staging-only verification UI. Session tokens stay in memory and are revoked
// after the test. Never store, echo, log, or include credentials in the report.
export const verificationPage = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IFund geocoding verification</title>
<main><h1>IFund geocoding verification</h1>
<p>Use a Supabase test account in project ssibsfmtodgximseeqsv with an active IFund profile.</p>
<p>Your password goes directly to Supabase. This page keeps the test session in memory, signs it out after the test, and produces a report without your email, password, or tokens.</p>
<form id="verify"><label>Email <input id="email" type="email" autocomplete="username" required></label>
<label>Password <input id="password" type="password" autocomplete="current-password" required></label>
<button id="run" type="submit">Sign in and test London</button></form>
<p id="status" role="status"></p><pre id="report"></pre><button id="download" type="button" hidden>Download verification report</button>
<p>This test reads account status and geocodes a city. It does not save a campaign or process a payment.</p></main>
<script src="/__verify/geocode.js" defer></script></html>`;

export const verificationScript = `
'use strict';
const PROJECT = 'https://ssibsfmtodgximseeqsv.supabase.co';
const status = document.getElementById('status');
const report = document.getElementById('report');
const password = document.getElementById('password');
const email = document.getElementById('email');
const run = document.getElementById('run');
const download = document.getElementById('download');
let safeReport;
document.getElementById('verify').addEventListener('submit', async event => {
  event.preventDefault(); run.disabled = true; download.hidden = true;
  status.textContent = 'Checking the staging configuration…'; report.textContent = '';
  let token = ''; let key = '';
  const result = { timestamp: new Date().toISOString(), worker_origin: location.origin,
    project_ref: 'ssibsfmtodgximseeqsv', operation: 'geocodeCity', passed: false };
  try {
    const configResponse = await fetch('/__verify/config', { cache: 'no-store' });
    if (!configResponse.ok) throw Error('Staging verification is not configured.');
    const config = await configResponse.json();
    if (config.url !== PROJECT || typeof config.key !== 'string' || !config.key.startsWith('sb_publishable_')) throw Error('Unexpected staging configuration.');
    key = config.key;
    const anon = await fetch('/functions/geocodeCity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: 'London' }) });
    result.unauthenticated_status = anon.status;
    if (anon.status !== 401) throw Error('The Worker did not reject the signed-out request as expected.');
    status.textContent = 'Signing in directly with Supabase…';
    const authRequest = fetch(PROJECT + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), password: password.value })
    });
    password.value = '';
    const auth = await authRequest;
    result.supabase_sign_in_status = auth.status;
    if (!auth.ok) throw Error('Supabase sign-in failed. Check the test account in Supabase.');
    const session = await auth.json(); token = session.access_token;
    if (typeof token !== 'string' || !token) throw Error('Supabase did not issue a session.');
    status.textContent = 'Testing the signed-in Worker request…';
    const response = await fetch('/functions/geocodeCity', { method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'London' }) });
    result.authenticated_status = response.status;
    const data = await response.json();
    if (response.status === 200 && Number.isFinite(data.lat) && Number.isFinite(data.lng) && typeof data.display === 'string') {
      result.coordinates = { lat: data.lat, lng: data.lng, display: data.display };
      result.passed = true;
    } else {
      throw Error('The signed-in geocoding request did not pass. Share the report status codes.');
    }
  } catch (error) { result.failure = error.message || 'Verification could not finish.'; }
  finally {
    password.value = ''; email.value = '';
    if (token) {
      try {
        const logout = await fetch(PROJECT + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + token } });
        result.test_session_signed_out = logout.ok;
      } catch { result.test_session_signed_out = false; }
    }
    token = ''; key = ''; safeReport = result;
    report.textContent = JSON.stringify(result, null, 2);
    status.textContent = result.passed ? 'Geocoding test passed. Download the report to share the result.' : 'Verification did not pass. Download the report for the next investigation.';
    download.hidden = false; run.disabled = false;
  }
});
download.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(safeReport, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ifund-geocode-verification.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
`;
