import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { build } from "esbuild";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { cacheDir } from "./helpers/render.js";

// Sprint 8 (2026-11-25): Admin Console tabbed console (40-page list,
// page 21). /admin is one tabbed console: the Overview tab keeps the
// existing link hub, and every other tab renders the existing destination
// page as its panel. Server rendering never runs effects, so no data is
// fetched here — these tests prove tab routing, mounting, fallback and
// gating, not live records. Auth and the Supabase client are stubbed at
// the bundle boundary, following the agent-feature-routes fixture pattern;
// the destination components themselves render for real.

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const webRoot = fileURLToPath(new URL("../", import.meta.url));

globalThis.__adminConsoleFixture = { elevated: "super-admin" };

let adminModule;
async function adminConsoleModule() {
  if (adminModule) return adminModule;
  mkdirSync(cacheDir, { recursive: true });
  const outfile = path.join(cacheDir, "admin-console-tabs-fixture.mjs");
  await build({
    entryPoints: [path.join(webRoot, "src/pages/AdminHub.jsx")],
    outfile,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "neutral",
    mainFields: ["module", "main"],
    alias: { "@": path.join(webRoot, "src") },
    external: ["react", "react-dom", "react/jsx-runtime", "react-router", "react-router-dom"],
    plugins: [{
      name: "admin-console-fixture",
      setup(builder) {
        builder.onResolve({ filter: /hooks\/useAuthSession$/ }, () => ({ path: "auth-session", namespace: "fixture" }));
        builder.onResolve({ filter: /hooks\/useSuperAdminAccess$/ }, () => ({ path: "super-admin", namespace: "fixture" }));
        builder.onResolve({ filter: /api\/auth$/ }, () => ({ path: "auth-client", namespace: "fixture" }));
        // publicData reads import.meta.env at import time; the
        // Sustainability panel only calls it inside an effect, which
        // server rendering never runs.
        builder.onResolve({ filter: /api\/publicData$/ }, () => ({ path: "public-data", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => {
          if (args.path === "auth-session")
            return { loader: "js", contents: "export function useAuthSession(){ return { user: { id: \"admin-1\" }, status: \"ready\" }; }" };
          if (args.path === "super-admin")
            return { loader: "js", contents: "export function useSuperAdminAccess(){ return globalThis.__adminConsoleFixture.elevated; }" };
          if (args.path === "public-data")
            return { loader: "js", contents: "export async function listActiveCampaigns(){ return []; }" };
          return {
            loader: "js",
            contents: "export function authClient(){ return { auth: { getUser: async () => ({ data: { user: { id: \"admin-1\" } }, error: null }), getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, rpc: async () => ({ data: null, error: new Error(\"stubbed\") }), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }; }",
          };
        });
      },
    }],
    logLevel: "silent",
  });
  adminModule = await import(pathToFileURL(outfile).href);
  return adminModule;
}

const { default: AdminHub, tabFromParam } = await adminConsoleModule();

const render = (search = "") => renderToStaticMarkup(
  React.createElement(MemoryRouter, { initialEntries: [`/admin${search}`] }, React.createElement(AdminHub)),
);

// Distinctive text from each real destination component, chosen so it
// does NOT appear in the tab button labels (for example the tab says
// "Community moderation" while the panel says "Post reports from
// members", and the tab says "Website studio" while the panel heading
// says "Website Studio"). Every tab assertion below also checks the
// overview grid is absent, so a match proves the component mounted.
const EMBEDDED_TABS = Object.freeze([
  ["ops", "Operations center"],
  ["platform", "Platform operations"],
  ["integrations", "Connection integrations"],
  ["sustainability", "Planetary Impact"],
  ["social-moderation", "Post reports from members"],
  ["audit", "Operational audit"],
  ["deletions", "Account deletion requests"],
  ["studio", "Website Studio"],
  ["help", "Loading protected Help Center articles"],
  ["sponsor-inquiries", "Sponsor review"],
]);

const SUPER_ADMIN_TABS = Object.freeze([
  ["ops", "Operations center"],
  ["platform", "Platform operations"],
  ["audit", "Operational audit"],
  ["deletions", "Account deletion requests"],
  ["studio", "Website Studio"],
  ["help", "Loading protected Help Center articles"],
  ["sponsor-inquiries", "Sponsor review"],
]);

test("tabFromParam allow-lists admin tabs and falls back to overview", () => {
  assert.equal(tabFromParam(undefined), "overview");
  assert.equal(tabFromParam(""), "overview");
  assert.equal(tabFromParam("bogus"), "overview");
  assert.equal(tabFromParam("finance"), "overview");
  assert.equal(tabFromParam("planetary-impact"), "overview");
  for (const [id] of EMBEDDED_TABS) assert.equal(tabFromParam(id), id);
  assert.equal(tabFromParam("AUDIT"), "audit");
});

test("default (no ?tab) shows the overview link hub", () => {
  globalThis.__adminConsoleFixture.elevated = "super-admin";
  const html = render();
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-label="Administration sections"/);
  assert.match(html, /id="admin-tab-overview"[^>]*aria-selected="true"/);
  assert.match(html, /Administrative destinations/);
  assert.match(html, /Platform finance/);
  // Restricted cards render as links for a super-admin.
  assert.match(html, /href="\/admin\/audit"/);
  assert.match(html, /href="\/ops"/);
  assert.doesNotMatch(html, /Operational audit/);
  assert.doesNotMatch(html, /Website Studio/);
});

test("each embeddable tab renders its destination component", () => {
  globalThis.__adminConsoleFixture.elevated = "super-admin";
  for (const [id, marker] of EMBEDDED_TABS) {
    const html = render(`?tab=${id}`);
    assert.ok(html.includes(marker), `${id} tab should render its component (${marker})`);
    assert.match(html, new RegExp(`id="admin-tab-${id}"[^>]*aria-selected="true"`), `${id} tab should be selected`);
    assert.doesNotMatch(html, /Administrative destinations/, `${id} tab should not show the overview link hub`);
    assert.doesNotMatch(html, /Super-administrator access required/, `${id} tab should mount for a super-admin`);
  }
});

test("unknown tab falls back to overview", () => {
  globalThis.__adminConsoleFixture.elevated = "super-admin";
  for (const search of ["?tab=bogus", "?tab=finance", "?tab=planetary-impact", "?tab="]) {
    const html = render(search);
    assert.match(html, /Administrative destinations/, `${search} should fall back to the overview link hub`);
    assert.match(html, /id="admin-tab-overview"[^>]*aria-selected="true"/, `${search} should select the Overview tab`);
  }
});

test("super-admin-only tabs do not mount their component for non-super-admin viewers", () => {
  globalThis.__adminConsoleFixture.elevated = "denied";
  for (const [id, marker] of SUPER_ADMIN_TABS) {
    const html = render(`?tab=${id}`);
    assert.doesNotMatch(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${id} tab must not mount for a non-super-admin`);
    assert.match(html, /Super-administrator access required/, `${id} tab should show the unauthorized card`);
    assert.match(html, /href="\/admin\?tab=overview"/, `${id} tab should link back to the overview`);
  }
  // The overview itself still works for a non-super-admin: common cards
  // stay, restricted cards stay hidden, and no privileged panel mounts.
  // (Card presence is checked by link href: the tab button labels share
  // the restricted titles, so plain text matching cannot tell them apart.)
  const overview = render();
  assert.match(overview, /href="\/admin\/finance"/);
  assert.match(overview, /href="\/admin\/integrations"/);
  assert.match(overview, /href="\/admin\/social-moderation"/);
  assert.match(overview, /href="\/admin\/sustainability"/);
  assert.doesNotMatch(overview, /href="\/admin\/audit"/);
  assert.doesNotMatch(overview, /href="\/admin\/deletions"/);
  assert.doesNotMatch(overview, /href="\/admin\/studio"/);
  assert.doesNotMatch(overview, /href="\/admin\/help"/);
  assert.doesNotMatch(overview, /href="\/ops"/);
  assert.doesNotMatch(overview, /href="\/platform"/);
});

test("super-admin tabs show a loading state while verification resolves instead of mounting", () => {
  globalThis.__adminConsoleFixture.elevated = "loading";
  const html = render("?tab=audit");
  assert.match(html, /Checking additional administrator tools/);
  assert.doesNotMatch(html, /Operational audit/);
  assert.doesNotMatch(html, /Super-administrator access required/);
});

test("admin console wiring keeps URL-driven tabs, gating and exclusions in source", () => {
  const page = read("src/pages/AdminHub.jsx");
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /tabFromParam\(params\.get\("tab"\)\)/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
  assert.match(page, /superAdminTabPanel\("ops", <OperationsHub \/>\)/);
  assert.match(page, /superAdminTabPanel\("platform", <OperationsHub platform \/>\)/);
  assert.match(page, /<AdminConnections \/>/);
  assert.match(page, /<AdminSustainability \/>/);
  assert.match(page, /<SocialModeration \/>/);
  assert.match(page, /superAdminTabPanel\("audit", <AdminAudit \/>\)/);
  assert.match(page, /superAdminTabPanel\("deletions", <AdminDeletionQueue \/>\)/);
  assert.match(page, /superAdminTabPanel\("studio", <AdminStudio \/>\)/);
  assert.match(page, /superAdminTabPanel\("help", <AdminHelpEditor \/>\)/);
  assert.match(page, /superAdminTabPanel\("sponsor-inquiries", <AdminSponsorInquiries \/>\)/);
  assert.match(page, /elevated !== "super-admin"/);
  // No finance tab and no planetary-impact tab: finance stays a redirect
  // to /finances and planetary impact stays its own public destination.
  assert.doesNotMatch(page, /\{ id: "finance"/);
  assert.doesNotMatch(page, /\{ id: "planetary-impact"/);
  // The overview link hub itself is unchanged, including the finance card
  // that points at the existing redirect.
  assert.match(page, /\{ to: "\/admin\/finance", title: "Platform finance"/);
});
