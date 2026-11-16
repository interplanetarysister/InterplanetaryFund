import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("verified owner changes fail closed without relying on parent remount", () => {
  assert.match(source, /initialOwnerId\.current !== ownerId/);
  assert.match(source, /privacyDecisionPending = guestDecisionPending \|\| ownerTransitionPending/);
  assert.match(source, /if \(!storageReadable \|\| privacyDecisionPending \|\| draftId/);
  assert.match(source, /Boolean\(!storageReadable \|\| privacyDecisionPending \|\| busy/);
  assert.match(source, /if \(ownerTransitionPending\) return; \/\/ No consent/);
});

test("guest decision blocks both writing entry points during identity transition", () => {
  assert.equal((source.match(/if \(privacyDecisionPending \|\| writingLock\.current/g) || []).length, 2);
});
