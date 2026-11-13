import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { helpStudioSlug, helpStudioPayload, helpStudioAnswer } from "../src/lib/studioHelpContent.mjs";
import { validateAuditRows, auditCursor, AUDIT_PAGE_SIZE } from "../src/lib/adminAuditFeed.mjs";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
const route = path => app.split("\n").find(line => line.includes('path="' + path + '"'));
const page = name => readFileSync(new URL("../src/pages/" + name + ".jsx", import.meta.url), "utf8");
const article = { slug: "create-a-campaign", question: "How do I create a campaign?" };
const answer = "Open New Campaign, add your verified details, and explicitly publish when ready.";

test("Help Studio maps only known, safe article slugs", () => {
  assert.equal(helpStudioSlug(article.slug), "help-create-a-campaign");
  for (const slug of ["../../admin", "UPPER", "", "bad slug", "a".repeat(60), "a--b"])
    assert.throws(() => helpStudioSlug(slug));
  const payload = helpStudioPayload(article, answer, "draft");
  assert.equal(payload.status, "draft");
  assert.equal(payload.content.blocks.length, 1);
  assert.equal(payload.content.blocks[0].id, "help-main");
  assert.equal(helpStudioAnswer(payload, article.slug), null,
    "a saved draft must never override the public article");
  assert.equal(helpStudioAnswer({ ...payload, status: "published" }, article.slug), answer);
  assert.equal(helpStudioAnswer({ ...payload, status: "published" }, "campaign-donations"), null);
  assert.throws(() => helpStudioPayload(article, "too short", "published"));
  assert.throws(() => helpStudioPayload(article, "x".repeat(4001), "published"));
  assert.throws(() => helpStudioPayload(article, answer, "deleted"));
});

test("audit feed rejects malformed pages and never returns raw record fields", () => {
  const valid = [
    { event_id: "workflow:55", event_source: "workflow", event_name: "completed",
      occurred_at: "2026-11-13T03:00:00Z", details: { secret: "PRIVATE" } },
    { event_id: "mail:10000000-0000-4000-8000-000000000001",
      event_source: "administrative mail", event_name: "read",
      occurred_at: "2026-11-13T02:00:00Z" },
    { event_id: "incident:INC-123", event_source: "platform incident",
      event_name: "incident updated", occurred_at: "2026-11-13T01:00:00Z" },
  ];
  const parsed = validateAuditRows(valid);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].details, undefined);
  assert.deepEqual(auditCursor(parsed), {
    p_before_at: "2026-11-13T01:00:00Z", p_before_id: "incident:INC-123",
  });
  assert.deepEqual(auditCursor([]), { p_before_at: null, p_before_id: null });
  assert.throws(() => validateAuditRows([...valid, valid[0]]), /duplicate/);
  assert.throws(() => validateAuditRows([...valid].reverse()), /out of order/);
  assert.throws(() => validateAuditRows([{ ...valid[0], event_source: "banking" }]), /invalid record/);
  assert.throws(() => validateAuditRows([{ ...valid[0], occurred_at: "not-a-date" }]), /timestamp/);
  assert.throws(() => validateAuditRows(Array(AUDIT_PAGE_SIZE + 1).fill(valid[0])), /unexpected page/);
});

test("admin routes enforce server-backed role checks and honest read-only provenance", () => {
  for (const [path,component] of [
    ["/admin/audit","AdminAudit"], ["/admin/help","AdminHelpEditor"],
  ]) {
    assert.ok(route(path)?.includes("<MemberAccess><SuperAdminAccess><" + component),
      path + " must require verified super-admin before loading private records");
  }
  assert.match(layout, /useSuperAdminAccess\(user\)/, "restricted nav must use server-verified super admin");
  assert.match(layout, /superAdminOnly/, "restricted links must not be visible as an ordinary admin");
  assert.match(page("AdminAudit"), /client\.rpc\("ifund_super_admin_audit_feed"/,
    "the audit source is the role-protected and bounded database RPC");
  assert.match(page("AdminHelpEditor"), /\/api\/studio\/pages/,
    "help editor reuses authorized Website Studio API");
  assert.match(page("HelpArticle"), /\/api\/public\/studio\/pages/,
    "public page reads only a published Studio article");
  assert.match(page("HelpArticle"), /article\.answer/,
    "bundled guidance survives a missing optional published override");
});

test("staged audit database function fails closed before exposing private operations", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/pending/20261113_ifund_super_admin_audit_feed.sql", import.meta.url), "utf8");
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path TO ''/i);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
  assert.match(sql, /ifund_current_user_is_verified_super_admin\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated;/);
  assert.match(sql, /p_limit > 100/, "audit read requests must be bounded");
  assert.doesNotMatch(sql, /select\s+\*/i, "audit cannot export opaque event details");
});
