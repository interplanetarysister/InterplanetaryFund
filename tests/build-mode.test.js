import test from "node:test";
import assert from "node:assert/strict";
import { resolveBuildGateMode } from "../scripts/verify-build-mode.mjs";

test("Cloudflare Pages feature branches use inventory-only preview gate", () => {
  assert.equal(resolveBuildGateMode({ CF_PAGES: "1", CF_PAGES_BRANCH: "feature/campaign-fix" }), "--inventory");
});

test("Cloudflare Pages main branch retains strict production evidence gate", () => {
  assert.equal(resolveBuildGateMode({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" }), "--build");
});

test("local builds retain strict production evidence gate", () => {
  assert.equal(resolveBuildGateMode({}), "--build");
});

test("unknown Pages branch context fails closed to strict production gate", () => {
  assert.equal(resolveBuildGateMode({ CF_PAGES: "1" }), "--build");
});
