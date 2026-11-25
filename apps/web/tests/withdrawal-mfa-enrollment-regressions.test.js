import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Execute the real event handler rather than a reimplementation of its behavior.
// These tests protect the MFA enrollment path without a payment provider or browser.
const screen = readFileSync(new URL("../src/pages/WithdrawalVerification.jsx", import.meta.url), "utf8");
const start = screen.indexOf("  async function beginEnrollment() {");
const end = screen.indexOf("\n  async function restartEnrollment(", start);
assert.ok(start >= 0 && end > start, "withdrawal enrollment handler must be present");
const handler = screen.slice(start, end);

function runEnrollment({ factors = [], removalError = null, enrollError = null, onEnroll } = {}) {
  const events = [];
  let ownerCurrent = true;
  const auth = {
    mfa: {
      listFactors: async () => ({ data: { all: factors }, error: null }),
      unenroll: async ({ factorId }) => {
        events.push(["unenroll", factorId]);
        return { error: removalError };
      },
      enroll: async options => {
        events.push(["enroll", options]);
        onEnroll?.(() => { ownerCurrent = false; });
        return enrollError
          ? { data: null, error: enrollError }
          : { data: { id: "new-factor", totp: { secret: "private-seed", qr_code: "<svg></svg>" } }, error: null };
      },
    },
  };
  const view = { state: null, factor: null, enrollment: null, error: null };
  const args = {
    busy: false,
    authClient: () => ({ auth }),
    runForOwner: operation => operation(),
    assertOwnerCurrent: () => { if (!ownerCurrent) throw new Error("Your account session changed."); },
    ownerIsCurrent: () => ownerCurrent,
    setBusy() {},
    setError: message => { view.error = message; },
    setState: value => { view.state = value; },
    setFactor: value => { view.factor = value; },
    setEnrollment: value => { view.enrollment = value; },
    setCode() {},
    setCopyNotice() {},
    setQrFailed() {},
    normalizeEnrollmentQr: value => value,
  };
  const beginEnrollment = new Function(...Object.keys(args), handler + "; return beginEnrollment;")(...Object.values(args));
  return { beginEnrollment, events, view };
}

test("verified TOTP is reused without removing or replacing any factor", async () => {
  const factor = { id: "verified-one", status: "verified", factor_type: "totp" };
  const h = runEnrollment({ factors: [
    { id: "incomplete-one", status: "unverified", factor_type: "totp" }, factor,
  ] });
  await h.beginEnrollment();
  assert.equal(h.view.state, "challenge");
  assert.equal(h.view.factor, factor);
  assert.deepEqual(h.events, []);
});

test("abandoned TOTP factors are removed before a uniquely named replacement enrollment", async () => {
  const h = runEnrollment({ factors: [
    { id: "old-one", status: "unverified", factor_type: "totp" },
    { id: "old-two", status: "unverified", factor_type: "totp" },
    { id: "other-type", status: "unverified", factor_type: "phone" },
  ] });
  await h.beginEnrollment();
  assert.deepEqual(h.events.slice(0, 2), [["unenroll", "old-one"], ["unenroll", "old-two"]]);
  assert.equal(h.events.length, 3);
  const options = h.events[2][1];
  assert.equal(h.events[2][0], "enroll");
  assert.equal(options.factorType, "totp");
  assert.equal(options.issuer, "Interplanetary Fund");
  assert.match(options.friendlyName, /^IFund withdrawals [0-9a-f-]{36}$/i);
  assert.equal(h.view.enrollment.id, "new-factor");
  assert.equal(h.view.state, "confirm-enrollment");
  assert.equal(h.view.error, "");
});

test("failed cleanup does not create a duplicate enrollment or show a secret", async () => {
  const h = runEnrollment({
    factors: [{ id: "old-one", status: "unverified", factor_type: "totp" }],
    removalError: new Error("Cannot safely remove abandoned factor"),
  });
  await h.beginEnrollment();
  assert.deepEqual(h.events, [["unenroll", "old-one"]]);
  assert.equal(h.view.enrollment, null);
  assert.match(h.view.error, /Cannot safely remove/);
});

test("account change during enrollment prevents the new MFA secret from reaching state", async () => {
  const h = runEnrollment({ onEnroll: invalidate => invalidate() });
  await h.beginEnrollment();
  assert.equal(h.view.enrollment, null);
  assert.notEqual(h.view.state, "confirm-enrollment");
});

test("provider enrollment failure never exposes or accepts an authenticator", async () => {
  const h = runEnrollment({ enrollError: new Error("Provider declined enrollment") });
  await h.beginEnrollment();
  assert.equal(h.view.enrollment, null);
  assert.equal(h.view.state, null);
  assert.match(h.view.error, /Provider declined/);
});

test("restart clears the abandoned secret and fails closed if factor inspection fails", async () => {
  const current = readFileSync(new URL("../src/pages/WithdrawalVerification.jsx", import.meta.url), "utf8");
  const restartStart = current.indexOf("  async function restartEnrollment() {");
  const restartEnd = current.indexOf("\n  async function copySetupKey(", restartStart);
  assert.ok(restartStart >= 0 && restartEnd > restartStart);
  const events = [];
  const view = { state: "confirm-enrollment", enrollment: { id: "old-one", secret: "old-private-seed" }, error: "" };
  const args = {
    busy: false, enrollment: view.enrollment,
    authClient: () => ({ auth: { mfa: {
      listFactors: async () => ({ data: { all: [{ id: "old-one", status: "unverified", factor_type: "totp" }] } }),
      unenroll: async ({ factorId }) => { events.push(["unenroll", factorId]); return { error: null }; },
    } } }),
    runForOwner: fn => fn(),
    assertOwnerCurrent() {},
    ownerIsCurrent: () => true,
    setBusy() {},
    setError: value => { view.error = value; },
    setState: value => { view.state = value; },
    setEnrollment: value => { view.enrollment = value; },
    setCode() {},
    setCopyNotice() {},
    setQrFailed() {},
    inspect: async () => { throw new Error("MFA inspection unavailable"); },
  };
  const restart = new Function(...Object.keys(args), current.slice(restartStart, restartEnd) + ";return restartEnrollment;")(...Object.values(args));
  await restart();
  assert.deepEqual(events, [["unenroll", "old-one"]]);
  assert.equal(view.enrollment, null);
  assert.equal(view.state, "error");
  assert.match(view.error, /MFA inspection unavailable/);
});
