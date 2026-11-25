import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOwnerSessionGuard } from '../src/lib/ownerSessionGuard.js';
import { createAdminReviewSession, runAdminReview } from '../src/lib/adminReviewSession.js';
import { confirmWithdrawalFactor } from '../src/lib/withdrawalMfa.js';
const user = id => ({ id, email_confirmed_at: '2026-11-16T00:00:00Z', is_anonymous: false });
function authHarness() {
  let current = user('A');
  const listeners = new Set();
  const auth = { getUser: async () => ({ data: { user: current }, error: null }),
    onAuthStateChange: listener => { listeners.add(listener); return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }; } };
  return { auth, change(id) { current = user(id); for (const listener of listeners) listener('SIGNED_IN', { user: current }); } };
}

test('owner auth event between precheck resolution and operation prevents the mutation', async () => {
  const h = authHarness(), guard = createOwnerSessionGuard(h.auth, 'A');
  let writes = 0;
  const task = guard.run(() => { writes += 1; });
  queueMicrotask(() => queueMicrotask(() => h.change('B')));
  await assert.rejects(task, /account changed/);
  assert.equal(writes, 0);
  guard.dispose();
});

test('admin auth event between precheck resolution and operation prevents the mutation', async () => {
  const h = authHarness(), scope = createAdminReviewSession();
  scope.bind('A');
  let writes = 0;
  const task = runAdminReview(scope, { auth: h.auth }, () => { writes += 1; });
  queueMicrotask(() => { h.change('B'); scope.observe('B'); });
  await assert.rejects(task, /session changed/);
  assert.equal(writes, 0);
});

test('actual admin dependency consumer rejects an auth event after helper resolution', async () => {
  const h = authHarness(), scope = createAdminReviewSession();
  scope.bind('A');
  let exposed = null;
  const source = readFileSync(new URL('../src/pages/AdminDeletionQueue.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  async function inspectDependencies(row){');
  const end = source.indexOf('\n  async function act(', start);
  assert.ok(start >= 0 && end > start);
  const args = { reviewScope: { current: scope }, authClient: () => ({ auth: h.auth,
    rpc: async () => ({ data: { open_request: true, safe_to_erase: false, private: 'A-only snapshot' }, error: null }) }),
    runAdminReview: (...input) => {
      const task = runAdminReview(...input);
      task.then(() => { h.change('B'); scope.observe('B'); });
      return task;
    }, setDependencyBusy() {}, setDependencyIssue() {},
    setDependencySnapshot: update => { exposed = typeof update === 'function' ? update({}) : update; } };
  const inspect = new Function(...Object.keys(args), source.slice(start, end) + ';return inspectDependencies;')(...Object.values(args));
  await inspect({ request_id: 'request-A' });
  assert.equal(exposed, null);
});

test('actual withdrawal balance consumer rejects an auth event after helper resolution', async () => {
  const h = authHarness(), guard = createOwnerSessionGuard(h.auth, 'A');
  let exposed = null;
  const source = readFileSync(new URL('../src/pages/WithdrawalVerification.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const refresh=useCallback(async()=>{');
  const end = source.indexOf('\n  },[runForOwner,assertOwnerCurrent]);', start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start + '  const refresh=useCallback(async()=>{'.length, end);
  const args = { authClient: () => ({ rpc: async () => ({ data: [], error: null }) }),
    runForOwner: operation => {
      const task = guard.run(operation);
      task.then(() => h.change('B'));
      return task;
    }, assertOwnerCurrent: () => guard.assertActive(), setState: value => { exposed = value; } };
  const refresh = new Function(...Object.keys(args), 'return async()=>{' + body + '};')(...Object.values(args));
  await assert.rejects(refresh(), /account changed/);
  assert.equal(exposed, null);
  guard.dispose();
});

test('MFA scoped challenge cannot start after a precheck microtask changes the owner', async () => {
  const h = authHarness();
  let challenges = 0;
  h.auth.mfa = { challenge: async () => { challenges += 1; return { data: { id: 'challenge-A' } }; } };
  const task = confirmWithdrawalFactor(h.auth, user('A'), 'factor-A', '123456');
  queueMicrotask(() => queueMicrotask(() => h.change('B')));
  await assert.rejects(task, /account changed/);
  assert.equal(challenges, 0);
});

test('MFA account switch away and back permanently invalidates the verification sequence', async () => {
  const h = authHarness();
  let verifications = 0;
  h.auth.mfa = {
    challenge: async () => { h.change('B'); h.change('A'); return { data: { id: 'challenge-A' } }; },
    verify: async () => { verifications += 1; return { data: {} }; },
  };
  await assert.rejects(confirmWithdrawalFactor(h.auth, user('A'), 'factor-A', '123456'), /account changed/);
  assert.equal(verifications, 0);
});

test('actual MFA enrollment consumer never publishes a secret after helper resolution changes owner', async () => {
  const h = authHarness(), guard = createOwnerSessionGuard(h.auth, 'A');
  let exposed = null;
  const source = readFileSync(new URL('../src/pages/WithdrawalVerification.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  async function beginEnrollment() {');
  const end = source.indexOf('\n  async function restartEnrollment(', start);
  assert.ok(start >= 0 && end > start);
  const args = { busy: false, setBusy() {}, setError() {}, setState() {},
    authClient: () => ({ auth: { mfa: { listFactors: async () => ({ data: { all: [] } }), enroll: async () => ({ data: { id: 'factor-A', totp: { secret: 'A-only secret' } } }) } } }),
    runForOwner: operation => {
      const task = guard.run(operation);
      task.then(() => h.change('B'));
      return task;
    }, assertOwnerCurrent: () => guard.assertActive(),
    ownerIsCurrent: () => { try { guard.assertActive(); return true; } catch { return false; } },
    setEnrollment: value => { exposed = value; } };
  const enroll = new Function(...Object.keys(args), source.slice(start, end) + ';return beginEnrollment;')(...Object.values(args));
  await enroll();
  assert.equal(exposed, null);
  guard.dispose();
});
