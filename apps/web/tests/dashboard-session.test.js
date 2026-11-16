import test from "node:test";
import assert from "node:assert/strict";
import { observeDashboardSession } from "../src/lib/dashboardSession.js";

const member = id => ({ id, email_confirmed_at: "2026-11-16T00:00:00Z", is_anonymous: false });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let user = member("A"), listener, stopped = false;
  const states = [], reads = [];
  const client = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { stopped = true; } } } };
    },
  } };
  const stop = observeDashboardSession(client, {
    loadCampaigns() { const work = deferred(); reads.push({ id: user?.id, ...work }); return work.promise; },
    onChange(state) { states.push(state); },
  });
  return { states, reads, stop, client,
    event(next, event = "SIGNED_IN") { user = next; listener(event, next ? { user: next } : null); },
    setUser(next) { user = next; },
    get latest() { return states.at(-1); },
    get stopped() { return stopped; },
  };
}

test("switching accounts clears rows immediately and rejects the previous owner's deferred response", async () => {
  const h = harness();
  await tick();
  assert.equal(h.reads[0].id, "A");
  h.event(member("B"));
  assert.equal(h.latest.phase, "loading");
  assert.equal(h.latest.user, null);
  assert.deepEqual(h.latest.campaigns, []);
  await tick();
  assert.equal(h.reads[1].id, "B");
  h.reads[1].resolve([{ id: "B-campaign" }]);
  await tick();
  assert.equal(h.latest.user.id, "B");
  h.reads[0].resolve([{ id: "private-A-campaign" }]);
  await tick();
  assert.equal(h.latest.user.id, "B");
  assert.deepEqual(h.latest.campaigns, [{ id: "B-campaign" }]);
  assert.ok(h.states.every(state => !state.campaigns.some(row => row.id === "private-A-campaign")));
  h.stop();
});

test("sign-out clears already loaded rows and discards a pending owner failure", async () => {
  const h = harness();
  await tick();
  h.reads[0].resolve([{ id: "A-campaign" }]);
  await tick();
  assert.equal(h.latest.campaigns.length, 1);
  h.event(null, "SIGNED_OUT");
  assert.equal(h.latest.phase, "guest");
  assert.deepEqual(h.latest.campaigns, []);
  h.event(member("B"));
  await tick();
  h.event(null, "SIGNED_OUT");
  h.reads[1].reject(new Error("private owner failure detail"));
  await tick();
  assert.equal(h.latest.phase, "guest");
  assert.equal(h.latest.error, "");
  h.stop();
});

test("same-owner token refresh preserves loaded rows without a second private request", async () => {
  const h = harness();
  await tick();
  h.reads[0].resolve([{ id: "A-campaign" }]);
  await tick();
  const before = h.states.length;
  h.event(member("A"), "TOKEN_REFRESHED");
  await tick();
  assert.equal(h.states.length, before);
  assert.equal(h.reads.length, 1);
  h.stop();
});

test("final identity verification rejects rows even when an auth-change callback was missed", async () => {
  const h = harness();
  await tick();
  h.setUser(member("B"));
  h.reads[0].resolve([{ id: "A-campaign" }]);
  await tick();
  assert.equal(h.latest.phase, "error");
  assert.equal(h.latest.user, null);
  assert.deepEqual(h.latest.campaigns, []);
  h.stop();
});

test("disposing the observer prevents late results and releases its auth subscription", async () => {
  const h = harness();
  await tick();
  h.stop();
  const count = h.states.length;
  h.reads[0].resolve([{ id: "A-campaign" }]);
  h.event(member("B"));
  await tick();
  assert.equal(h.states.length, count);
  assert.equal(h.stopped, true);
});
