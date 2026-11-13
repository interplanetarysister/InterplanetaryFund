import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/pages/AdminFinance.jsx", import.meta.url), "utf8");
test("admin payout queue fails closed instead of presenting errors as no pending withdrawals", () => {
  assert.match(src, /payoutQueue:null,operational:null/);
  assert.match(src, /const queueRows = !payoutQueue\.error && Array\.isArray\(payoutQueue\.data\) \? payoutQueue\.data : null/);
  assert.match(src, /payoutQueue:!queue\.error&&Array\.isArray\(queue\.data\)\?queue\.data:null/);
  assert.match(src, /state\.payoutQueue===null \? <p role="alert"/);
  assert.match(src, /Withdrawal queue could not be verified/);
  assert.doesNotMatch(src, /payoutQueue\.data \? payoutQueue\.data : \[\]/);
});
test("operational counters do not interpret missing values or arbitrary strings as verified zero", () => {
  const start = src.indexOf("const operationalCount = ");
  const end = src.indexOf(";\n", start);
  assert.ok(start >= 0 && end > start);
  const formatter = new Function(src.slice(start, end).replace("const operationalCount = ", "return "))();
  for (const value of [null, undefined, "", " ", "1e2", "0.0", false, [], {}, "-1", -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatter(value), "Unavailable", String(value));
  }
  assert.equal(formatter(0), "0");
  assert.equal(formatter("0"), "0");
  assert.equal(formatter(14), "14");
});
