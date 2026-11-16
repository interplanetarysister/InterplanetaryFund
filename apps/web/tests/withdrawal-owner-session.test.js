import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOwnerSessionGuard, observeWithdrawalIdentity } from "../src/lib/ownerSessionGuard.js";
import { confirmWithdrawalFactor } from "../src/lib/withdrawalMfa.js";

const member = id => ({ id, email_confirmed_at: "2026-11-16T00:00:00Z", is_anonymous: false });
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function authHarness() {
  let user = member("A");
  const listeners = new Set();
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange(listener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe() { listeners.delete(listener); } } } };
    },
  };
  return { auth, setUser(next, notify = true) { user = next; if (notify) for (const listener of listeners) listener("SIGNED_IN", next ? { user: next } : null); } };
}

test("a late withdrawal balance response is rejected and the old owner scope is cleared", async () => {
  const h = authHarness(), work = deferred();
  let cleared = 0;
  const guard = createOwnerSessionGuard(h.auth, "A", () => { ++cleared; });
  const pending = guard.run(() => work.promise);
  const rejected = assert.rejects(pending, /account changed/);
  await tick();
  h.setUser(member("B"));
  assert.equal(cleared, 1, "private data is cleared before the stale RPC finishes");
  work.resolve({ recipient_email: "private-A@example.test" });
  await rejected;
  let invoked = false;
  await assert.rejects(guard.run(() => { invoked = true; }), /account changed/);
  assert.equal(invoked, false, "old-owner controls cannot start a new operation");
  guard.dispose();
});

test("owner scope verifies the current account before a withdrawal action and after its receipt", async () => {
  const h = authHarness();
  let invoked = false;
  const guard = createOwnerSessionGuard(h.auth, "A");
  h.setUser(member("B"), false);
  await assert.rejects(guard.run(() => { invoked = true; }), /account changed/);
  assert.equal(invoked, false);
  guard.dispose();
});

test("unmount invalidates a pending MFA enrollment secret", async () => {
  const h = authHarness(), enrollment = deferred();
  const guard = createOwnerSessionGuard(h.auth, "A");
  const pending = guard.run(() => enrollment.promise);
  const rejected = assert.rejects(pending, /account changed/);
  await tick();
  guard.dispose();
  enrollment.resolve({ secret: "do-not-show-after-unmount" });
  await rejected;
});

test("same owner token refresh preserves a valid withdrawal scope", async () => {
  const h = authHarness();
  const guard = createOwnerSessionGuard(h.auth, "A");
  h.setUser(member("A"));
  assert.equal(await guard.run(async () => "confirmed-receipt"), "confirmed-receipt");
  guard.dispose();
});

test("newer identity events cannot be overwritten by the initial withdrawal getUser response", async () => {
  const h = authHarness(), initial = deferred(), states = [];
  h.auth.getUser = () => initial.promise;
  const stop = observeWithdrawalIdentity(h.auth, state => states.push(state));
  h.setUser(member("B"));
  initial.resolve({ data: { user: member("A") }, error: null });
  await tick();
  assert.equal(states.at(-1).user.id, "B");
  assert.equal(states.length, 1);
  stop();
});

test("an owner change after MFA challenge prevents verification under another account", async () => {
  const h = authHarness();
  let verified = false;
  h.auth.mfa = {
    challenge: async () => { h.setUser(member("B")); return { data: { id: "A-challenge" } }; },
    verify: async () => { verified = true; return { data: {} }; },
  };
  await assert.rejects(confirmWithdrawalFactor(h.auth, member("A"), "A-factor", "123456"), /account changed/);
  assert.equal(verified, false);
});

test("withdrawal page remounts the MFA subtree per owner and guards each sensitive RPC", () => {
  const source = readFileSync(new URL("../src/pages/WithdrawalVerification.jsx", import.meta.url), "utf8");
  assert.match(source, /WithdrawalMfaGate key=\{state\.user\.id\}/);
  assert.match(source, /observeWithdrawalIdentity\(authClient\(\)\.auth, setState\)/);
  for (const rpc of ["ifund_connect_paypal_payout_to_verified_email", "ifund_disconnect_paypal_payout_destination", "ifund_request_withdrawal", "ifund_cancel_withdrawal_request"])
    assert.ok(source.includes('runForOwner(()=>authClient().rpc("' + rpc + '"'), rpc);
  const hook = readFileSync(new URL("../src/hooks/useAdminAccess.js", import.meta.url), "utf8");
  assert.match(hook, /verification\.ownerId === ownerId \? verification\.status/);
  assert.match(hook, /after\.data\?\.user\?\.id !== ownerId/);
});
