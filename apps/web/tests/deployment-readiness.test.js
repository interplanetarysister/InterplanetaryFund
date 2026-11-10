import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// The branded frontend is served by Cloudflare Pages, so these files ship with
// the bundle and are the difference between a working site and a broken one.
// Asserting them here means a change that drops the SPA fallback or weakens the
// framing rules fails CI instead of production.
const web = (p) => new URL("../" + p, import.meta.url);
const read = (p) => readFileSync(web(p), "utf8");
const repo = (p) => new URL("../../../" + p, import.meta.url);

test("Cloudflare Pages native SPA fallback handles deep links without redirect loops", () => {
  // Pages automatically serves / when a path has no matching asset and no
  // top-level 404.html exists; the old /* /index.html 200 rule loops and is ignored.
  assert.equal(existsSync(web("public/_redirects")), false, "remove invalid catch-all rewrite");
  assert.equal(existsSync(web("public/404.html")), false, "404.html disables native SPA fallback");
});

test("security headers are set without white-screening the app", () => {
  assert.ok(existsSync(web("public/_headers")), "public/_headers must exist");
  // Only real directive lines matter; the file's own comments mention header
  // names and would otherwise satisfy (or trip) these checks.
  const headers = read("public/_headers").split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/);
  assert.match(headers, /Strict-Transport-Security:\s*max-age=\d+/);
  assert.match(headers, /Referrer-Policy:/);
  assert.match(headers, /Permissions-Policy:/);
  // Baseline CSP that cannot break the app: no object, no <base> hijack, and
  // same-origin framing by default.
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /base-uri 'self'/);
  assert.match(headers, /frame-ancestors 'self'/);
  // A restrictive default-src would need live verification; if one is ever
  // added it must at least allow the app's own origin.
  const defaultSrc = headers.match(/default-src[^;\n]*/);
  if (defaultSrc) assert.match(defaultSrc[0], /'self'/);
});

test("the embed card stays framable by third-party sites", () => {
  const headers = read("public/_headers");
  const block = headers.slice(headers.indexOf("/embed/*"));
  assert.ok(block.length > 0, "/embed/* must have its own header block");
  assert.match(block, /frame-ancestors \*/, "the embed route must not be same-origin only");
});

test("the deploy workflow exists and defaults to a preview, never production", () => {
  const path = repo(".github/workflows/deploy-web-pages.yml");
  assert.ok(existsSync(path), "deploy workflow must exist");
  const wf = readFileSync(path, "utf8");
  // Never deploy on pull_request: a PR must not be able to replace the live site.
  assert.doesNotMatch(wf, /^\s*pull_request:/m);
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /production:/);
  assert.match(wf, /default:\s*false/);
  // Preview unless production was explicitly requested.
  assert.match(wf, /branch=preview/);
  assert.match(wf, /branch=main/);
  assert.match(wf, /pages deploy dist/);
});

test("the deploy workflow uses secrets, never hardcoded credentials", () => {
  const wf = readFileSync(repo(".github/workflows/deploy-web-pages.yml"), "utf8");
  assert.match(wf, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(wf, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  // No literal credential of any kind may appear in the workflow.
  for (const forbidden of [/sb_secret_/, /service_role/i, /eyJ[A-Za-z0-9_-]{10,}/, /CLOUDFLARE_API_TOKEN:\s*["']?[A-Za-z0-9]/]) {
    assert.doesNotMatch(wf, forbidden, `workflow must not contain ${forbidden}`);
  }
  // The publishable key must come from a repository variable, not a literal.
  assert.match(wf, /vars\.VITE_SUPABASE_PUBLISHABLE_KEY/);
});

test("the deploy workflow refuses to publish a build with no backend", () => {
  const wf = readFileSync(repo(".github/workflows/deploy-web-pages.yml"), "utf8");
  assert.match(wf, /vars\.VITE_SUPABASE_URL == ''/);
  assert.match(wf, /Refusing to publish a build with no backend/);
  // It must prove the deep-link and header files made it into the bundle.
  assert.match(wf, /test ! -e dist\/_redirects/);
  assert.match(wf, /test ! -e dist\/404.html/);
  assert.match(wf, /test -f dist\/_headers/);
});
