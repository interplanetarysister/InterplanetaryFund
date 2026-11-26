import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { build } from "esbuild";
import { cacheDir } from "./helpers/render.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const CAMPAIGN = "11111111-1111-4111-8111-111111111111";

// Sprint 8 (2026-11-25), Decision 6: the Hackathon Tracker folds into
// Grants (renamed Grants & Opportunities) as a tab. /hackathon and
// /hackathon/tracker keep their own routes and components; this page only
// links to them and never fetches or renders tracker data.

// The page reads the session and the super-admin check through hooks, so the
// render fixture stubs both: the auth hook returns the fixture session and
// the super-admin hook returns the fixture verification status.
function setFixture(auth, superAdmin) {
  globalThis.__grantsHackathonFixture = { auth, superAdmin };
}
const signedOut = { status: "signed-out", user: null };
const signedIn = { status: "signed-in", user: { id: "owner-A" } };

let modulePromise = null;
async function grantsModule() {
  if (modulePromise) return modulePromise;
  modulePromise = loadGrantsModule();
  return modulePromise;
}

async function loadGrantsModule() {
  mkdirSync(cacheDir, { recursive: true });
  const outfile = join(cacheDir, `grants-hackathon-${Date.now()}.mjs`);
  await build({
    entryPoints: [join(root, "src/pages/Institutions.jsx")],
    outfile,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "neutral",
    mainFields: ["module", "main"],
    alias: { "@": join(root, "src") },
    external: ["react", "react-dom", "react/jsx-runtime", "react-router", "react-router-dom"],
    plugins: [{
      name: "grants-hackathon-fixture",
      setup(b) {
        b.onResolve({ filter: /hooks\/useAuthSession$/ }, () => ({ path: "auth-session", namespace: "fixture" }));
        b.onResolve({ filter: /hooks\/useSuperAdminAccess$/ }, () => ({ path: "super-admin", namespace: "fixture" }));
        b.onResolve({ filter: /api\/auth$/ }, () => ({ path: "auth-client", namespace: "fixture" }));
        // publicData reads import.meta.env at import time; the page only
        // calls it inside effects, which server rendering never runs.
        b.onResolve({ filter: /api\/publicData$/ }, () => ({ path: "public-data", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => {
          if (args.path === "auth-session")
            return { loader: "js", contents: "export function useAuthSession(){return globalThis.__grantsHackathonFixture.auth;}" };
          if (args.path === "super-admin")
            return { loader: "js", contents: "export function useSuperAdminAccess(){return globalThis.__grantsHackathonFixture.superAdmin;}" };
          if (args.path === "public-data")
            return { loader: "js", contents: "export async function listActiveCampaigns(){ return []; }" };
          return {
            loader: "js",
            contents: "export function authClient(){ return { auth: { getUser: async () => ({ data: { user: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, rpc: async () => ({ data: null, error: new Error(\"stubbed\") }), from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) }; }",
          };
        });
      },
    }],
    logLevel: "silent",
  });
  // Some bundled modules touch `window` at import time; Node has none.
  if (typeof globalThis.window === "undefined") {
    const win = { self: undefined, top: undefined, location: { href: "http://localhost/", origin: "http://localhost" } };
    win.self = win;
    win.top = win;
    globalThis.window = win;
  }
  return import(pathToFileURL(outfile).href);
}

const render = (Component, initialEntries) => renderToStaticMarkup(
  React.createElement(MemoryRouter, { initialEntries }, React.createElement(Component)),
);

test("grants tabs are exactly Opportunities and Hackathon, deep-linked by ?tab=, unknown falls back", async () => {
  const mod = await grantsModule();
  assert.deepEqual(mod.GRANTS_PAGE_TABS.map((tab) => tab.label), ["Opportunities", "Hackathon"]);
  assert.equal(new Set(mod.GRANTS_PAGE_TABS.map((tab) => tab.id)).size, 2);
  assert.equal(mod.grantsTabFromParam("opportunities"), "opportunities");
  assert.equal(mod.grantsTabFromParam("hackathon"), "hackathon");
  assert.equal(mod.grantsTabFromParam("HACKATHON"), "hackathon");
  assert.equal(mod.grantsTabFromParam(""), "opportunities");
  assert.equal(mod.grantsTabFromParam("unknown-tab"), "opportunities");
  assert.equal(mod.grantsTabFromParam(null), "opportunities");
  const page = read("src/pages/Institutions.jsx");
  for (const tab of mod.GRANTS_PAGE_TABS) {
    assert.ok(page.includes(`id="grants-panel-${tab.id}"`), `missing panel ${tab.id}`);
    assert.ok(page.includes(`aria-labelledby="grants-tab-${tab.id}"`), `missing tab button ${tab.id}`);
  }
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=\{tab === item\.id\}/);
  assert.match(page, /useSearchParams\(\)/);
  assert.match(page, /params\.get\("tab"\)/);
  assert.match(page, /Grants & Opportunities/);
  assert.doesNotMatch(page, /Institutions, grants, business & volunteers/);
  assert.match(page, /Worldwide opportunity research/);
});

test("tab switches preserve ?campaign= when building the next ?tab= search", async () => {
  const mod = await grantsModule();
  assert.equal(mod.grantsTabSearch(`campaign=${CAMPAIGN}`, "hackathon"), `?campaign=${CAMPAIGN}&tab=hackathon`);
  assert.equal(mod.grantsTabSearch(`campaign=${CAMPAIGN}&tab=opportunities`, "hackathon"), `?campaign=${CAMPAIGN}&tab=hackathon`);
  assert.equal(mod.grantsTabSearch(`campaign=${CAMPAIGN}`, "bogus"), `?campaign=${CAMPAIGN}&tab=opportunities`);
  assert.equal(mod.grantsTabSearch("", "hackathon"), "?tab=hackathon");
  assert.equal(mod.grantsTabSearch("", "bogus"), "?tab=opportunities");
  const page = read("src/pages/Institutions.jsx");
  assert.match(page, /function setTab\(next\)/);
  assert.match(page, /new URLSearchParams\(params\)/);
  assert.match(page, /nextParams\.set\("tab",\s*grantsTabFromParam\(next\)\)/);
  assert.match(page, /setParams\(nextParams,\s*\{replace:\s*true\}\)/);
});

test("default tab (?tab absent) shows the Opportunities content, not the Hackathon panel", async () => {
  const { default: Institutions } = await grantsModule();
  setFixture(signedOut, "signed-out");
  const html = render(Institutions, ["/institutions"]);
  assert.match(html, /Grants &amp; Opportunities/);
  assert.match(html, /Worldwide opportunity research/);
  assert.match(html, /id="grants-panel-opportunities"/);
  assert.match(html, /id="grants-tab-opportunities" aria-selected="true"/);
  assert.match(html, /id="grants-tab-hackathon" aria-selected="false"/);
  assert.match(html, /Agent-guided campaign matching/);
  assert.match(html, /All research sources/);
  assert.match(html, /id="inst-search"/);
  assert.match(html, /id="inst-campaign"/);
  assert.doesNotMatch(html, /id="grants-panel-hackathon"/);
  assert.doesNotMatch(html, /Open the guided demo/);
  assert.doesNotMatch(html, /\/hackathon\/tracker/);
  // The whole existing body stays on the Opportunities tab: the verified
  // programs section and the research directories render from this panel.
  const page = read("src/pages/Institutions.jsx");
  assert.ok(page.indexOf("grants-panel-opportunities") < page.indexOf("Verified programs & applications"));
  assert.ok(page.indexOf("Verified programs & applications") < page.indexOf("Additional research directories"));
  assert.ok(page.indexOf("Additional research directories") < page.indexOf("grants-panel-hackathon"));
});

test("?tab=hackathon shows the public Hackathon summary with the /hackathon link and no tracker data", async () => {
  const { default: Institutions } = await grantsModule();
  setFixture(signedOut, "signed-out");
  const html = render(Institutions, ["/institutions?tab=hackathon"]);
  assert.match(html, /id="grants-panel-hackathon"/);
  assert.match(html, /id="grants-tab-hackathon" aria-selected="true"/);
  assert.match(html, /id="grants-tab-opportunities" aria-selected="false"/);
  assert.match(html, /PayPal AI Hackathon 2026 demo/);
  assert.match(html, /Sandbox only/);
  assert.match(html, /no real money is collected/);
  assert.match(html, /Open the guided demo/);
  assert.match(html, /href="\/hackathon"/);
  assert.match(html, /https:\/\/ifund-hackathon-demo\.interplanetary-fund\.workers\.dev\/hackathon/);
  assert.match(html, /independent judge walkthrough/);
  assert.doesNotMatch(html, /id="grants-panel-opportunities"/);
  assert.doesNotMatch(html, /Agent-guided campaign matching/);
  assert.doesNotMatch(html, /\/hackathon\/tracker/);
  assert.doesNotMatch(html, /Organizer demo tracker/);
  // No tracker data is wired into this page at all: no tracker component,
  // lib, or sandbox API import.
  const page = read("src/pages/Institutions.jsx");
  assert.doesNotMatch(page, /HackathonTracker|hackathonTracker|hackathonFinanceDemo/);
  assert.doesNotMatch(page, /\/api\/paypal\/sandbox/);
});

test("?tab=opportunities shows Opportunities and an unknown ?tab= falls back to Opportunities", async () => {
  const { default: Institutions } = await grantsModule();
  setFixture(signedOut, "signed-out");
  const explicit = render(Institutions, ["/institutions?tab=opportunities"]);
  assert.match(explicit, /id="grants-panel-opportunities"/);
  assert.match(explicit, /Agent-guided campaign matching/);
  assert.doesNotMatch(explicit, /id="grants-panel-hackathon"/);
  const unknown = render(Institutions, ["/institutions?tab=not-a-tab"]);
  assert.match(unknown, /id="grants-panel-opportunities"/);
  assert.match(unknown, /id="grants-tab-opportunities" aria-selected="true"/);
  assert.match(unknown, /Agent-guided campaign matching/);
  assert.doesNotMatch(unknown, /id="grants-panel-hackathon"/);
  assert.doesNotMatch(unknown, /Open the guided demo/);
});

test("?campaign= does not break either tab", async () => {
  const { default: Institutions } = await grantsModule();
  setFixture(signedOut, "signed-out");
  const opportunities = render(Institutions, [`/institutions?campaign=${CAMPAIGN}`]);
  assert.match(opportunities, /id="grants-panel-opportunities"/);
  assert.match(opportunities, /id="inst-campaign"/);
  const hackathon = render(Institutions, [`/institutions?campaign=${CAMPAIGN}&tab=hackathon`]);
  assert.match(hackathon, /id="grants-panel-hackathon"/);
  assert.match(hackathon, /href="\/hackathon"/);
});

test("organizer tracker link is hidden for non-super-admin viewers and shown for super-admins", async () => {
  const { default: Institutions } = await grantsModule();
  setFixture(signedIn, "denied");
  const denied = render(Institutions, ["/institutions?tab=hackathon"]);
  assert.match(denied, /id="grants-panel-hackathon"/);
  assert.doesNotMatch(denied, /\/hackathon\/tracker/);
  assert.doesNotMatch(denied, /Organizer demo tracker/);
  setFixture(signedOut, "signed-out");
  const signedOutHtml = render(Institutions, ["/institutions?tab=hackathon"]);
  assert.doesNotMatch(signedOutHtml, /\/hackathon\/tracker/);
  setFixture(signedIn, "super-admin");
  const admin = render(Institutions, ["/institutions?tab=hackathon"]);
  assert.match(admin, /href="\/hackathon\/tracker"/);
  assert.match(admin, /Organizer demo tracker/);
  // The gate reuses the same hook Layout uses and fails closed: only the
  // verified "super-admin" status renders the link.
  const page = read("src/pages/Institutions.jsx");
  assert.match(page, /useSuperAdminAccess\(user\)\s*===\s*"super-admin"/);
  assert.match(page, /useAuthSession\(\)/);
  assert.match(page, /import \{ useSuperAdminAccess \} from "@\/hooks\/useSuperAdminAccess"/);
});

test("the demo and tracker routes keep their own pages — nothing here redirects or moves them", async () => {
  const app = read("src/App.jsx");
  assert.match(app, /<Route path="\/hackathon" element=\{<HackathonDemo \/>} \/>/);
  assert.match(app, /<Route path="\/hackathon\/tracker" element=\{<MemberAccess><SuperAdminAccess><HackathonTracker/);
  const page = read("src/pages/Institutions.jsx");
  assert.doesNotMatch(page, /Navigate to="\/hackathon/);
  assert.doesNotMatch(page, /\/hackathon\?tab=/);
});
