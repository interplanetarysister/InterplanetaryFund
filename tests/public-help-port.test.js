import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { transformWithEsbuild } from "vite";
import { helpArticles } from "../apps/web/src/lib/helpArticles.js";

const source = async (path) =>
  readFile(resolve("apps/web", path), "utf8");

test("restored public Help pages and SPA router have valid JSX syntax", async () => {
  for (const path of ["src/pages/Help.jsx", "src/pages/HelpArticle.jsx", "src/App.jsx"]) {
    const code = await source(path);
    const result = await transformWithEsbuild(code, path, { loader: "jsx" });
    assert.ok(result.code.length > 0, path + " failed compilation");
  }
});

test("Help and article paths are actual routes, not coming-soon placeholders", async () => {
  const app = await source("src/App.jsx");
  assert.equal((app.match(/<Route path="\/help" /g) || []).length, 1);
  assert.equal((app.match(/<Route path="\/help\/:slug" /g) || []).length, 1);
  assert.ok(app.includes('const Help = lazy(() => import("./pages/Help"));'));
  assert.ok(app.includes('"/help", "/help/:slug"'));
});

test("all original Help category names have articles and unique stable slugs", async () => {
  const { HELP_CATEGORIES } = await import("../apps/web/src/lib/helpCenter.js");
  assert.equal(new Set(helpArticles.map((a) => a.slug)).size, helpArticles.length);
  for (const category of HELP_CATEGORIES) {
    assert.ok(helpArticles.some((article) => article.category === category.name), category.name);
  }
});

test("Help remains read-only and does not fake agent, provider or financial activation", async () => {
  const code = await Promise.all([
    source("src/pages/Help.jsx"),
    source("src/pages/HelpArticle.jsx"),
    source("src/lib/helpArticles.js"),
  ]).then((parts) => parts.join("\n"));
  assert.doesNotMatch(code, /@base44\/|base44Client|db\.from\(|\.functions\.invoke\(|fetch\(/);
  assert.match(code, /donations are paused/i);
  assert.match(code, /executors are not yet active/i);
  assert.match(code, /not currently enabled/i);
});

test("public campaign queries use one Supabase project and active-only RLS scope", async () => {
  const api = await source("src/api/publicData.js");
  assert.match(api, /ssibsfmtodgximseeqsv/);
  assert.doesNotMatch(api, /tzehxfikoslihnclhxuz|ifund_migration_active_campaign_preview|ifund_public_campaign_detail/);
  assert.match(api, /\.eq\("status", "active"\)/);
  assert.match(api, /raised_amount: null/);
  assert.match(api, /donor_count: null/);
});

test("Help retains search, accessible topics, legal links and source-style hero", async () => {
  const help = await source("src/pages/Help.jsx");
  assert.match(help, /How can we help\?/);
  assert.match(help, /Browse by topic/);
  assert.match(help, /aria-pressed/);
  assert.match(help, /useSearchParams/);
  assert.match(help, /Legal documents/);
  assert.match(help, /Email IFund support/);
});
