import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261113_ifund_member_support_ticket_workflow.sql");
const emailGuard = read("../../../supabase/migrations/20261113_ifund_support_verified_email_guard.sql");
const app = read("../src/App.jsx");
const page = read("../src/pages/SupportTickets.jsx");
const help = read("../src/pages/Help.jsx");
const contact = read("../src/pages/Contact.jsx");

test("support tickets are owned and rate limited by server-verified identity", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(emailGuard, /u\.is_anonymous is false/);
  assert.match(emailGuard, /u\.email_confirmed_at is not null/);
  assert.match(emailGuard, /ifund_current_account_is_active\(\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /t\.user_id=v_uid::text/);
  assert.match(migration, /interval '1 hour'/);
  assert.match(migration, />= 3 then/);
  assert.match(migration, /char_length\(btrim\(p_subject\)\)/);
  assert.match(migration, /char_length\(btrim\(p_message\)\)/);
  assert.match(migration, /status='closed'/);
  assert.match(migration, /ifund_current_user_is_verified_super_admin\(\)/);
});

test("support table is only exposed through authenticated, scoped RPCs", () => {
  for (const signature of [
    "ifund_create_support_ticket(text,text)", "ifund_my_support_tickets()",
    "ifund_super_admin_support_queue()", "ifund_super_admin_close_support_ticket(text)"
  ]) {
    assert.ok(migration.includes("revoke all on function public." + signature + " from public,anon"));
    assert.ok(migration.includes("grant execute on function public." + signature + " to authenticated"));
  }
  assert.doesNotMatch(migration, /grant (insert|select|update|delete) on public\.ifund_support_ticket to anon/i);
});

test("support UI is accessible to members and disallows unauthenticated inline changes", () => {
  assert.match(app, /path="\/support" element=\{<MemberAccess><SupportTickets \/><\/MemberAccess>\}/);
  assert.match(page, /rpc\("ifund_create_support_ticket"/);
  assert.match(page, /rpc\("ifund_my_support_tickets"/);
  assert.match(page, /rpc\("ifund_super_admin_support_queue"/);
  assert.match(page, /rpc\("ifund_super_admin_close_support_ticket"/);
  assert.match(page, /access === "super-admin"/);
  assert.match(page, /email delivery is not implied/);
  assert.match(help, /Open a support ticket/);
  assert.match(contact, /Open support ticket/);
});
