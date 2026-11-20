import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatUsdCents as formatter } from "../src/lib/formatUsdCents.mjs";

test("financial reporting never silently displays missing or invalid values as zero", () => {
  for (const amount of [null, undefined, "", " ", false, true, NaN, Infinity, -1, 1.2, "1.2", "1e2", {}, []]) {
    assert.equal(formatter(amount), "Not reported", String(amount));
  }
});

test("zero and integer cent values remain accurate", () => {
  assert.equal(formatter(0), "$0.00");
  assert.equal(formatter("0"), "$0.00");
  assert.equal(formatter(100), "$1.00");
  assert.equal(formatter("125"), "$1.25");
  assert.equal(formatter(123456), "$1,234.56");
});

test("financial dashboards use the guarded formatter", () => {
  for (const path of ["AdminFinance.jsx", "FinanceDashboard.jsx"]) {
    const file = readFileSync(new URL("../src/pages/" + path, import.meta.url), "utf8");
    assert.match(file, /formatUsdCents/);
    assert.doesNotMatch(file, /Number\(n\)[\s\S]{0,80}Number\.isSafeInteger/);
  }
});
