import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// FinanceDataGrid contains JSX, so evaluate only its pure amount formatter.
const gridSource = readFileSync(new URL("../src/components/finance/FinanceDataGrid.jsx", import.meta.url), "utf8");
const begin = gridSource.indexOf("export const formatUsdCents = ");
const end = gridSource.indexOf("\nexport default function FinanceDataGrid(", begin);
assert.ok(begin >= 0 && end > begin, "finance formatter must remain exported");
const formatterSource = gridSource.slice(begin, end).replace("export const formatUsdCents =", "const formatUsdCents =");
const formatter = new Function(formatterSource + "\nreturn formatUsdCents;")();

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
