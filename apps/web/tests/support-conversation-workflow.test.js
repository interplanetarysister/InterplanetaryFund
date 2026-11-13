import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261113_ifund_support_replies.sql");
const thread = read("../src/components/support/SupportConversation.jsx");
const tickets = read("../src/pages/SupportTickets.jsx");

test("replies are private, owner scoped and may only be added to open cases", () => {
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.ifund_support_replies from public,anon,authenticated/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /v_owner<>v_uid::text and not v_admin/);
  assert.match(sql, /v_status<>'open'/);
  assert.match(sql, /is_anonymous is false/);
  assert.match(sql, /email_confirmed_at is not null/);
  assert.match(sql, />=10 then/);
});

test("administrator replies generate owner notifications, not payment records", () => {
  assert.match(sql, /insert into public\.ifund_notifications/);
  assert.match(sql, /'system','\/support'/);
  assert.match(sql, /if v_admin and v_owner/);
  assert.doesNotMatch(sql, /insert into public\.ifund_(donations|ledger_entries|payment_intents)/);
});

test("authenticated reply RPCs guard both read and write", () => {
  for (const signature of ["ifund_add_support_reply(text,text)", "ifund_support_ticket_replies(text)"]) {
    assert.ok(sql.includes("revoke all on function public." + signature + " from public,anon"));
    assert.ok(sql.includes("grant execute on function public." + signature + " to authenticated"));
  }
  assert.match(sql, /ifund_current_user_is_verified_super_admin/);
  assert.match(sql, /v_owner<>v_uid::text/);
});

test("support conversation is integrated into member history and administrator queue", () => {
  assert.match(tickets, /import SupportConversation/);
  assert.equal((tickets.match(/<SupportConversation ticketId=/g) || []).length, 2);
  assert.match(thread, /rpc\("ifund_support_ticket_replies"/);
  assert.match(thread, /rpc\("ifund_add_support_reply"/);
  assert.match(thread, /ticketStatus === "open"/);
  assert.match(thread, /ticketStatus !== "open"/);
});
