import test from "node:test";
import assert from "node:assert/strict";
import { TERMS_VERSION } from "../src/lib/legalPolicy.js";
import { PENDING_SIGNUP_AGREEMENT, rememberSignupAgreement, recordLegalAcceptance, finalizeSignupAgreement } from "../src/lib/legalAcceptance.js";

function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key) };
}
function clientFor(userId, options = {}) {
  let saved = options.existing ? { owner_id: userId, terms_version: TERMS_VERSION, explicit_consent: true } : null;
  let inserts = 0;
  return { get inserts() { return inserts; }, from(table) {
    assert.equal(table, "ifund_legal_acceptances");
    return { select() { return { eq() { return this; }, async maybeSingle() { return { data: saved, error: null }; } }; },
      async insert(row) { inserts++; assert.equal(row.owner_id, userId);
        assert.equal(row.terms_version, TERMS_VERSION);
        assert.equal(row.explicit_consent, true);
        if (options.error) return { error: options.error };
        saved = { ...row }; return { error: null }; } };
  } };
}
const user = { id: "user-1", email: "person@example.com", email_confirmed_at: "2026-11-10T20:00:00Z" };

test("a confirmed signup records the current version once", async () => {
  const db = clientFor(user.id);
  assert.equal(await recordLegalAcceptance(db, user), true);
  assert.equal(await recordLegalAcceptance(db, user), true);
  assert.equal(db.inserts, 1);
});
test("no acceptance without verified email", async () => {
  const db = clientFor(user.id);
  await assert.rejects(recordLegalAcceptance(db, { ...user, email_confirmed_at: null }));
  assert.equal(db.inserts, 0);
});
test("an acceptance attempt is limited to matching email and current policy", async () => {
  const store = storage();
  rememberSignupAgreement(store, "  PERSON@EXAMPLE.COM  ");
  const db = clientFor(user.id);
  assert.equal(await finalizeSignupAgreement(db, { ...user, email: "different@example.com" }, store), false);
  assert.equal(db.inserts, 0);
  assert.equal(await finalizeSignupAgreement(db, user, store), true);
  assert.equal(store.getItem(PENDING_SIGNUP_AGREEMENT), null);
});
test("failed inserts remain pending and never claim success", async () => {
  const store = storage(); rememberSignupAgreement(store, user.email);
  const db = clientFor(user.id, { error: { code: "42501", message: "Permission denied" } });
  await assert.rejects(finalizeSignupAgreement(db, user, store));
  assert.ok(store.getItem(PENDING_SIGNUP_AGREEMENT));
});
