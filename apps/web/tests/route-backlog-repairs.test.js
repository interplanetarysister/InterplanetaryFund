import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const rootPath = relative => new URL("../../../" + relative, import.meta.url);
const app = read("../src/App.jsx");
const layout = read("../src/components/Layout.jsx");
const route = path => app.split("\n").find(line => line.includes('path="' + path + '"')) || "";
const has = (text, snippet, message) => assert.ok(text.includes(snippet), message || "Missing " + snippet);

test("catch-all and legacy alias routes are real redirects or explicit 404s", () => {
  for (const [path, target] of [
    // Sprint 8 (2026-11-25): /atlas folds into Discover as the Globe tab.
    ["/atlas", "/discover?tab=globe"],
    ["/blog", "/social"],
    ["/my-profile", "/profile"],
  ]) {
    const entry = route(path);
    has(entry, 'path="' + path + '"', path + " must remain registered");
    has(entry, '<Navigate to="' + target + '" replace />', path + " must redirect to " + target);
    assert.doesNotMatch(entry, /ComingSoon/, path + " must not be a placeholder");
  }
  for (const path of ["*"]) {
    const entry = route(path);
    has(entry, "<PageNotFound />", path + " must render the real 404 page");
    assert.doesNotMatch(entry, /ComingSoon/, path + " must not be a placeholder");
  }
  // Follow-up (2026-11-26): /admin/* is no longer a bare 404 — it maps known
  // Admin Console tab ids to /admin?tab=<id> and 404s only unknown segments.
  // /admin/ops and /admin/platform previously fell through to this 404.
  assert.match(app, /<Route path="\/admin\/\*" element=\{<AdminLegacyRedirect \/>} \/>/,
    "/admin/* must use the admin legacy redirect");
  assert.match(app, /function AdminLegacyRedirect\(\) \{[\s\S]*?return <PageNotFound \/>;/,
    "unknown admin segments must still render the real 404 page");
  assert.doesNotMatch(app, /const\s+ComingSoon\s*=|element=\{<ComingSoon\s*\/>\}/);
});

test("parameterized public routes use the verified shared page components", () => {
  const institutionEntry = route("/institutions/:id");
  has(institutionEntry, '<Route path="/institutions/:id" element={<Institutions />} />');
  has(route("/institutions"), '<Route path="/institutions" element={<Institutions />} />');
  assert.doesNotMatch(institutionEntry, /ComingSoon|MemberAccess/);
  assert.match(app, /function SocialRoute\(\) \{[\s\S]*?get\("tab"\) === "publications"[\s\S]*?<Navigate to="\/social\?tab=news" replace \/>/,
    "the social publications tab must redirect to the Social news tab");
  has(route("/social"), "<SocialRoute />");
});

test("legacy founding-member links hand off to the canonical registration route", () => {
  const source = read("../src/pages/FoundingMembers.jsx");
  const authPage = read("../src/pages/AuthPage.jsx");
  has(source, 'import { Navigate, useLocation } from "react-router-dom"');
  has(source, 'new URLSearchParams(location.search).get("returnTo")');
  has(source, 'encodeURIComponent(returnTo)');
  has(source, '<Navigate to={"/register" + query} replace />');
  assert.doesNotMatch(source, /https?:\/\//, "the alias must not hard-code an external destination");
  has(authPage, "safeReturnTo(", "the destination must be sanitized by the real auth page");
});

test("consumer health notice remains a separate, guest-readable legal document", () => {
  const source = read("../src/pages/HealthPrivacy.jsx");
  has(route("/health-privacy"), "<HealthPrivacy />");
  assert.doesNotMatch(route("/health-privacy"), /MemberAccess/);
  has(source, "Consumer Health Data Privacy Notice");
  has(source, "Washington My Health My Data Act");
  has(source, "separate affirmative consent");
  has(source, "Agreeing to the general Terms does not grant that separate permission");
  has(source, "does not replace");
  has(source, "<LegalFooter />");
});

test("fundraising partner catalog makes the direct-checkout boundary explicit", () => {
  const source = read("../src/pages/FundraisingPartners.jsx");
  has(route("/fundraising-partners"), "<FundraisingPartners />");
  assert.doesNotMatch(route("/fundraising-partners"), /MemberAccess/);
  has(source, "not confirmed iFund partners");
  has(source, "Your donations stay with your chosen platform");
  has(source, "iFund does not collect, transfer or reconcile those donations");
  has(source, "provider-approved access and your permission");
  has(source, 'target="_blank"');
  has(source, 'rel="noopener noreferrer"');
  assert.doesNotMatch(source, /ifund-campaign-covers|checkout\/paypal|request_withdrawal/i,
    "the catalog must not mix external destinations with first-party payment actions");
});

test("published Studio pages use the public read-only renderer endpoint", () => {
  const page = read("../src/pages/StudioPublishedPage.jsx");
  const worker = read("../../../worker/studioRoutes.js");
  has(route("/p/:slug"), "<StudioPublishedPage />");
  assert.doesNotMatch(route("/p/:slug"), /MemberAccess/);
  has(page, 'fetch("/api/public/studio/pages/" + encodeURIComponent(slug))');
  has(page, "Page unavailable");
  assert.doesNotMatch(page, /method:\s*["']POST|INSERT|UPDATE|DELETE/i, "public renderer must not mutate pages");
  has(worker, "routePublicStudioPage");
  has(worker, "if (request.method !== 'GET') return response(405");
  has(worker, "status: 'eq.published'");
  has(worker, "rows[0]?.status !== 'published'");
});

test("OAuth callback fails closed for unknown providers, missing sessions, and replayed state", () => {
  const source = read("../src/pages/OAuthCallback.jsx");
  has(route("/oauth/callback/:provider"), "<OAuthCallback />");
  assert.doesNotMatch(route("/oauth/callback/:provider"), /MemberAccess/);
  has(source, 'const PROVIDERS = new Set(["google"');
  has(source, "!PROVIDERS.has(provider)");
  has(source, "!session?.access_token");
  has(source, 'fetch("/api/oauth/" + provider + "/callback"');
  has(source, "Authorization: \"Bearer \" + session.access_token");
  has(source, "callbackFlights.get(storageKey)");
  has(source, "window.history.replaceState({}, \"\", window.location.pathname)");
  has(source, "The provider response is incomplete");
  assert.doesNotMatch(source, /access_token=|\?code=[^"']*state/i,
    "provider codes and access tokens must not be embedded in page URLs");
});

test("hackathon tracker route keeps its super-admin guard and truthful evidence model", () => {
  const entry = route("/hackathon/tracker");
  has(entry, "<MemberAccess><SuperAdminAccess><HackathonTracker");
  const page = read("../src/pages/HackathonTracker.jsx");
  const sql = read("../../../supabase/migrations/20261110_ifund_paypal_hackathon_demo_tracker.sql");
  has(page, "hackathonTracker");
  has(page, "evidence");
  has(sql, "public.ifund_current_user_is_verified_super_admin()");
  has(sql, "enable row level security");
  has(sql, "no financial authority", "tracker records must not be represented as payment receipts");
});

const evidencePathPattern = /(?:apps\/web|supabase|worker|workers|tests|functions|integrations|docs)\/[A-Za-z0-9_@./\[\]-]+\.[A-Za-z0-9]+/g;
const evidencePaths = text => [...new Set([...String(text || "").matchAll(evidencePathPattern)]
  .map(match => match[0].replace(/[.:;,]+$/, ""))
  .filter(path => existsSync(rootPath(path))))];

test("route acceptance evidence points only to real files and real test files", () => {
  const register = JSON.parse(read("../ci/route-acceptance.json"));
  for (const entry of register.routes.filter(row => row.source_status === "source_ready")) {
    const sourcePaths = evidencePaths(entry.source_evidence);
    const behaviorPaths = evidencePaths(entry.behavior_evidence);
    const backendPaths = evidencePaths(entry.backend_evidence);
    assert.ok(sourcePaths.length, entry.route + " source_evidence must name an existing source file");
    assert.ok(behaviorPaths.some(path => path.includes("/tests/")),
      entry.route + " behavior_evidence must name an existing test file");
    if (entry.role !== "public") {
      assert.ok(backendPaths.length,
        entry.route + " backend_evidence must name an existing authorization/RPC/SQL file");
    }
  }
});

test("the release gate still fails closed on unverified route rows", () => {
  const verifier = read("../ci/verify-route-readiness.mjs");
  has(verifier, 'entry.source_status !== "source_ready"');
  has(verifier, '"Missing source and test acceptance: "');
  has(verifier, "IFund release gate: route completion is NOT certified.");
  has(verifier, "process.exitCode = 1");
});

test("manifest role classification reflects intentional public agent and withdrawal explainer routes", () => {
  const register = JSON.parse(read("../ci/route-acceptance.json"));
  const byRoute = new Map(register.routes.map(row => [row.route, row]));
  for (const path of ["/agents", "/mission", "/withdrawals", "/planetary-impact", "/fundraising-partners"]) {
    assert.equal(byRoute.get(path)?.role, "public", path + " is intentionally guest-readable");
  }
  assert.equal(byRoute.get("/hackathon/tracker")?.role, "super_admin");
  assert.match(route("/withdrawals"), /<WithdrawalVerification \/>/);
  assert.doesNotMatch(route("/withdrawals"), /MemberAccess/,
    "the explainer is public; the owner/MFA gate lives inside the component");
  const withdrawals = read("../src/pages/WithdrawalVerification.jsx");
  has(withdrawals, "payoutIdentity(state.user)");
  has(withdrawals, "createOwnerSessionGuard(");
  has(withdrawals, "ifund_request_withdrawal");
});
