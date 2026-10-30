import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPAIGN_UUID, loadOwnedCampaigns, deleteOwnedDraft } from "../src/lib/ownerCampaigns.js";

const owner = "27a9181d-b890-4072-becd-7180a693b110";
const draft = "90dbd4a9-4f6f-4bcc-ae42-2ed060784783";
function fakeClient({ userId = owner, authError = null, rows = [], dbError = null } = {}) {
  const operations = [];
  const query = {
    select(...args) { operations.push(["select", ...args]); return this; },
    delete(...args) { operations.push(["delete", ...args]); return this; },
    eq(...args) { operations.push(["eq", ...args]); return this; },
    order(...args) { operations.push(["order", ...args]); return this; },
    limit(...args) { operations.push(["limit", ...args]); return Promise.resolve({ data: rows, error: dbError }); },
    maybeSingle() { operations.push(["maybeSingle"]); return Promise.resolve({ data: rows[0] || null, error: dbError }); },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: authError }) },
    from(table) { operations.push(["from", table]); return query; },
  };
  return { client, operations };
}

test("owned campaign listing derives owner identity from verified auth", async () => {
  const { client, operations } = fakeClient({ rows: [{ id: draft, status: "draft" }] });
  assert.equal((await loadOwnedCampaigns(client)).length, 1);
  assert.ok(operations.some(op => op[0] === "eq" && op[1] === "owner_id" && op[2] === owner));
  assert.ok(operations.some(op => op[0] === "from" && op[1] === "ifund_campaigns"));
  assert.ok(operations.some(op => op[0] === "limit" && op[1] === 100));
});
test("unsigned sessions cannot access campaign queries or delete", async () => {
  const { client, operations } = fakeClient({ userId: null });
  await assert.rejects(() => loadOwnedCampaigns(client), /Sign in/);
  await assert.rejects(() => deleteOwnedDraft(client, draft), /Sign in/);
  assert.equal(operations.length, 0);
});
test("draft removal requires valid UUID, owner and draft status", async () => {
  const { client, operations } = fakeClient({ rows: [{ id: draft }] });
  assert.equal(await deleteOwnedDraft(client, draft), draft);
  assert.deepEqual(operations.filter(op => op[0] === "eq"), [
    ["eq", "id", draft], ["eq", "owner_id", owner], ["eq", "status", "draft"],
  ]);
  assert.ok(operations.some(op => op[0] === "delete"));
  assert.ok(operations.some(op => op[0] === "select" && op[1] === "id"));
  assert.equal(CAMPAIGN_UUID.test(draft), true);
  await assert.rejects(() => deleteOwnedDraft(client, "not-a-uuid"), /Invalid draft/);
});
test("missing or unauthorized draft is never reported as deleted", async () => {
  const { client } = fakeClient({ rows: [] });
  await assert.rejects(() => deleteOwnedDraft(client, draft), /not found/);
});
test("provider failure never reports a successful deletion", async () => {
  const { client } = fakeClient({ dbError: Error("provider failure") });
  await assert.rejects(() => deleteOwnedDraft(client, draft), /Unable to remove/);
});

test("paused campaign owner preview never uses the anonymous public campaign loader", ()=>{
  const fs=requireSource();
  assert.match(fs,/authClient\(\)/);
  assert.match(fs,/\.eq\("owner_id",user\.id\)/);
  assert.match(fs,/\.select\("id,title,summary,story,category,goal_amount,status,created_at,updated_at"\)/);
  assert.doesNotMatch(fs,/getCampaignDetail|listActiveCampaigns/);
});
function requireSource(){
  return readFileSync(new URL("../src/pages/OwnerCampaignPreview.jsx",import.meta.url),"utf8");
}
