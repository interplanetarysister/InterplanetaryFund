/**
 * Fail before npm install/build/deploy if any linked route is still routed to
 * a branded placeholder or if a navigation item has no explicit route.
 * This is a necessary source gate, not proof of E2E readiness or provider safety.
 */
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const unfinished = [];
const mappedLegacyRoutes = new Set();
for (const key of ["STANDALONE_COMING_SOON", "LAYOUT_COMING_SOON"]) {
  const block = app.match(new RegExp("const\\s+" + key + "\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;"));
  if (!block) {
    unfinished.push("Missing verified " + key + " inventory");
    continue;
  }
  for (const match of block[1].matchAll(/["'](\/[^"']+)["']/g)) {
    unfinished.push("Unimplemented route: " + match[1]);
    mappedLegacyRoutes.add(match[1]);
  }
}
if (/const\s+ComingSoon\s*=|element=\{<ComingSoon\s*\/>\}/.test(app)) {
  unfinished.push("ComingSoon route component still referenced");
}
const declaredRoutes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(row => row[1]));
const navigation = new Set([...layout.matchAll(/\{\s*to:\s*"(\/[^"]+)"/g)].map(row => row[1]));
for (const path of navigation) {
  if (!declaredRoutes.has(path)) {
    unfinished.push("Navigation has no explicit route: " + path);
  }
}
// All explicit routes and mapped legacy routes must have individual source
// and negative-case evidence before the one consolidated preview build.
const acceptanceRoutes = new Set([...declaredRoutes, ...mappedLegacyRoutes]);
const allowedRoles = new Set(["public", "member", "admin", "super_admin"]);
const allowedStatuses = new Set(["not_implemented", "not_verified", "source_ready"]);
try {
  const register = JSON.parse(read("ci/route-acceptance.json"));
  if (register.schema_version !== 1 || !Array.isArray(register.routes))
    throw Error("Unsupported or missing route inventory schema");
  const byRoute = new Map();
  for (const entry of register.routes) {
    if (!entry || typeof entry.route !== "string" || byRoute.has(entry.route)) {
      unfinished.push("Duplicate or invalid route acceptance row");
      continue;
    }
    byRoute.set(entry.route, entry);
    if (!acceptanceRoutes.has(entry.route))
      unfinished.push("Stale acceptance route: " + entry.route);
    if (!allowedRoles.has(entry.role))
      unfinished.push("Invalid route role: " + entry.route);
    if (!allowedStatuses.has(entry.source_status))
      unfinished.push("Invalid route source state: " + entry.route);
    if (entry.source_status !== "source_ready" ||
        typeof entry.source_evidence !== "string" || !entry.source_evidence.trim() ||
        typeof entry.behavior_evidence !== "string" || !entry.behavior_evidence.trim())
      unfinished.push("Missing source and test acceptance: " + entry.route);
    // A protected route cannot be accepted based only on a rendered page.
    // Require negative-case server authorization/RLS evidence for each role.
    if (entry.role !== "public" &&
        (typeof entry.backend_evidence !== "string" || !entry.backend_evidence.trim()))
      unfinished.push("Missing backend authorization evidence: " + entry.route);
  }
  for (const route of acceptanceRoutes)
    if (!byRoute.has(route)) unfinished.push("Untracked source route: " + route);
  // Sprint 8 (2026-11-25): the 40-page target. target_pages models the
  // consolidated IA; every folded route's redirect target must resolve to a
  // real tab of its target page, and tabs need the same source, behavior,
  // and (for non-public pages) backend evidence as routes. This block is
  // additive: it never removes a route finding and never adds an exemption.
  try {
    const pages = register.target_pages;
    if (!Array.isArray(pages)) throw Error("Missing 40-page target inventory");
    const allowedTabParams = new Set(["tab", "section", "anchor", "none"]);
    const seenPages = new Set();
    const seenPairs = new Set();
    const tabsByPage = new Map();
    const tabOwners = new Map();
    for (const page of pages) {
      if (!page || typeof page.page !== "number" || page.page < 1 || page.page > 40 || seenPages.has(page.page)) {
        unfinished.push("Duplicate or invalid 40-page target entry");
        continue;
      }
      seenPages.add(page.page);
      if (typeof page.name !== "string" || !page.name.trim())
        unfinished.push("Missing 40-page target name: " + page.page);
      if (!allowedTabParams.has(page.tab_param))
        unfinished.push("Invalid tab parameter for target page " + page.page);
      if (page.canonical_route !== null && !declaredRoutes.has(page.canonical_route))
        unfinished.push("Undeclared canonical route for target page " + page.page + ": " + page.canonical_route);
      if (page.canonical_route === null && (!Array.isArray(page.tabs) || page.tabs.length !== 0))
        unfinished.push("Routeless target page must not list tabs: " + page.page);
      if (page.canonical_route === null && (typeof page.note !== "string" || !page.note.trim()))
        unfinished.push("Routeless target page needs a recorded gap note: " + page.page);
      if (page.canonical_route !== null) {
        const pair = page.canonical_route + "|" + (page.canonical_tab ?? "");
        if (seenPairs.has(pair)) unfinished.push("Duplicate 40-page target home: " + pair);
        seenPairs.add(pair);
      }
      if (!Array.isArray(page.tabs)) {
        unfinished.push("Missing tab list for target page " + page.page);
        continue;
      }
      const tabIds = new Map();
      const hostRole = page.canonical_route !== null
        ? (byRoute.get(page.canonical_route)?.role ?? "public")
        : "public";
      for (const tab of page.tabs) {
        if (!tab || typeof tab.id !== "string" || !tab.id || tabIds.has(tab.id)) {
          unfinished.push("Duplicate or invalid tab for target page " + page.page);
          continue;
        }
        tabIds.set(tab.id, tab);
        if (!tabOwners.has(tab.id)) tabOwners.set(tab.id, []);
        tabOwners.get(tab.id).push(page.page);
        if (!allowedStatuses.has(tab.source_status))
          unfinished.push("Invalid tab source state: target page " + page.page + " tab " + tab.id);
        if (tab.source_status !== "source_ready" ||
            typeof tab.source_evidence !== "string" || !tab.source_evidence.trim() ||
            typeof tab.behavior_evidence !== "string" || !tab.behavior_evidence.trim())
          unfinished.push("Missing source and test acceptance: target page " + page.page + " tab " + tab.id);
        if (hostRole !== "public" &&
            (typeof tab.backend_evidence !== "string" || !tab.backend_evidence.trim()))
          unfinished.push("Missing backend authorization evidence: target page " + page.page + " tab " + tab.id);
      }
      tabsByPage.set(page.page, tabIds);
    }
    if (seenPages.size !== 40)
      unfinished.push("40-page target inventory has " + seenPages.size + " pages, expected 40");
    for (let n = 1; n <= 40; n++)
      if (!seenPages.has(n)) unfinished.push("Missing 40-page target page: " + n);
    for (const page of pages) {
      if (!page || page.canonical_tab == null) continue;
      const owners = tabOwners.get(page.canonical_tab) || [];
      if (owners.length !== 1)
        unfinished.push("Canonical tab " + page.canonical_tab + " for target page " + page.page +
          " is offered by " + owners.length + " pages, expected 1");
    }
    const allowedDispositions = new Set(["kept", "folded", "utility"]);
    for (const entry of register.routes) {
      if (!entry || typeof entry.route !== "string") continue;
      if (!allowedDispositions.has(entry.disposition))
        unfinished.push("Invalid fold disposition: " + entry.route);
      if (entry.disposition === "utility" && entry.page_40 !== null)
        unfinished.push("Utility route must not claim a target page: " + entry.route);
      if (entry.disposition !== "utility" && typeof entry.page_40 !== "number")
        unfinished.push("Missing target page for route: " + entry.route);
      if (entry.disposition === "folded" && (typeof entry.redirect_target !== "string" || !entry.redirect_target))
        unfinished.push("Folded route needs a redirect target: " + entry.route);
      if (entry.disposition !== "folded" && entry.redirect_target != null)
        unfinished.push("Non-folded route must not carry a redirect target: " + entry.route);
      if (entry.disposition !== "folded" || typeof entry.redirect_target !== "string") continue;
      const target = entry.redirect_target;
      const query = target.split("#")[0];
      const path = query.split("?")[0];
      if (!declaredRoutes.has(path)) {
        unfinished.push("Fold target is not a declared route: " + entry.route + " -> " + target);
        continue;
      }
      const params = new URLSearchParams(query.includes("?") ? query.slice(query.indexOf("?") + 1) : "");
      const tabId = params.get("tab") || params.get("section");
      if (!tabId) continue;
      if (typeof entry.page_40 !== "number" || !tabsByPage.has(entry.page_40)) {
        unfinished.push("Folded route has no target page: " + entry.route);
        continue;
      }
      if (!tabsByPage.get(entry.page_40).has(tabId))
        unfinished.push("Fold target tab does not exist on target page " + entry.page_40 +
          ": " + entry.route + " -> " + target);
    }
  } catch (error) {
    unfinished.push("40-page target inventory unreadable: " + error.message);
  }
} catch (error) {
  unfinished.push("Route acceptance manifest unreadable: " + error.message);
}
if (unfinished.length) {
  process.stderr.write("IFund release gate: route completion is NOT certified.\n" +
    unfinished.map(item => " - " + item).join("\n") + "\n" +
    "Do not compile or publish preview/production. Finish routes, then run negative-case and browser E2E checks.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Static route completeness checked. Still required: RLS, provider, functional and browser acceptance before preview.\n"
  );
}
