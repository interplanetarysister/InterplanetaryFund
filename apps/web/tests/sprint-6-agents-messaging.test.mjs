import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AGENTS_PAGE_TABS,
  AGENT_MESSAGING_IDS,
  LEGACY_TAB_REDIRECTS,
  MEMBER_TABS,
  agentFromParam,
  agentsRedirectSearch,
  messagingHref,
  tabFromParam,
} from "../src/lib/agentsPage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

// Sprint 6 (2026-11-25): single tabbed Agents — Analysis & Recommendations
// page (40-page list, page 28). Overview / Analytics / Strategy /
// Recommendations / Communications at /agents; /analytics, /strategy and
// /communications stay as compatibility redirects; /messaging stays the
// dedicated agent-conversation route behind the floating sidebar.

test("agents tabs are exactly the five approved tabs, in order, deep-linked by ?tab=", () => {
  assert.deepEqual(
    AGENTS_PAGE_TABS.map((tab) => tab.label),
    ["Overview", "Analytics", "Strategy", "Recommendations", "Communications"],
  );
  assert.deepEqual(
    AGENTS_PAGE_TABS.map((tab) => tab.id),
    ["overview", "analytics", "strategy", "recommendations", "communications"],
  );
  assert.equal(new Set(AGENTS_PAGE_TABS.map((tab) => tab.id)).size, 5);
  assert.equal(tabFromParam("analytics"), "analytics");
  assert.equal(tabFromParam("strategy"), "strategy");
  assert.equal(tabFromParam("recommendations"), "recommendations");
  assert.equal(tabFromParam("communications"), "communications");
  assert.equal(tabFromParam("overview"), "overview");
  assert.equal(tabFromParam(""), "overview");
  assert.equal(tabFromParam("unknown-tab"), "overview");
  assert.equal(tabFromParam(null), "overview");
  const page = read("src/pages/AgentsTeam.jsx");
  for (const tab of AGENTS_PAGE_TABS) {
    assert.ok(page.includes(`id="agents-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="agents-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-label="Agent sections"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /params\.get\("tab"\)/);
  assert.match(page, /nextParams\.set\("tab",tabFromParam\(next\)\)/);
});

test("tab panels reuse the existing pages — reorganisation, not rebuilds", () => {
  const page = read("src/pages/AgentsTeam.jsx");
  assert.match(page, /import AnalyticsCenter from "\.\/AnalyticsCenter"/);
  assert.match(page, /import CampaignStrategy from "\.\/CampaignStrategy"/);
  assert.match(page, /import CommunicationsWorkspace from "\.\/CommunicationsWorkspace"/);
  assert.match(page, /tab === "analytics"[\s\S]*?<AnalyticsCenter \/>/);
  assert.match(page, /tab === "strategy"[\s\S]*?<CampaignStrategy \/>/);
  assert.match(page, /tab === "communications"[\s\S]*?<CommunicationsWorkspace \/>/);
  // The Overview keeps the existing team directory, Ask Mission Control,
  // editorial queue, shared team history and writing studio intact.
  assert.match(page, /filter\(agent => !agent\.consolidatedInto\)/);
  assert.match(page, /Ask Mission Control/);
  assert.match(page, /\{user && <EditorialAgentQueue \/>/);
  assert.match(page, /\{user && <TeamConversationHistory \/>/);
  assert.match(page, /\{user && showWriting &&/);
  // Panels that used to sit behind MemberAccess keep their route-level gate:
  // signed-out visitors get a sign-in card instead of the panel.
  assert.deepEqual([...MEMBER_TABS], ["analytics", "strategy", "recommendations", "communications"]);
  assert.match(page, /function memberTabPanel\(tabId, panel\) \{/);
  assert.match(page, /MEMBER_TABS\.includes\(tab\) && authStatus === "loading"/);
  assert.match(page, /Checking your account…/);
  assert.match(page, /memberTabPanel\("analytics", <AnalyticsCenter \/>\)/);
  assert.match(page, /memberTabPanel\("strategy", <CampaignStrategy \/>\)/);
  assert.match(page, /memberTabPanel\("communications", <CommunicationsWorkspace \/>\)/);
  assert.match(page, /memberTabPanel\("recommendations", <NexusBrief \/>\)/);
  assert.match(page, /to=\{`\/login\?returnTo=\$\{encodeURIComponent\(`\/agents\?tab=\$\{tab\}`\)\}`\}/);
});

test("Recommendations surfaces real analysis and honest unverified states", () => {
  const page = read("src/pages/AgentsTeam.jsx");
  assert.match(page, /tab === "recommendations"[\s\S]*?<NexusBrief \/>/);
  assert.match(page, /built only from your own saved campaigns and verified records/);
  assert.match(page, /Nothing here is invented/);
  assert.match(page, /Direct specialist advisory chat is not yet verified/);
  assert.match(page, /See campaign readiness in Strategy/);
  assert.match(page, /See AI analysis in Analytics/);
  assert.match(page, /onClick=\{\(\) => setTab\("strategy"\)\}/);
  assert.match(page, /onClick=\{\(\) => setTab\("analytics"\)\}/);
});

test("legacy routes redirect to the tabbed page, preserving campaign query and hash", () => {
  assert.deepEqual(LEGACY_TAB_REDIRECTS, {
    "/analytics": "analytics",
    "/strategy": "strategy",
    "/communications": "communications",
  });
  assert.equal(agentsRedirectSearch("analytics", ""), "?tab=analytics");
  assert.equal(
    agentsRedirectSearch("communications", "?campaign=11111111-2222-3333-4444-555555555555"),
    "?campaign=11111111-2222-3333-4444-555555555555&tab=communications",
  );
  assert.equal(agentsRedirectSearch("strategy", "?tab=overview"), "?tab=strategy");
  assert.equal(agentsRedirectSearch("nope", ""), "?tab=overview");
  const app = read("src/App.jsx");
  assert.match(app, /import \{ agentsRedirectSearch \} from "\.\/lib\/agentsPage\.mjs"/);
  assert.match(app, /function LegacyAgentsRedirect\(\{ tab \}\)/);
  assert.match(app, /agentsRedirectSearch\(tab, search\)/);
  assert.match(app, /pathname: "\/agents", search: agentsRedirectSearch\(tab, search\), hash/);
  for (const [route, tab] of Object.entries(LEGACY_TAB_REDIRECTS)) {
    assert.ok(
      app.includes(`path="${route}" element={<MemberAccess><LegacyAgentsRedirect tab="${tab}" /></MemberAccess>}`),
      `${route} must stay a MemberAccess-guarded redirect to /agents?tab=${tab}`,
    );
  }
  assert.doesNotMatch(app, /path="\/analytics" element=\{<MemberAccess><AnalyticsCenter/);
  assert.doesNotMatch(app, /path="\/strategy" element=\{<MemberAccess><CampaignStrategy/);
  assert.doesNotMatch(app, /path="\/communications" element=\{<MemberAccess><CommunicationsWorkspace/);
});

test("/messaging stays a standalone route, not a redirect into the tabbed page", () => {
  const app = read("src/App.jsx");
  assert.match(app, /path="\/messaging" element=\{<MemberAccess><Messaging \/><\/MemberAccess>\}/);
  const messagingLine = app.split("\n").find((line) => line.includes('path="/messaging"'));
  assert.doesNotMatch(messagingLine, /Navigate|LegacyAgentsRedirect/);
  const messaging = read("src/pages/Messaging.jsx");
  assert.match(messaging, /Agent messaging, not user mail, CRM outreach, email, or social DMs/);
  assert.match(messaging, /to="\/mail"/);
  assert.match(messaging, /to="\/communications"/);
});

test("per-agent conversation links preserve agent and campaign context", () => {
  assert.deepEqual([...AGENT_MESSAGING_IDS],
    ["nexus", "story", "orbit", "polaris", "forge", "echo", "pulse", "link", "discover"]);
  assert.equal(agentFromParam("echo"), "echo");
  assert.equal(agentFromParam("discover"), "discover");
  assert.equal(agentFromParam("unknown"), null);
  assert.equal(agentFromParam(null), null);
  assert.equal(messagingHref("echo"), "/messaging?agent=echo");
  assert.equal(
    messagingHref("story", "11111111-2222-3333-4444-555555555555"),
    "/messaging?agent=story&campaign=11111111-2222-3333-4444-555555555555",
  );
  assert.equal(messagingHref("echo", "not-a-uuid"), "/messaging?agent=echo");
  assert.equal(messagingHref("unknown"), "/messaging");
  assert.equal(messagingHref(null), "/messaging");
  const page = read("src/pages/AgentsTeam.jsx");
  assert.match(page, /to=\{messagingHref\(selected, selection\.campaignId\)\}/);
  assert.match(page, /Continue the conversation in Messaging/);
  assert.match(page, /to="\/messaging">Messaging<\/Link>/);
  const messaging = read("src/pages/Messaging.jsx");
  assert.match(messaging, /agentFromParam\(params\.get\("agent"\)\)/);
  assert.match(messaging, /window\.dispatchEvent\(new CustomEvent\("ifund-open-agent", \{ detail: \{ agent: requestedAgent \} \}\)\)/);
  assert.match(messaging, /`\/agents\?agent=\$\{encodeURIComponent\(active\)\}/);
  // The floating agent-chat sidebar opens the dedicated route, keeping the agent.
  const panel = read("src/components/agents/AgentSidePanel.jsx");
  assert.match(panel, /to=\{"\/messaging\?agent=" \+ encodeURIComponent\(identity\)\}/);
  assert.match(panel, /Open in Messaging/);
  assert.match(panel, /to=\{"\/agents\?agent=" \+ encodeURIComponent\(identity\)\}/);
});

test("unverified-capability warnings still present; no verified chat is claimed", () => {
  const page = read("src/pages/AgentsTeam.jsx");
  assert.match(page, /yet have verified direct advisory chat for the registered specialist/);
  assert.match(page, /Direct AI answers are not enabled on this deployment/);
  assert.match(page, /a paid plan is not required/);
  assert.doesNotMatch(page,/membershipActive/);
  const lib = read("src/lib/agentsPage.mjs");
  assert.match(lib, /Messaging is NOT a tab here/);
  assert.doesNotMatch(lib, /verified (direct |specialist )?chat is (available|live|enabled)/i);
  assert.doesNotMatch(page, /direct specialist advisory chat is (available|live|enabled|verified)/i);
});

test("shared team context is not restricted to STORY/ORBIT", () => {
  const page = read("src/pages/AgentsTeam.jsx");
  assert.match(page, /\{user && <TeamConversationHistory \/>/);
  const history = read("src/components/agents/TeamConversationHistory.jsx");
  assert.match(history, /loadTeamHistory\(authClient\(\)\)/);
  const context = read("src/api/teamContext.js");
  assert.match(context, /All nine agents share these events for the same verified owner only/);
  assert.match(context, /export async function loadTeamHistory\(client,\{campaignId=null,limit=30,beforeAt=null,beforeId=null\}/);
  assert.doesNotMatch(context, /agent_id.*filter|filter.*agent_id|agentId.*===.*"story"/);
  const directory = read("src/lib/agentTrainingDirectory.mjs");
  assert.match(directory, /scope:"authenticated_owner_team"/);
  assert.match(directory, /source:"all_authorized_agent_interactions"/);
  for (const source of [page, history, context, read("src/pages/Messaging.jsx"), read("src/lib/agentsPage.mjs")]) {
    assert.doesNotMatch(source, /\["story",\s*"orbit"\]/);
    assert.doesNotMatch(source, /\['story',\s*'orbit'\]/);
    assert.doesNotMatch(source, /shared team (context|history) (is )?(only|restricted to)/i);
  }
});

test("routes, titles, navigation and acceptance entries wire the Agents page in", () => {
  const layout = read("src/components/Layout.jsx");
  assert.match(layout, /"\/agents": "Agents — Analysis & Recommendations"/);
  const acceptance = JSON.parse(read("ci/route-acceptance.json"));
  const byRoute = new Map(acceptance.routes.map((entry) => [entry.route, entry]));
  for (const route of ["/analytics", "/strategy", "/communications"]) {
    assert.equal(byRoute.get(route).component, "AgentsTeam", `${route} folds into the Agents page`);
    assert.equal(byRoute.get(route).role, "member", `${route} stays member-gated`);
    assert.match(byRoute.get(route).source_evidence, /\/agents\?tab=/);
  }
  assert.equal(byRoute.get("/agents").role, "public");
  assert.equal(byRoute.get("/agents").component, "AgentsTeam");
  assert.equal(byRoute.get("/mission").role, "public");
  assert.equal(byRoute.get("/messaging").role, "member");
  assert.equal(byRoute.get("/messaging").component, "Messaging");
  const tour = read("public/stitch-review/index.html");
  for (const route of ["/analytics", "/strategy", "/communications"]) {
    assert.ok(tour.includes(`"path":"${route}"`), `tour must still list ${route}`);
    const entry = tour.slice(tour.indexOf(`"path":"${route}"`), tour.indexOf(`"path":"${route}"`) + 200);
    assert.ok(entry.includes('"redirected":true'), `${route} must be marked redirected in the tour`);
  }
  assert.ok(tour.includes('"path":"/messaging"'));
  const messagingEntry = tour.slice(tour.indexOf('"path":"/messaging"'), tour.indexOf('"path":"/messaging"') + 200);
  assert.ok(messagingEntry.includes('"redirected":false'), "/messaging must stay a standalone tour route");
});
