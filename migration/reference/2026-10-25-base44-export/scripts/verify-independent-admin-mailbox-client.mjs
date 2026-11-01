import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync('src/components/inbox/IndependentAdminMail.jsx', 'utf8');
assert.match(src, /ifund-admin-mailbox/);
assert.match(src, /authorization:/);
assert.match(src, /type="password"/);
assert.doesNotMatch(src, /localStorage\.setItem|sessionStorage\.setItem/);
assert.match(src, /error\.status=response\.status/, 'HTTP authorization failures must retain their status');
assert.match(src, /if\(e\?\.status===401\|\|e\?\.status===403\)signOut\(\)/, 'expired/revoked sessions must sign out');
assert.ok(src.includes('sessionGeneration.current+=1;abortPendingRequests();setToken('), 'sign-out must invalidate pending responses and cancel in-flight requests');
assert.match(src, /const signOut=\(\)=>\{[^}]*setEmail\(""\);setPassword\(""\);/, 'sign-out must erase the administrator email identifier and password from the shared-device form');
assert.match(src, /setReady\(false\);setItems\(\[\]\);try\{const r=await cancellableRequest/, 'refresh must hide previously loaded private mail');
assert.match(src, /if\(generation!==sessionGeneration\.current\)return/, 'stale async responses must not repopulate private mail');
assert.match(src, /Number\(s\.expires_in\)/, 'sign-in must validate server session lifetime');
assert.match(src, /const newExpiresAt=Date\.now\(\)\+expiresIn\*1000;setToken\(s\.access_token\);setExpiresAt\(newExpiresAt\);await load\(s\.access_token,newExpiresAt\)/, 'fresh sign-in must use newly issued expiry when loading mail');
assert.match(src, /finally\{if\(generation===sessionGeneration\.current\)\{setPassword\(""\);setLoading\(false\);\}\}\};\s*const markRead=/, 'password must be cleared after failed and successful login attempts');
assert.match(src, /setTimeout\(\(\)=>signOut\(\),Math\.max\(0,expiresAt-Date\.now\(\)\)\)/, 'expired session must automatically clear private messages');
assert.match(src, /return \(\)=>clearTimeout\(timer\)/, 'expiry timer must be cleared on sign-out and unmount');
assert.match(src, /sessionExpired=\(at=expiresAt\)=>Boolean\(at\)&&Date\.now\(\)>=at/, 'client must reject expired session actions');
assert.match(src, /load=async\(t=token,expiry=expiresAt\)=>\{if\(sessionExpired\(expiry\)\)\{signOut\(\);return;\}/, 'refresh must validate the token lifetime it was passed');
assert.match(src, /markRead=async\(item\)=>\{if\(sessionExpired\(\)\)\{signOut\(\);return;\}/, 'mail updates must not use an expired token');
assert.match(src, /window\.addEventListener\("focus",checkExpiry\)/, 'returning to tab must recheck expiry');
assert.match(src, /document\.addEventListener\("visibilitychange",checkExpiry\)/, 'tab visibility must recheck expiry');
assert.match(src, /window\.removeEventListener\("focus",checkExpiry\)/, 'focus listener must be cleaned up');
assert.match(src, /document\.removeEventListener\("visibilitychange",checkExpiry\)/, 'visibility listener must be cleaned up');
const expirySource = src.match(/const sessionExpired=\(at=expiresAt\)=>Boolean\(at\)&&Date\.now\(\)>=at;/)?.[0];
assert.ok(expirySource, 'expiry helper must accept an explicit session lifetime');
const expiryContext = { expiresAt: Date.now() - 1000, Date };
vm.runInNewContext(expirySource + ';globalThis.testExpiry=sessionExpired;', expiryContext);
assert.equal(expiryContext.testExpiry(), true, 'old session must be expired');
assert.equal(expiryContext.testExpiry(Date.now() + 60000), false, 'new session must not inherit stale expiry');
const requestSource = src.slice(src.indexOf('const base='), src.indexOf('export default function'));
async function checkResponse(status) {
  const context = { fetch: async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({ messages: [] }) }) };
  vm.runInNewContext(requestSource + ';globalThis.testRequest=request;', context);
  return context.testRequest('/functions/v1/ifund-admin-mailbox', { headers: { authorization: 'Bearer test' } });
}
for (const status of [401, 403, 503]) {
  await assert.rejects(checkResponse(status), error => error.status === status, 'request must expose HTTP status ' + status);
}
assert.equal((await checkResponse(200)).messages.length, 0);
assert.match(src, /const signOut=\(\)=>\{sessionGeneration\.current\+=1;abortPendingRequests\(\);/, 'sign-out must abort outstanding network requests');
assert.match(src, /useEffect\(\(\)=>\(\)=>\{sessionGeneration\.current\+=1;abortPendingRequests\(\);\},\[\]\)/, 'unmount must abort outstanding network requests');
for (const route of ['const r=await cancellableRequest(', 'const s=await cancellableRequest(', 'try{await cancellableRequest(']) assert.ok(src.includes(route), 'mailbox network operations must be cancellable: ' + route);
const cancelLines = src.split('\n').filter(line => line.includes('const cancellableRequest=') || line.includes('const abortPendingRequests='));
assert.equal(cancelLines.length, 2, 'request cancellation helpers must be present');
const cancelContext = {
  AbortController,
  activeRequests: { current: new Set() },
  request: async (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  })
};
vm.runInNewContext(cancelLines.join('\n') + '\n globalThis.testCancel=cancellableRequest;globalThis.testAbort=abortPendingRequests;', cancelContext);
const pending = cancelContext.testCancel('/functions/v1/ifund-admin-mailbox');
assert.equal(cancelContext.activeRequests.current.size, 1, 'pending requests must be tracked');
cancelContext.testAbort();
await assert.rejects(pending, /aborted/, 'sign-out must cancel in-flight requests');
assert.equal(cancelContext.activeRequests.current.size, 0, 'canceled requests must not remain tracked');
console.log('PASS: independent mailbox cancels pending requests, clears unauthorized sessions, ignores stale responses, and preserves HTTP statuses.');
