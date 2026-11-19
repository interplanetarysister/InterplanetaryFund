import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const boundary = readFileSync(new URL("../src/components/ErrorBoundary.jsx", import.meta.url), "utf8");
test("route crashes recover in an accessible alert region with clear actions", () => {
  assert.match(boundary, /<section role="alert" aria-labelledby="ifund-route-error-heading"/);
  assert.match(boundary, /id="ifund-route-error-heading"/);
  assert.match(boundary, /This page could not finish loading/);
  assert.match(boundary, /href="\/help"/);
  assert.match(boundary, /href="\/"/);
  assert.match(boundary, /onClick=\{this\.reset\}/);
});
test("failed asset imports retain explicit refresh recovery and do not alter saved work", () => {
  assert.match(boundary, /isAssetLoadFailure\(this\.state\.error\)/);
  assert.match(boundary, /window\.location\.reload\(\)/);
  assert.match(boundary, /Your saved work is not intentionally changed/);
  assert.doesNotMatch(boundary, /localStorage\.clear|sessionStorage\.clear|signOut\(/);
});
