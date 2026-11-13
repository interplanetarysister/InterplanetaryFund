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

test("working aliases retain existing permission and financial boundaries", () => {
  assert.ok(route("/mission")?.includes("<MemberAccess><AgentsTeam"));
  assert.ok(route("/donors")?.includes("<MemberAccess><CampaignEngagement"));
  assert.ok(route("/analytics")?.includes("<MemberAccess><AnalyticsCenter"));
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
  assert.match(source, /listActiveCampaigns\(\{ limit: 500 \}\)/);
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
