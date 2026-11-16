import test from "node:test";
import assert from "node:assert/strict";
import { createSpecialistSession, selectedRevisions, verifiedMessagePreview } from "../src/lib/specialistSession.js";

const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const member = id => ({ id, email_confirmed_at: "2026-11-15T00:00:00Z", is_anonymous: false });
function harness(agent = "strategy", responder = async () => new Response(JSON.stringify({ campaigns: [], recommendations: [] }))) {
  let user = member(A), sessionUser = null, invalidated = 0;
  const listeners = new Set(), calls = [];
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({ data: { session: { user: sessionUser || user, access_token: "synthetic-user-token" } }, error: null }),
    onAuthStateChange: callback => { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } }; },
  };
  const scope = createSpecialistSession({ client: { auth }, ownerId: A, agent,
    fetcher: async (...args) => { calls.push(args); return responder(...args); }, onInvalidate: () => { invalidated++; } });
  return { scope, auth, calls, get invalidated() { return invalidated; },
    switch(id) { user = id ? member(id) : null; for (const callback of listeners) callback("SIGNED_IN", user ? { user } : null); },
    setSessionUser(value) { sessionUser = value; } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(done => setImmediate(done));

test("specialist transport uses the verified member token and fixed canonical action paths", async () => {
  const h = harness(); let published;
  await h.scope.run(api => api("brief", { request_id: A, objective: "Review my campaign" }), result => { published = result; });
  assert.deepEqual(published, { campaigns: [], recommendations: [] });
  assert.equal(h.calls[0][0], "/api/services/strategy_agent/brief");
  assert.equal(h.calls[0][1].method, "POST");
  assert.equal(h.calls[0][1].headers.Authorization, "Bearer synthetic-user-token");
  assert.equal(JSON.parse(h.calls[0][1].body).owner_id, undefined);
  h.scope.dispose();
});

test("session token for another member cannot start a specialist request", async () => {
  const h = harness(); h.setSessionUser(member(B));
  await assert.rejects(h.scope.run(api => api("workspace"), () => {}), /account changed/);
  assert.equal(h.calls.length, 0); assert.equal(h.invalidated, 1); h.scope.dispose();
});

test("session event between verification and operation prevents the mutation", async () => {
  const h = harness(); let invoked = 0;
  const pending = h.scope.run(async () => { invoked++; return {}; }, () => {});
  queueMicrotask(() => h.switch(B));
  await assert.rejects(pending, /account changed/);
  assert.equal(invoked, 0); h.scope.dispose();
});

test("an interrupted owner response is aborted and never shown after switching away and back", async () => {
  const reply = deferred(), h = harness("connections", () => reply.promise); let published = 0;
  const pending = h.scope.run(api => api("workspace"), () => { published++; });
  const rejected = assert.rejects(pending, /account changed/);
  await tick(); h.switch(B); h.switch(A);
  assert.equal(h.calls[0][1].signal.aborted, true);
  reply.resolve(new Response(JSON.stringify({ permissions: [{ private: "owner A" }] })));
  await rejected; assert.equal(published, 0); assert.equal(h.invalidated, 1); h.scope.dispose();
});

test("the final response publication has a synchronous account guard", async () => {
  const h = harness(); let published = false;
  await assert.rejects(h.scope.run(async api => {
    const data = await api("workspace"); queueMicrotask(() => h.switch(B)); return data;
  }, () => { published = true; }), /account changed/);
  assert.equal(published, false); h.scope.dispose();
});

test("unmount and anonymous sessions invalidate pending service work", async () => {
  const h = harness(); h.switch(null);
  await assert.rejects(h.scope.run(() => Promise.resolve({}), () => {}), /account changed/);
  h.scope.dispose(); assert.equal(h.calls.length, 0);
});

test("unsupported actions and method confusion never reach the network", async () => {
  const h = harness();
  for (const [action, body] of [["../payments", {}], ["workspace", {}], ["brief", undefined], ["workspace?provider=x", undefined]])
    await assert.rejects(h.scope.run(api => api(action, body), () => {}));
  assert.equal(h.calls.length, 0); h.scope.dispose();
});

test("server failures and malformed receipts cannot be painted as success", async () => {
  for (const response of [new Response('{"error":"Disabled","code":"SETUP_REQUIRED"}', { status: 503 }), new Response("not-json"), new Response("[]")]) {
    const h = harness("communications", async () => response); let published = false;
    await assert.rejects(h.scope.run(api => api("workspace"), () => { published = true; }));
    assert.equal(published, false); h.scope.dispose();
  }
});

test("bulk review snapshots only selected current revisions and enforces limits", () => {
  const records = [{ id: A, updated_at: "2026-11-15T00:00:00Z" }, { id: B, updated_at: "2026-11-15T01:00:00Z" }];
  assert.deepEqual(selectedRevisions(records, [B]), [{ id: B, revision: records[1].updated_at }]);
  assert.throws(() => selectedRevisions(records, [A, A]), /Choose between/);
  assert.throws(() => selectedRevisions(records, ["missing"]), /record changed/);
  assert.throws(() => selectedRevisions(records, [A, B], { max: 1 }), /Choose between/);
  assert.deepEqual(selectedRevisions([{ id: A, revision: B }], [A], { revisionKey: "revision" }), [{ id: A, revision: B }]);
});

test("in-app approval previews must contain the exact selected messages and numeric audiences", () => {
  const valid = { preview_id: A, messages: [{ id: B, subject: "Update", content: "Owner reviewed facts", campaign_id: A, eligible_recipients: 0 }] };
  assert.equal(verifiedMessagePreview(valid, A, [{ id: B }]), valid);
  for (const data of [{ ...valid, preview_id: B }, { ...valid, messages: [] },
    { ...valid, messages: [{ ...valid.messages[0], id: A }] }, { ...valid, messages: [{ ...valid.messages[0], eligible_recipients: "2" }] },
    { ...valid, messages: [{ ...valid.messages[0], content: undefined }] }])
    assert.throws(() => verifiedMessagePreview(data, A, [{ id: B }]));
});
