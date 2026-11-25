import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const page = name => readFileSync(new URL("../src/pages/" + name + ".jsx", import.meta.url), "utf8");
const route = path => app.split("\n").find(line => line.includes('path="' + path + '"'));

test("member onboarding and device controls require account verification", () => {
  for (const [path, component] of [["/onboarding", "MemberOnboarding"], ["/devices", "Devices"]]) {
    const entry = route(path);
    assert.ok(entry?.includes("<MemberAccess>") && entry.includes("<" + component),
      path + " must be protected by verified account access");
    assert.doesNotMatch(entry, /ComingSoon/);
  }
  assert.match(page("MemberOnboarding"), /saveMyProfile\(/, "onboarding must save via existing owner-scoped RPC");
  assert.match(page("Devices"), /signOut\(\{ scope \}\)/, "session controls must call Supabase Auth");
  assert.doesNotMatch(page("Devices"), /auth\.admin\./, "a public browser may never list admin user sessions");
});

test("admin operations paths are guarded and do not silently grant privileges", () => {
  for (const path of ["/ops", "/platform"]) {
    const entry = route(path);
    assert.ok(entry?.includes("<MemberAccess>") && entry.includes("<SuperAdminAccess>"),
      path + " must be restricted to verified super-admin");
  }
  assert.match(page("OperationsHub"), /BuilderOperationalReview/, "ops uses server-verified read-only diagnostics");
  assert.match(page("OperationsHub"), /WorkflowRegistry/, "ops surfaces the existing restricted workflow registry");
  assert.match(readFileSync(new URL("../src/components/agents/WorkflowRegistry.jsx", import.meta.url), "utf8"), /ifund_admin_workflow_registry/, "workflow source must use its verified administrator RPC");
  assert.ok(route("/admin/*")?.includes("<PageNotFound"), "unknown admin path should be intentional 404, not ComingSoon");
});

test("member analytics is discoverable without exposing administrator links", () => {
  const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
  const explore = layout.split('label: "Explore"')[1]?.split('label: "Campaigns & Giving"')[0];
  const administration = layout.split('label: "Administration"')[1]?.split('const navItems')[0];
  assert.match(explore || "", /to: "\/analytics", label: "Command Center"/);
  assert.doesNotMatch(administration || "", /to: "\/analytics"/);
  assert.match(layout, /navSections\.filter\(section => isAdmin \|\| isSuperAdmin \|\| section\.label !== "Administration"\)/);
  // Sprint 6 (2026-11-25): /analytics folds into the tabbed Agents page;
  // the legacy route stays a MemberAccess-guarded redirect, not an admin route.
  assert.ok(route("/analytics")?.includes('<MemberAccess><LegacyAgentsRedirect tab="analytics"'),
    "member analytics must remain account-protected rather than administrator-only");
});

test("working aliases keep public agent identity and private financial boundaries", () => {
  for (const path of ["/mission", "/agents"]) {
    assert.ok(route(path)?.includes("<AgentsTeam />"), path + " must expose the read-only agent directory");
    assert.doesNotMatch(route(path) || "", /MemberAccess/, "public agent identities do not require registration");
  }
  const team = page("AgentsTeam");
  assert.match(team, /\{user && <EditorialAgentQueue \/>/, "member editorial queue stays protected");
  assert.match(team, /\{user && <TeamConversationHistory \/>/, "private team history stays protected");
  assert.match(team, /\{user && showWriting &&/, "private writing remains member-scoped");
  assert.match(team, /\{user && selected === "nexus"/, "owner briefing remains member-scoped");
  assert.ok(route("/donors")?.includes("<MemberAccess><CampaignEngagement"));
  assert.ok(route("/analytics")?.includes('<MemberAccess><LegacyAgentsRedirect tab="analytics"'));
  assert.ok(route("/connect")?.includes('to="/connections"'));
  assert.ok(route("/activate")?.includes('to="/login"'));
  assert.match(page("AnalyticsCenter"), /FinanceDashboard/, "analytics must reuse verified finance views");
  assert.match(page("AnalyticsCenter"), /CampaignEngagement/, "analytics must retain owner-scoped engagement");
  assert.match(page("AnalyticsCenter"), /Atlas/, "public map must enforce location opt-ins");
});

test("planet reporting is restricted to administrators and counts verified public campaigns", () => {
  const entry = route("/admin/sustainability");
  assert.ok(entry?.includes("<MemberAccess><AdminAccess><AdminSustainability"),
    "environment reporting must use verified administrator access");
  const source = page("AdminSustainability");
  assert.match(source, /row\.category === "environment"/);
  assert.match(source, /moneyCents\(c\.raised_amount\)/);
  assert.match(source, /Number\.isSafeInteger\(totalCents\)/, "aggregate only safe integer cents");
  assert.doesNotMatch(source, /\b(fetch|POST|INSERT|UPDATE|DELETE)\b\s*\(/i, "read-only reporting cannot mutate campaign records");
  assert.match(source, /No estimated carbon savings/, "no unsupported impact outcomes");
});

test("guest navigation exposes campaign drafting without bypassing account protections", () => {
  const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
  const publicNav = layout.split("const publicNavItems = [")[1]?.split("];")[0];
  assert.ok(publicNav, "public navigation must be declared");
  assert.match(publicNav, /to: "\/create", label: "Create a campaign"/,
    "guests need a visible entry to the browser-only campaign composer");
  assert.ok(route("/create")?.includes("<CreateCampaign />"),
    "public creator must remain available without a member route gate");
  const composer = page("CreateCampaign");
  assert.match(composer, /user\.is_anonymous === true \|\| !user\.email_confirmed_at/,
    "cloud save and publishing must still require verified identity");
  assert.match(composer, /rememberBrowserCampaign\(sessionStorage, null, form/,
    "guest draft saves must remain browser-local");
});


test("anonymous auth sessions retain guest draft scope for verified-account handoff", () => {
  const composer = page("CreateCampaign");
  assert.match(composer, /session\.user\?\.is_anonymous === true \|\| !session\.user\?\.email_confirmed_at \? null : \(session\.user\?\.id \|\| null\)/,
    "anonymous Supabase identities must not claim the draft under a transient account ID");
  assert.match(composer, /key=\{\(draftId \|\| "new"\) \+ ":" \+ \(ownerId \|\| "guest"\)\}/,
    "the editor must remount when a verified account takes ownership");
  const browserDraft = readFileSync(new URL("../src/lib/browserCampaignDraft.js", import.meta.url), "utf8");
  assert.match(browserDraft, /record\.owner_id !== ownerId/,
    "drafts attributed to a different account must not be restored");
});


test("guest owner declaration survives source comments and remains executable", () => {
  const composer = page("CreateCampaign");
  assert.match(composer, /\/\/ Anonymous Supabase sessions[^\n]*\n\s*\/\/ Keep their browser draft[^\n]*\n\s*const ownerId\s*=/,
    "ownerId must be on a real source line, not swallowed by a single-line comment");
  assert.doesNotMatch(composer, /\/\/ Anonymous Supabase sessions[^\n]*\\\\n[^\n]*const ownerId/,
    "literal backslash-n in comments must not comment out the owner declaration");
});

test("browser drafts use isolated owner and guest keys", () => {
  const draft = readFileSync(new URL("../src/lib/browserCampaignDraft.js", import.meta.url), "utf8");
  assert.ok(draft.includes('KEY + ":guest"'));
  assert.ok(draft.includes('KEY + ":owner:" + encodeURIComponent(ownerId)'));
  assert.ok(draft.includes("record?.version === 2 && record.owner_id === null"));
  assert.ok(draft.includes('return invalid ? { invalid: true } : null;'));
  assert.ok(draft.includes("parsed?.version === 2 && parsed.owner_id === ownerId"));
});

test("unverified sessions cannot claim guest drafts or falsely acknowledge rejected writes", () => {
  const composer = page("CreateCampaign");
  assert.match(composer, /!session\.user\?\.email_confirmed_at \? null : \(session\.user\?\.id \|\| null\)/,
    "only email-verified identities can claim a guest draft");
  assert.match(composer, /const stored = rememberBrowserCampaign\(sessionStorage, null, form/,
    "guest save must retain the storage helper result");
  assert.match(composer, /setBrowserSaved\(stored&&wizardStored\)/,
    "a rejected owner-mismatch write must not show a saved receipt");
  assert.match(composer, /if \(!stored\|\|!wizardStored\) setError\(/,
    "rejected writes must provide a visible error");
});

test("successful cloud save only clears the matching browser draft", () => {
  const draft = readFileSync(new URL("../src/lib/browserCampaignDraft.js", import.meta.url), "utf8");
  const composer = page("CreateCampaign");
  assert.ok(draft.includes("export function forgetBrowserCampaign(storage, ownerId)"));
  assert.ok(draft.includes("record.owner_id !== ownerId) return false"));
  assert.ok(composer.includes("forgetBrowserCampaign(sessionStorage, ownerId)"));
});

test("autosave failures are announced to the editor", () => {
  const composer = page("CreateCampaign");
  assert.ok(composer.includes('setAutosaveError(stored ? "" :'));
  assert.ok(composer.includes('setAutosaveError("Browser storage is unavailable.'));
  assert.match(composer, /autosaveError && <(?:p|div) role="alert"/);
});

test("campaign cloud saves reject changed sessions and never downgrade verified drafts to guest storage", () => {
  const composer = page("CreateCampaign");
  assert.match(composer, /if \(ownerId\) \{\s*setError\("Your account session could not be verified/);
  assert.match(composer, /if \(!ownerId \|\| user\.id !== ownerId\)/);
  assert.match(composer, /Copy any unsaved changes, then reload the campaign editor/);
});

test("website studio never silently unpublishes a dirty page during navigation", () => {
  const studio = page("AdminStudio");
  assert.match(studio, /const requireCleanEditor = \(\) => \{/);
  assert.match(studio, /if \(busy \|\| !requireCleanEditor\(\)\) return;/);
  assert.match(studio, /if \(!page\?\.id \|\| busy \|\| !requireCleanEditor\(\)\) return;/);
  assert.doesNotMatch(studio, /const selectPage = async[\s\S]*?await save\("draft"\)/);
  assert.doesNotMatch(studio, /const startNew = async[\s\S]*?await save\("draft"\)/);
  assert.match(studio, /serverPageOffset\.current \+= rows\.length/);
  assert.match(studio, /offset=" \+ serverPageOffset\.current/);
});

test("team history invalidates in-flight actions on account changes and permits manual recovery", () => {
  const history = readFileSync(new URL("../src/components/agents/TeamConversationHistory.jsx", import.meta.url), "utf8");
  assert.match(history, /status:"error",items:\[\],message:"Account session changed/);
  assert.match(history, /const generation=requestGeneration\.current;\s*setRemoving\(row\.id\)/);
  assert.match(history, /generation===requestGeneration\.current\)\s*setState\(prev=>\(\{\.\.\.prev,items:prev\.items\.filter/);
  assert.match(history, /generation===requestGeneration\.current\)\{\s*setEditing\(""\)/);
  assert.match(history, /disabled=\{state\.status==="loading"\}/);
});

test("private Atlas campaign reads verify the same confirmed owner on both sides of the request", () => {
  const atlas = page("Atlas");
  assert.match(atlas, /!user\.email_confirmed_at/);
  assert.match(atlas, /const before = await client\.auth\.getUser\(\)/);
  assert.match(atlas, /before\.data\?\.user\?\.id !== user\.id/);
  assert.match(atlas, /const rows = await listOwnerAtlasCampaigns\(client\)/);
  assert.match(atlas, /const after = await client\.auth\.getUser\(\)/);
  assert.match(atlas, /after\.data\?\.user\?\.id !== user\.id/);
  assert.match(atlas, /setOwnerCampaigns\(\{ownerId:user\.id,rows:rows\.map\(mapAtlasCampaign\)\}\)/);
});

test("studio requests bind to one administrator identity and reject stale auth changes", () => {
  const studio = page("AdminStudio");
  assert.match(studio, /const generation = accountGeneration\.current/);
  assert.match(studio, /db\.auth\.getUser\(\), db\.auth\.getSession\(\)/);
  assert.match(studio, /session\.data\?\.session\?\.user\?\.id !== ownerId/);
  assert.match(studio, /after\.data\?\.user\?\.id !== ownerId \|\| generation !== accountGeneration\.current/);
  assert.match(studio, /setPages\(\[\]\); setPage\(null\); setVersions\(\[\]\)/);
});

test("admin moderation and platform finance links are visible only through authorized navigation", () => {
  const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
  assert.match(layout, /to: "\/admin\/social-moderation", label: "Community Moderation"/);
  assert.match(layout, /to: "\/admin\/finance", label: "Platform Finance"/);
  assert.match(layout, /const adminOnly = \[[^\]]*"\/admin\/social-moderation"[^\]]*"\/admin\/finance"/);
  assert.match(layout, /return !adminOnly \|\| isAdmin \|\| isSuperAdmin/);
  for (const path of ["/admin/social-moderation", "/admin/finance"]) {
    const entry = route(path);
    assert.ok(entry?.includes("<AdminAccess>"), path + " must enforce the member/admin route gate");
  }
  assert.match(layout, /to: "\/analytics", label: "Command Center"/,
    "member analytics stays independent of admin-only finance");
});

test("sustainability screen does not mislabel public campaign totals as verified payments", () => {
  const sustainability = page("AdminSustainability");
  assert.match(sustainability, /Publicly reported fundraising/);
  assert.match(sustainability, /does not independently establish provider verification/);
  assert.doesNotMatch(sustainability, /"Provider-verified fundraising"/);
  assert.doesNotMatch(sustainability, /Financial figures exclude pending, refunded, unverified and sandbox transactions/);
});

test("operations finance navigation enters administrator-gated route", () => {
  const operations = page("OperationsHub");
  assert.match(operations, /to: "\/admin\/finance", label: "Platform finance"/);
  assert.doesNotMatch(operations, /to: "\/finances#platform-finance"/);
  assert.match(route("/admin/finance"), /<AdminAccess>/);
});

test("help editor prevents changing the target topic while a revision is saving", () => {
  const helpEditor = page("AdminHelpEditor");
  assert.match(helpEditor, /disabled=\{busy\} onClick=\{\(\) => \{ setSelected\(item\.slug\)/);
  assert.match(helpEditor, /setBusy\(true\); setError\(""\); setNotice\(""\)/);
  assert.match(helpEditor, /finally \{ setBusy\(false\); \}/);
});

test("member analytics tabs support roving focus and directional keyboard navigation", () => {
  const analytics = page("AnalyticsCenter");
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
    assert.ok(analytics.includes('key === "' + key + '"'));
  }
  assert.match(analytics, /tabIndex=\{view===id \? 0 : -1\}/);
  assert.match(analytics, /tabRefs\.current\[next\]\?\.focus\(\)/);
  assert.match(analytics, /role="tabpanel" tabIndex=\{0\}/);
  assert.match(analytics, /aria-labelledby=\{"analytics-tab-"\+view\}/);
  assert.match(analytics, /aria-controls="analytics-panel"/);
  assert.match(analytics, /id="analytics-panel" role="tabpanel"/);
  assert.match(analytics, /event\.preventDefault\(\)/);
});

test("planetary impact is guest-accessible while admin sustainability remains protected", () => {
  const publicEntry = route("/planetary-impact");
  const adminEntry = route("/admin/sustainability");
  assert.ok(publicEntry?.includes("<AdminSustainability />"), "the public page must render environmental reporting");
  assert.doesNotMatch(publicEntry || "", /MemberAccess|AdminAccess|SuperAdminAccess/,
    "visitors may explore planetary impact without an account");
  assert.ok(adminEntry?.includes("<MemberAccess><AdminAccess>"),
    "the legacy admin route must not lose its authorization guard");

  const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
  const guestNav = layout.split("const publicNavItems = [")[1]?.split("];")[0];
  const explore = layout.split('label: "Explore"')[1]?.split('label: "Campaigns & Giving"')[0];
  assert.match(guestNav || "", /to: "\/planetary-impact", label: "Planetary Impact"/);
  assert.match(explore || "", /to: "\/planetary-impact", label: "Planetary Impact"/);

  const about = page("About");
  assert.match(about, /to="\/planetary-impact"/);
  const impact = page("AdminSustainability");
  const publicData = readFileSync(new URL("../src/api/publicData.js", import.meta.url), "utf8");
  assert.ok(impact.includes('listActiveCampaigns({ limit: 500, category: "environment" })'));
  assert.ok(publicData.includes('if (category === "environment") query = query.eq("category", "environment");'),
    "category must be filtered by Supabase before applying the 500-record limit");
  assert.match(impact, /Counts are limited to this result window/,
    "do not claim a complete environmental campaign census from a bounded query");
  assert.match(impact, /Cloudflare Pages and Workers/);
  assert.match(impact, /100% renewable-energy matching/);
  assert.match(impact, /31,000 metric tons CO₂e/);
  assert.match(impact, /company-wide disclosures, not independently measured carbon savings/);
  assert.match(impact, /https:\/\/www\.cloudflare\.com\/impact\//);
  assert.doesNotMatch(impact, /iFund is carbon neutral|iFund has saved [0-9]+ tons/i);
});
