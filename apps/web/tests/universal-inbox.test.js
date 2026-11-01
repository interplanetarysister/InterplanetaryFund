import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadUniversalInbox, markInboxItemDone, markInboxNotificationRead
} from "../src/lib/inbox.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const INBOX_ID = "33333333-3333-4333-8333-333333333333";
const NOTICE_ID = "44444444-4444-4444-8444-444444444444";
const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function fakeClient({
  inbox = [{ id: INBOX_ID, owner_id: OWNER, platform: "interplanetary", type: "message",
    status: "open", content: "private message", created_at: "2026-11-01T12:00:00Z", mailbox_priority: "priority" }],
  notifications = [{ id: NOTICE_ID, owner_id: OWNER, read: false, title: "Private notice",
    created_at: "2026-11-01T11:00:00Z" }],
  authenticatedUserId = OWNER,
  changeAfterFirstUserCheck = false,
  profileActive = true,
  failedInbox = false,
  failedUpdate = false,
} = {}) {
  const calls = [];
  let authReads = 0;
  const user = id => ({ id, email_confirmed_at: "2026-10-15T12:00:00Z" });
  const client = {
    calls,
    auth: { async getUser() {
      authReads++;
      return { data: { user: user(changeAfterFirstUserCheck && authReads > 1 ? OTHER : authenticatedUserId) }, error: null };
    } },
    from(table) {
      calls.push({ type: "table", table });
      let updating = false;
      let queriedId;
      let updatedStatus;
      const api = {
        select(columns) { calls.push({ type: "select", table, columns }); return api; },
        eq(column, value) { calls.push({ type: "eq", table, column, value }); if(column === "id") queriedId=value; return api; },
        order(column, config) { calls.push({ type: "order", table, column, config }); return api; },
        update(value) { updating = true; updatedStatus=value; calls.push({ type: "update", table, value }); return api; },
        limit() { return Promise.resolve(table === "ifund_inbox_items" ? { data: inbox, error: failedInbox ? { message: "failed" } : null } : { data: notifications, error: null }); },
        maybeSingle() {
          if (table === "ifund_profiles") return Promise.resolve({ data: profileActive
            ? { account_status:"active", account_deletion_pending:false } : { account_status:"suspended", account_deletion_pending:false }, error:null });
          if (updating) return Promise.resolve({ data: failedUpdate ? null : { id: queriedId, owner_id: OWNER,
            ...(table === "ifund_inbox_items" ? { status: updatedStatus.status } : { read: updatedStatus.read }) }, error: failedUpdate ? { message:"denied" } : null });
          throw Error("Unexpected maybeSingle");
        },
      };
      return api;
    },
  };
  return client;
}

test("source-aligned Inbox is a real member-only page and preserves filters", () => {
  const app = source("src/App.jsx");
  const page = source("src/pages/Inbox.jsx");
  assert.match(app, /path="\/inbox" element={<MemberAccess><Inbox \/><\/MemberAccess>}/);
  for (const label of ["Universal Inbox", "All campaigns", "All platforms", "Filter by campaign", "open", "done"])
    assert.ok(page.includes(label), "missing " + label);
  assert.match(page, /requestedCampaign = params\.get\("campaign"\)/);
  assert.doesNotMatch(page, /base44Client|base44\.functions|mockInbox|FAKE_MESSAGES/);
});

test("loads real owner records, sorted by priority, with explicit projections", async () => {
  const c = fakeClient();
  const rows = await loadUniversalInbox(c);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, INBOX_ID);
  assert.equal(rows[0].priority, true);
  assert.equal(rows[1].id, NOTICE_ID);
  assert.equal(rows[1].status, "open");
  for (const table of ["ifund_inbox_items","ifund_notifications"]) {
    assert.ok(c.calls.some(x => x.type==="eq" && x.table===table && x.column==="owner_id" && x.value===OWNER));
    assert.ok(c.calls.some(x => x.type==="select" && x.table===table && !x.columns.includes("*")));
  }
  assert.ok(c.calls.some(x => x.type==="table" && x.table==="ifund_profiles"));
});

test("rejects another user's rows even if the network returns them", async () => {
  const c = fakeClient({ inbox:[{id:INBOX_ID,owner_id:OTHER}] });
  await assert.rejects(loadUniversalInbox(c), /verify your private inbox/);
});
test("rejects malformed rows and database errors rather than claiming an empty inbox", async () => {
  await assert.rejects(loadUniversalInbox(fakeClient({ inbox:[{id:"not-a-uuid",owner_id:OWNER}] })), /verify your private inbox/);
  await assert.rejects(loadUniversalInbox(fakeClient({ failedInbox:true })), /verify your private inbox/);
});
test("discards in-flight records if the account changes", async () => {
  await assert.rejects(loadUniversalInbox(fakeClient({ changeAfterFirstUserCheck:true })), /account changed/);
});
test("suspended accounts cannot read private inbox records", async () => {
  await assert.rejects(loadUniversalInbox(fakeClient({ profileActive:false })), /account is no longer available/);
});
test("only owner-scoped status and read updates are requested, and failures are not success", async () => {
  const c=fakeClient();
  assert.equal(await markInboxItemDone(c,INBOX_ID),INBOX_ID);
  assert.equal(await markInboxNotificationRead(c,NOTICE_ID),NOTICE_ID);
  assert.ok(c.calls.some(x=>x.type==="update"&&x.table==="ifund_inbox_items"&&JSON.stringify(x.value)==='{"status":"done"}'));
  assert.ok(c.calls.some(x=>x.type==="update"&&x.table==="ifund_notifications"&&JSON.stringify(x.value)==='{"read":true}'));
  assert.ok(c.calls.some(x=>x.type==="eq"&&x.table==="ifund_inbox_items"&&x.column==="owner_id"&&x.value===OWNER));
  await assert.rejects(markInboxItemDone(fakeClient({ failedUpdate:true }),INBOX_ID),/could not be marked done/);
  await assert.rejects(markInboxNotificationRead(fakeClient({ failedUpdate:true }),NOTICE_ID),/could not be marked read/);
  await assert.rejects(markInboxItemDone(c,"bad"),/Invalid inbox item/);
});
