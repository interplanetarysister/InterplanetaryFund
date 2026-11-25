import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CAMPAIGN_WORKSPACE_TABS, tabForWorkspaceField, tabForValidationProblem,
} from "../src/lib/campaignWorkspaceTabs.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 4 (2026-11-25): unified Campaign Workspace (40-page list, page 19).
// The single-page editor moved into tab panels at /workspace/campaign/:id;
// /campaigns/:id/edit stays as a compatibility redirect.

test("workspace tabs are exactly the nine approved tabs, in order", () => {
  assert.deepEqual(
    CAMPAIGN_WORKSPACE_TABS.map((tab) => tab.label),
    ["Story", "Media", "Updates", "Goals", "Finance Tasks", "Spending", "Tasks", "Growth", "Missions"],
  );
  assert.equal(new Set(CAMPAIGN_WORKSPACE_TABS.map((tab) => tab.id)).size, 9);
  const page = read("src/pages/CampaignWorkspace.jsx");
  for (const tab of CAMPAIGN_WORKSPACE_TABS) {
    assert.ok(page.includes(`id="workspace-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="workspace-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /id=\{`workspace-tab-\$\{item\.id\}`\}/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
});

test("deep-link hashes switch to the tab holding the target field", () => {
  assert.equal(tabForWorkspaceField("campaign-title"), "story");
  assert.equal(tabForWorkspaceField("campaign-summary"), "story");
  assert.equal(tabForWorkspaceField("campaign-story"), "story");
  assert.equal(tabForWorkspaceField("campaign-goal"), "goals");
  assert.equal(tabForWorkspaceField("campaign-atlas-location"), "media");
  assert.equal(tabForWorkspaceField("campaign-cover"), "media");
  assert.equal(tabForWorkspaceField("campaign-unknown"), null);
  assert.equal(tabForWorkspaceField(""), null);
  const page = read("src/pages/CampaignWorkspace.jsx");
  assert.match(page, /tabForWorkspaceField\(targetId\)/);
  assert.match(page, /setTab\(targetTab\)/);
  assert.match(page, /field\.focus\(\{ preventScroll: true \}\)/);
  assert.match(page, /useLocation\(\)/);
});

test("validation failure switches to the tab containing the problem field", () => {
  assert.equal(tabForValidationProblem("Add a campaign title."), "story");
  assert.equal(tabForValidationProblem("Keep the short description to 600 characters or fewer."), "story");
  assert.equal(tabForValidationProblem("Add your campaign story before publishing."), "story");
  assert.equal(tabForValidationProblem("Choose a valid campaign category."), "story");
  assert.equal(tabForValidationProblem("Enter the fundraising goal in USD with up to two decimal places."), "goals");
  assert.equal(tabForValidationProblem("Enter a fundraising goal greater than zero."), "goals");
  assert.equal(tabForValidationProblem("Set a fundraising goal before publishing."), "goals");
  assert.equal(tabForValidationProblem("The cover image link is too long."), "media");
  assert.equal(tabForValidationProblem("Enter a valid http or https cover image link."), "media");
  assert.equal(tabForValidationProblem("For public Atlas placement, use a broad city or region name (2–80 characters), never an address, unit, or ZIP code."), "media");
  assert.equal(tabForValidationProblem("Use approximate public latitude and longitude with at most one decimal place. Never use an exact home address."), "media");
  const page = read("src/pages/CampaignWorkspace.jsx");
  assert.match(page, /setTab\(targetTab\)/);
  assert.match(page, /tabForValidationProblem\(problems\[0\]\)/);
  assert.match(page, /tabForValidationProblem\(readiness\.missing\[0\]\)/);
});

test("the workspace route is member-gated and the old edit route redirects to it", () => {
  const app = read("src/App.jsx");
  assert.match(app, /path="\/workspace\/campaign\/:id" element=\{<MemberAccess><CampaignWorkspace \/><\/MemberAccess>\}/);
  assert.match(app, /path="\/campaigns\/:id\/edit" element=\{<MemberAccess><EditCampaign \/><\/MemberAccess>\}/);
  assert.match(app, /import\("\.\/pages\/CampaignWorkspace"\)/);
  const redirect = read("src/pages/EditCampaign.jsx");
  assert.match(redirect, /to=\{`\/workspace\/campaign\/\$\{encodeURIComponent\(id \|\| ""\)\}\$\{location\.search\}\$\{location\.hash\}`\}/);
  assert.match(redirect, /<Navigate[^>]+replace/);
  assert.doesNotMatch(redirect, /loadOwnerCampaign|saveOwnerCampaign|validateCampaignForm/);
  const manifest = JSON.parse(read("ci/route-acceptance.json"));
  const entry = manifest.routes.find((route) => route.route === "/workspace/campaign/:id");
  assert.ok(entry, "workspace route missing from acceptance ledger");
  assert.equal(entry.component, "CampaignWorkspace");
  assert.equal(entry.role, "member");
  assert.ok(manifest.routes.some((route) => route.route === "/campaigns/:id/edit"),
    "compatibility redirect route must stay in the ledger");
});

test("the workspace keeps the editor's save/publish/pause/conflict behavior", () => {
  const page = read("src/pages/CampaignWorkspace.jsx");
  for (const piece of [
    /loadOwnerCampaign/, /saveOwnerCampaign/, /setCampaignStatus/, /isCampaignConflict/,
    /if \(isCampaignConflict\(cause\)\) load\(\);/, /AgentAdviceReview[^>]+onApply=\{text =>/,
    /<WritingDraftReview/, /<CampaignDocuments/, /<CampaignReadinessScore/,
    /<PrepublicationGate/, /onApplyFields=\{/, /campaign-atlas-location/,
    /id="campaign-title"/, /id="campaign-summary"/, /id="campaign-story"/,
    /id="campaign-goal"/, /id="campaign-cover"/,
  ]) assert.match(page, piece, String(piece));
  assert.doesNotMatch(page, /base44Client|base44\.functions|base44\.entities/);
  assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
  // The action bar lives outside the tab panels, so it is reachable from
  // every tab.
  assert.ok(page.indexOf('type="submit"') > page.indexOf('workspace-panel-missions'),
    "action bar must render after every tab panel");
  const layout = read("src/components/Layout.jsx");
  assert.match(layout, /pathname\.startsWith\("\/workspace\/campaign\/"\)\) return "Campaign Workspace"/);
});

test("Missions tab is labeled private and visibly separated from the public campaign", () => {
  const page = read("src/pages/CampaignWorkspace.jsx");
  assert.match(page, /aria-label="Private Missions"/);
  assert.match(page, /<LockKeyhole/);
  assert.match(page, />Private</);
  assert.match(page, /Missions are private goals, kept separate from this public campaign\. A Mission never publishes a fundraiser on its own\./);
  assert.match(page, /border-cyan-500\/40/);
  assert.match(page, /listMissionCampaignLinks/);
  assert.match(page, /listMissionTasks/);
  assert.match(page, /setMissionTaskState/);
  assert.match(page, /to="\/missions"/);
  assert.match(page, /to="\/what-if"/);
  assert.match(page, /No private Missions are linked to this campaign yet\./);
});

test("Updates, Finance Tasks and Spending tabs contain no fabricated data", () => {
  const page = read("src/pages/CampaignWorkspace.jsx");
  assert.match(page, /Campaign updates are shared through IFund Social\. This workspace does not keep a separate updates list, so there is no update history to show here\./);
  assert.match(page, /to="\/social"/);
  assert.match(page, /Open the social composer/);
  assert.match(page, /Finance tasks are not yet tracked for this campaign\./);
  assert.match(page, /Spending is not yet tracked for this campaign\./);
  assert.match(page, /No spending entries have been recorded for this campaign, so there is nothing to show here\./);
  // Donation totals come only from the verified public read; unpublished
  // campaigns show an explicit not-published state, never zeros.
  assert.match(page, /getCampaignDetail/);
  assert.match(page, /Verified donation totals will appear here once this campaign is published and active\./);
  assert.match(page, /Totals count provider-verified gifts only\./);
  assert.doesNotMatch(page, /sample update|example update|demo update|lorem/i);
  assert.doesNotMatch(page, /fake spending|sample spending|example spending/i);
});

test("Growth tab keeps agent advice review and links to Strategy and Analytics", () => {
  const page = read("src/pages/CampaignWorkspace.jsx");
  assert.match(page, /searchParams\.get\("agentAdvice"\)/);
  assert.match(page, /to="\/strategy"/);
  assert.match(page, /to="\/analytics"/);
  assert.match(page, /Open Campaign Strategy/);
  assert.match(page, /Open Analytics/);
  assert.match(page, /to="\/ai-images"/);
  assert.match(page, /AI Image Studio/);
});
