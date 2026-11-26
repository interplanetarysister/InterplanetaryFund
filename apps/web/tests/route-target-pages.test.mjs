import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Sprint 8 (2026-11-25): the 40-page target inventory in
// ci/route-acceptance.json is the gate's model of the consolidated IA. The
// gate itself only reads App.jsx, Layout.jsx, and the manifest, so it cannot
// prove a tab id exists in a page component. This test is that proof: every
// tab id must appear in the page's own source, every hosted page's canonical
// tab must be offered by exactly one page, and every folded route must
// resolve to a real tab of its target page.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "ci/route-acceptance.json"), "utf8"));
const app = readFileSync(resolve(root, "src/App.jsx"), "utf8");
const declaredRoutes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));

test("the 40-page target inventory covers pages 1-40 exactly once", () => {
  assert.ok(Array.isArray(manifest.target_pages), "missing target_pages");
  assert.equal(manifest.target_pages.length, 40, "expected exactly 40 target pages");
  assert.deepEqual(
    manifest.target_pages.map((p) => p.page).sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => i + 1),
    "target pages must be 1-40 with no gaps or duplicates",
  );
  const homes = new Map();
  for (const page of manifest.target_pages) {
    assert.ok(page.name && page.tab_param, "incomplete target page " + page.page);
    assert.ok(["tab", "section", "anchor", "none"].includes(page.tab_param),
      "invalid tab_param for target page " + page.page);
    if (page.canonical_route !== null) {
      assert.ok(declaredRoutes.has(page.canonical_route),
        "undeclared canonical route for target page " + page.page);
      const home = page.canonical_route + "|" + (page.canonical_tab ?? "");
      assert.ok(!homes.has(home), "duplicate 40-page target home: " + home);
      homes.set(home, page.page);
    } else {
      assert.ok(page.note, "routeless target page needs a recorded gap note: " + page.page);
      assert.equal(page.tabs.length, 0, "routeless target page must not list tabs: " + page.page);
    }
    const ids = page.tabs.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate tab on target page " + page.page);
    for (const id of ids)
      assert.match(id, /^[a-z0-9-]+$/, "tab id must be a URL slug: " + id);
  }
});

test("every target page tab id exists in the page source", () => {
  for (const page of manifest.target_pages) {
    assert.ok(Array.isArray(page.source_files) && page.source_files.length > 0,
      "target page " + page.page + " needs source files");
    const sources = [];
    for (const file of page.source_files) {
      const path = resolve(root, file);
      assert.ok(existsSync(path), "missing target page source: " + file);
      sources.push(readFileSync(path, "utf8"));
    }
    for (const tab of page.tabs) {
      const quoted = [`"${tab.id}"`, `'${tab.id}'`];
      assert.ok(
        sources.some((src) => quoted.some((q) => src.includes(q))),
        `tab ${tab.id} of target page ${page.page} does not appear in ${page.source_files.join(", ")}`,
      );
    }
  }
});

test("every hosted page's canonical tab is offered by exactly one page", () => {
  const owners = new Map();
  for (const page of manifest.target_pages)
    for (const tab of page.tabs) {
      if (!owners.has(tab.id)) owners.set(tab.id, []);
      owners.get(tab.id).push(page.page);
    }
  for (const page of manifest.target_pages) {
    if (page.canonical_tab == null) continue;
    assert.equal((owners.get(page.canonical_tab) || []).length, 1,
      `canonical tab ${page.canonical_tab} for target page ${page.page} must be offered by exactly one page`);
  }
});

test("every folded route resolves to a real tab of its target page", () => {
  const tabsByPage = new Map(
    manifest.target_pages.map((p) => [p.page, new Set(p.tabs.map((t) => t.id))]),
  );
  for (const entry of manifest.routes) {
    if (entry.disposition !== "folded") continue;
    assert.ok(typeof entry.redirect_target === "string" && entry.redirect_target,
      "folded route needs a redirect target: " + entry.route);
    const target = entry.redirect_target;
    const query = target.split("#")[0];
    const path = query.split("?")[0];
    assert.ok(declaredRoutes.has(path),
      `fold target is not a declared route: ${entry.route} -> ${target}`);
    const params = new URLSearchParams(query.includes("?") ? query.slice(query.indexOf("?") + 1) : "");
    const tabId = params.get("tab") || params.get("section");
    if (!tabId) continue;
    assert.ok(tabsByPage.has(entry.page_40), "folded route has no target page: " + entry.route);
    assert.ok(tabsByPage.get(entry.page_40).has(tabId),
      `fold target tab does not exist on target page ${entry.page_40}: ${entry.route} -> ${target}`);
  }
});

test("every route row carries its 40-page annotation", () => {
  assert.equal(manifest.routes.length, 105, "expected 105 route rows");
  for (const entry of manifest.routes) {
    assert.ok(["kept", "folded", "utility"].includes(entry.disposition),
      "invalid fold disposition: " + entry.route);
    if (entry.disposition === "utility") {
      assert.equal(entry.page_40, null, "utility route must not claim a target page: " + entry.route);
      assert.equal(entry.redirect_target, null, "utility route must not carry a redirect target: " + entry.route);
    } else {
      assert.equal(typeof entry.page_40, "number", "missing target page for route: " + entry.route);
      assert.ok(entry.page_40 >= 1 && entry.page_40 <= 40, "target page out of range: " + entry.route);
    }
    if (entry.disposition === "folded")
      assert.ok(typeof entry.redirect_target === "string" && entry.redirect_target,
        "folded route needs a redirect target: " + entry.route);
    else
      assert.equal(entry.redirect_target, null,
        "non-folded route must not carry a redirect target: " + entry.route);
  }
});
