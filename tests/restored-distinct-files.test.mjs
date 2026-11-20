import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";

const root = new URL("../", import.meta.url);
const file = path => readFileSync(new URL(path, root), "utf8");
const restored = [
  ".github/copilot-instructions.md","BUILD_AGENT_RULES.md","PRODUCT_SYSTEM_CONTRACT.md",
  "docs/migration/BACKEND_REPAIR_AUDIT_2026-10-29.md",
  "docs/migration/BUILD_PREPARATION_2026-10-29.md",
  "docs/migration/contracts/android.json",
  "docs/migration/contracts/automations.json",
  "docs/migration/contracts/entities.json",
  "docs/migration/contracts/functions.json",
  "docs/migration/contracts/launch-evidence.json",
  "docs/migration/contracts/schema-type-crosswalk.json",
  "docs/migration/role-platform-evidence.json",
  "docs/agents/ASSETS_TOOLS_AND_COMPLETION.md",
  "docs/agents/COMMUNICATIONS_PREVIEW.md",
  "docs/agents/GROWTH_PREVIEW.md",
  "docs/agents/PRODUCTION_RELEASE.md",
  "docs/agents/STRATEGY_PREVIEW.md",
  "docs/BASE44_UI_PARITY_IMPLEMENTATION.md",
  "tests/browser/communications-preview.py",
  "tests/browser/growth-preview.py",
  "tests/browser/strategy-preview.py",
  "tests/browser/run-communications-preview.py",
  "tests/browser/run-growth-preview.py",
  "tests/browser/run-strategy-preview.py",
  "apps/web/src/components/CommunicationPreferences.jsx",
  "apps/web/src/lib/communicationPreferences.js",
  "apps/web/tests/communication-preferences.test.js"
];

test("all 27 distinct-purpose historical files stay in their original locations", () => {
  assert.equal(restored.length,27);
  for(const path of restored) assert.ok(existsSync(new URL(path,root)), "Missing restored file: "+path);
});

test("restored migration inventory preserves its unique contracts without declaring them live", () => {
  const count = (p,k) => JSON.parse(file(p))[k].length;
  assert.equal(count("docs/migration/contracts/functions.json","items"),184);
  assert.equal(count("docs/migration/contracts/entities.json","items"),95);
  assert.equal(count("docs/migration/contracts/automations.json","workflows"),17);
  assert.equal(count("docs/migration/role-platform-evidence.json","pages"),59);
  assert.match(file("docs/operations/HISTORICAL_FILE_RESTORATION_AUDIT_20261120.md"),/historical records/i);
});

test("supporter updates are separate from marketing and preserve owner-scoped preference CAS", () => {
  const page=file("apps/web/src/pages/ManagePermissions.jsx");
  const helper=file("apps/web/src/lib/communicationPreferences.js");
  const migration=file("supabase/migrations/20261103192435_ifund_communications_preferences_20261103.sql");
  assert.match(page, /import CommunicationPreferences/);
  assert.match(page,/supporter-updates/);
  assert.match(page, /open==="supporter-updates" && <CommunicationPreferences\s*\/>/);
  assert.match(helper, /ifund_profiles/);
  assert.match(helper, /\.eq\("id", id\)/);
  assert.match(helper, /\.eq\("comm_prefs", JSON\.stringify\(snapshot\.values\)\)/);
  assert.match(migration, /GRANT SELECT \(comm_prefs\), UPDATE \(comm_prefs\)/);
  assert.doesNotMatch(page, /open==="marketing" && <CommunicationPreferences/);
});

test("recovered builder instructions point to current platform rather than retired runtimes", () => {
  const files=[".github/copilot-instructions.md","PRODUCT_SYSTEM_CONTRACT.md"];
  for(const path of files) {
    const contents=file(path);
    assert.match(contents,/Cloudflare/);
    assert.match(contents,/Supabase/);
    assert.match(contents,/Convex/);
    assert.match(contents,/retired|not active|not be restarted/i);
  }
  assert.match(file("BUILD_AGENT_RULES.md"),/Never delete, deduplicate, move or overwrite/);
  assert.match(file("docs/operations/IFUND_STANDING_OWNER_RULES_20261120.md"),/^61\. /m);
});

test("owner-only preferences grant reconciliation is source-controlled and fail-closed", () => {
  const sql=file("supabase/migrations/20261120123320_ifund_restore_owner_communication_preference_update_grant_20261120.sql");
  assert.match(sql, /GRANT UPDATE \(comm_prefs\) ON TABLE public\.ifund_profiles TO authenticated/);
  assert.match(sql, /permissive='RESTRICTIVE'/);
  assert.match(sql, /ifund_profiles_update/);
  assert.match(sql, /ifund_current_account_is_active/);
  assert.match(sql, /REVOKE UPDATE \(comm_prefs\) ON TABLE public\.ifund_profiles FROM PUBLIC, anon/);
  assert.doesNotMatch(sql, /GRANT UPDATE ON TABLE public\.ifund_profiles/i);
});
