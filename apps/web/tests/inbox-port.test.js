import test from "node:test";
import assert from "node:assert/strict";
import { loadUniversalInbox, markInboxItemDone, markInboxNotificationRead } from "../src/lib/inbox.js";

const OWNER = "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391";
const INBOX_ID = "03f653d1-6acb-4a5c-8c0a-01b9752d3635";
const NOTICE_ID = "a3f72f62-b0b3-4f5f-bb45-0b6b78d83a12";

function clientFactory({ user = { id: OWNER, email_confirmed_at: "2026-10-29T12:00:00Z" },
  profile = { account_status: "active", account_deletion_pending: false },
  inbox = [], notifications = [] } = {}) {
  const calls = [];
  let currentTable = null;
  let operation = null;
  let updateData = null;
  const builder = {
    select(columns) { operation = "select"; calls.push(["select", currentTable, columns]); return this; },
    eq(column, value) { calls.push(["eq", currentTable, column, value]); return this; },
    order(column, options) { calls.push(["order", currentTable, column, options]); return this; },
    limit(value) { calls.push(["limit", currentTable, value]); return Promise.resolve({
      data: currentTable === "ifund_inbox_items" ? inbox :
        currentTable === "ifund_notifications" ? notifications : [], error: null,
    }); },
    update(value) { operation = "update"; updateData = value; calls.push(["update", currentTable, value]); return this; },
    maybeSingle() {
      calls.push(["maybeSingle", currentTable]);
      if (currentTable === "ifund_profiles") return Promise.resolve({ data: profile, error: null });
      if (currentTable === "ifund_inbox_items") return Promise.resolve({
        data: { id: INBOX_ID, owner_id: OWNER, status: updateData.status }, error: null,
      });
      if (currentTable === "ifund_notifications") return Promise.resolve({
        data: { id: NOTICE_ID, owner_id: OWNER, read: updateData.read }, error: null,
      });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return {
    calls,
    client: {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from(table) { currentTable = table; calls.push(["from", table]); return builder; },
    },
  };
}

test("inbox reads only owner-scoped messages and notifications after lifecycle verification", async () => {
  const x = clientFactory({
    inbox: [{ id: INBOX_ID, owner_id: OWNER, platform: "kofi", type: "message",
      author: "Supporter", content: "Hello", status: "open", created_at: "2026-10-30T00:00:00Z" }],
    notifications: [{ id: NOTICE_ID, owner_id: OWNER, title: "Update", body: "A campaign update",
      type: "update", read: false, created_at: "2026-10-30T01:00:00Z" }],
  });
  const items = await loadUniversalInbox(x.client);
  assert.equal(items.length, 2);
  assert.ok(items.every(item => item.owner_id === OWNER));
  assert.equal(items[0].source, "notification");
  assert.equal(items[1].source, "inbox");
  assert.ok(x.calls.some(call => call[0] === "eq" && call[1] === "ifund_inbox_items" && call[2] === "owner_id" && call[3] === OWNER));
  assert.ok(x.calls.some(call => call[0] === "eq" && call[1] === "ifund_notifications" && call[2] === "owner_id" && call[3] === OWNER));
});

test("unconfirmed or missing identity cannot read inbox data", async () => {
  const x = clientFactory({ user: { id: OWNER, email_confirmed_at: null } });
  await assert.rejects(() => loadUniversalInbox(x.client), /confirmed email/);
  assert.equal(x.calls.length, 0);
});

test("inactive account cannot read inbox data", async () => {
  const x = clientFactory({ profile: { account_status: "disabled", account_deletion_pending: false } });
  await assert.rejects(() => loadUniversalInbox(x.client), /no longer available/);
  assert.equal(x.calls.filter(call => call[0] === "from" && call[1] !== "ifund_profiles").length, 0);
});

test("message acknowledgement updates only status for the authenticated owner", async () => {
  const x = clientFactory();
  assert.equal(await markInboxItemDone(x.client, INBOX_ID), INBOX_ID);
  assert.ok(x.calls.some(call => call[0] === "update" && call[1] === "ifund_inbox_items" &&
    JSON.stringify(call[2]) === JSON.stringify({ status: "done" })));
  assert.ok(x.calls.some(call => call[0] === "eq" && call[1] === "ifund_inbox_items" && call[2] === "owner_id" && call[3] === OWNER));
});

test("notification acknowledgement updates only read for the authenticated owner", async () => {
  const x = clientFactory();
  assert.equal(await markInboxNotificationRead(x.client, NOTICE_ID), NOTICE_ID);
  assert.ok(x.calls.some(call => call[0] === "update" && call[1] === "ifund_notifications" &&
    JSON.stringify(call[2]) === JSON.stringify({ read: true })));
  assert.ok(x.calls.some(call => call[0] === "eq" && call[1] === "ifund_notifications" && call[2] === "owner_id" && call[3] === OWNER));
});

test("acknowledgement rejects malformed record identifiers before database access", async () => {
  const x = clientFactory();
  await assert.rejects(() => markInboxItemDone(x.client, "not-a-uuid"), /Invalid inbox item/);
  await assert.rejects(() => markInboxNotificationRead(x.client, "not-a-uuid"), /Invalid notification/);
  assert.equal(x.calls.length, 0);
});
