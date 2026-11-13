import test from "node:test";
import assert from "node:assert/strict";
import { sumVerifiedCents } from "../src/lib/verifiedMoney.mjs";

test("verified cents distinguish an empty ledger from unknown values", () => {
  assert.equal(sumVerifiedCents([], "amount"), 0);
  assert.equal(sumVerifiedCents([{ amount: 0 }, { amount: 125 }], "amount"), 125);
  assert.equal(sumVerifiedCents([{ amount: "25" }, { amount: "75" }], "amount"), 100);
  assert.equal(sumVerifiedCents(null, "amount"), null);
  for (const invalid of [null, undefined, "", " ", false, -2, 1.25, "1e2", "1.3", {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(sumVerifiedCents([{ amount: invalid }], "amount"), null);
  }
});

test("verified cents reject unsafe cumulative totals", () => {
  assert.equal(sumVerifiedCents([{ amount: Number.MAX_SAFE_INTEGER }, { amount: 1 }], "amount"), null);
});
