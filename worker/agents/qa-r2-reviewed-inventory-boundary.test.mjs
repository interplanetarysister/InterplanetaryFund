import test from "node:test";
import assert from "node:assert/strict";
import { reviewedR2Inventory } from "../services/r2ReviewedInventory.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const campaign = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const row = {
  document_id: documentId, campaign_id: campaign,
  storage_path: `private/campaign-documents/${owner}/${campaign}/${documentId}.pdf`,
  object_etag: '"receipt"', object_sha256: "ab".repeat(32),
  object_verified_at: "2026-11-20T00:00:00Z", file_size: 5,
};
const approved = [{ request_id: requestId, review_ready: true }];
const run = ({ queue = approved, rows = [row], jwt = "caller-session", ownerId = owner, failAt = "" } = {}) => {
  const calls = [];
  const rpc = async (name, args, token) => {
    calls.push({ name, args, token });
    if (name === failAt) throw Error("RPC failure");
    if (name === "ifund_super_admin_private_document_reviewed_queue") return queue;
    if (name === "ifund_super_admin_private_document_inventory") return rows;
    throw Error("Unexpected RPC");
  };
  return { calls, result: reviewedR2Inventory({ requestId, jwt, ownerId, rpc }) };
};

test("reviewed queue must be queried first with empty args and caller JWT", async () => {
  const { calls, result } = run();
  assert.equal((await result).length, 1);
  assert.deepEqual(calls.map(c => c.name), [
    "ifund_super_admin_private_document_reviewed_queue",
    "ifund_super_admin_private_document_inventory",
  ]);
  assert.deepEqual(calls[0].args, {});
  assert.equal(calls[0].token, "caller-session");
  assert.deepEqual(calls[1].args, { p_request_id: requestId, p_limit: 100 });
  assert.equal(calls[1].token, "caller-session");
});
test("unauthenticated request cannot query inventory", async () => {
  const { calls, result } = run({ jwt: "" });
  await assert.rejects(result);
  assert.equal(calls.length, 0);
});
test("unreviewed request never reaches inventory", async () => {
  const { calls, result } = run({ queue: [{ request_id: requestId, review_ready: false }] });
  await assert.rejects(result);
  assert.equal(calls.length, 1);
});
test("review approval for another request is insufficient", async () => {
  const { calls, result } = run({ queue: [{ request_id: owner, review_ready: true }] });
  await assert.rejects(result);
  assert.equal(calls.length, 1);
});
test("cross-owner inventory row fails the entire batch", async () => {
  const foreign = "55555555-5555-4555-8555-555555555555";
  const { result } = run({ rows: [row, { ...row, storage_path: row.storage_path.replace(owner, foreign) }] });
  await assert.rejects(result);
});
test("RPC errors fail closed without retry or fabricated approval", async () => {
  const { calls, result } = run({ failAt: "ifund_super_admin_private_document_reviewed_queue" });
  await assert.rejects(result);
  assert.equal(calls.length, 1);
});
test("partial batch is bounded to ten, with no mutation RPC", async () => {
  const { calls, result } = run({ rows: Array.from({ length: 12 }, () => ({ ...row })) });
  assert.equal((await result).length, 10);
  assert.equal(calls.length, 2);
});
