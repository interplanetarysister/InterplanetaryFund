import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/permissions/AIPermissionPreferences.jsx", import.meta.url), "utf8");

test("one visible AI switch replaces the old permission matrix", () => {
  assert.match(source, /Let iFund AI help me/);
  assert.match(source, /role="switch"/);
  assert.match(source, /What does this include\?/);
  assert.equal((source.match(/type="checkbox"/g) || []).length, 1);
  assert.doesNotMatch(source, /<select/);
});
test("single AI choice updates all existing backend consent flags", () => {
  assert.match(source, /AI_FIELDS\.map\(field => \[field, enabled\]\)/);
  for (const field of ["allow_ai_campaign_drafts", "allow_ai_outreach_drafts", "allow_future_internal_ai_assistance"])
    assert.ok(source.includes(field), field);
  assert.match(source, /default_action: enabled \? "ask" : "manual"/);
});
test("UI requires owner-scoped Supabase save and a confirming read", () => {
  assert.match(source, /client\.auth\.getUser\(\)/);
  assert.match(source, /\.eq\("owner_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(source, /\.upsert\(payload, \{onConflict: "owner_id"\}\)/);
  assert.match(source, /check\.data\[field\] !== enabled/);
  assert.match(source, /Change not saved yet/);
});
