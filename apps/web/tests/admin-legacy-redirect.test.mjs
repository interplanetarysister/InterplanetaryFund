import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const hub = read("../src/pages/AdminHub.jsx");

/* Follow-up (2026-11-26, live-browser redirect/tab check): /admin/ops and
   /admin/platform had no route at all — they fell through to the /admin/* 404,
   while every other admin sub-route redirects to its Admin Console tab. The
   /admin/* catch-all now maps known Admin Console tab ids to /admin?tab=<id>
   with the same bare-Navigate mechanism as the /globe, /blogs, /news and
   /mission redirects; unknown segments still 404. The five member-gated
   redirects (/devices, /donors, /support, /ops, /platform) are deliberately
   NOT unwrapped here: their MemberAccess/SuperAdminAccess wrappers are pinned
   by route-completion-increments and support-ticket-workflow, and their
   destinations gate themselves — a signed-out visitor sees the register gate
   on the canonical URL either way, so unwrapping would only move the gate. */

const redirectFn = app.match(/function AdminLegacyRedirect\(\) \{([\s\S]*?)\n\}/);
assert.ok(redirectFn, "AdminLegacyRedirect exists");
const fnBody = redirectFn[1];

test("/admin/* uses the admin legacy redirect, not a bare 404", () => {
  assert.match(app, /<Route path="\/admin\/\*" element=\{<AdminLegacyRedirect \/>} \/>/);
  assert.match(fnBody, /return <Navigate to=\{`\/admin\?tab=\$\{tab\}`\} replace \/>/,
    "known tab ids redirect to /admin?tab=<id>");
  assert.match(fnBody, /return <PageNotFound \/>;/,
    "unknown segments still render the real 404 page");
});

const tabIdsBlock = app.match(/const ADMIN_CONSOLE_TAB_IDS = \[([\s\S]*?)\];/);
assert.ok(tabIdsBlock, "ADMIN_CONSOLE_TAB_IDS exists");
const tabIds = tabIdsBlock[1];

test("the catch-all tab list matches the Admin Console tabs", () => {
  const hubIds = [...hub.matchAll(/\{ id: "([a-z-]+)", label:/g)].map(([, id]) => id);
  assert.ok(hubIds.length >= 11, "AdminHub tab list parses");
  for (const id of hubIds) {
    assert.ok(tabIds.includes(`"${id}"`), `catch-all covers Admin Console tab "${id}"`);
  }
  // The two routes the live check found 404ing:
  assert.ok(tabIds.includes('"ops"'), "catch-all covers ops");
  assert.ok(tabIds.includes('"platform"'), "catch-all covers platform");
});

test("specific admin sub-routes still exist and win over the catch-all", () => {
  for (const path of ["/admin/studio", "/admin/audit", "/admin/deletions", "/admin/integrations", "/admin/help", "/admin/sustainability", "/admin/sponsor-inquiries", "/admin/social-moderation"]) {
    assert.match(app, new RegExp(`<Route path="${path.replace("/", "\\/")}"`),
      `${path} must remain a registered route`);
  }
  // /admin/finance is the exception: it redirects to Finances, not a tab.
  assert.match(app, /<Route path="\/admin\/finance" element=\{<MemberAccess><AdminAccess><Navigate to="\/finances#platform-finance" replace \/><\/AdminAccess><\/MemberAccess>} \/>/);
});

test("member-gated redirects keep their access wrappers (not unwrapped)", () => {
  const route = path => app.split("\n").find(line => line.includes(`path="${path}"`)) || "";
  assert.ok(route("/devices")?.includes("<MemberAccess>"), "/devices stays member-guarded");
  assert.ok(route("/donors")?.includes('<MemberAccess><Navigate to="/engagement"'), "/donors stays member-guarded");
  assert.ok(route("/support")?.includes('<MemberAccess><Navigate to="/help?tab=tickets"'), "/support stays member-guarded");
  for (const path of ["/ops", "/platform"]) {
    const entry = route(path);
    assert.ok(entry?.includes("<MemberAccess>") && entry.includes("<SuperAdminAccess>"),
      `${path} stays restricted to verified super-admin`);
  }
});
