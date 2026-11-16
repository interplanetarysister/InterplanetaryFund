import test from "node:test";
import assert from "node:assert/strict";
import { createAdminReviewSession, runAdminReview } from "../src/lib/adminReviewSession.js";

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const clientFor = getId => ({ auth: { getUser: async () => ({data:{user:{id:getId()}},error:null}) } });

test("deferred privileged response cannot repopulate state after account changes away and back", async () => {
  let user = "admin-a", cleared = 0, exposed = null;
  const scope = createAdminReviewSession(() => { exposed = null; cleared += 1; });
  scope.bind(user);
  const reply = deferred(), started = deferred();
  const pending = runAdminReview(scope,clientFor(() => user),() => { started.resolve(); return reply.promise; })
    .then(data => { exposed = data; });
  await started.promise;
  scope.observe(user = "admin-b");
  scope.observe(user = "admin-a");
  reply.resolve({private_account:"sensitive dependency snapshot"});
  await assert.rejects(pending,/session changed/);
  assert.equal(exposed,null);
  assert.equal(cleared,1);
});

test("refresh or unmount invalidates pending review acknowledgements", async () => {
  const scope = createAdminReviewSession();
  scope.bind("admin-a");
  const reply=deferred(),started=deferred();
  const pending=runAdminReview(scope,clientFor(()=>"admin-a"),()=>{started.resolve();return reply.promise;});
  await started.promise;
  scope.invalidate();
  reply.resolve(true);
  await assert.rejects(pending,/session changed/);
});

test("identity recheck clears the view even when an auth-change event has not arrived", async () => {
  let user="admin-a",cleared=false;
  const scope=createAdminReviewSession(()=>{cleared=true;});
  scope.bind(user);
  await assert.rejects(runAdminReview(scope,clientFor(()=>user),async()=>{user="admin-b";return true;}),/session changed/);
  assert.equal(cleared,true);
});

test("unverified or obsolete scope cannot start a protected operation", async () => {
  let calls=0;
  const scope=createAdminReviewSession();
  await assert.rejects(runAdminReview(scope,clientFor(()=>"admin-a"),async()=>{calls++;}),/session changed/);
  scope.observe("admin-b");
  assert.throws(()=>scope.bind("admin-a"),/session changed/);
  assert.equal(calls,0);
});

test("same-owner review returns verified data", async () => {
  const scope=createAdminReviewSession();
  scope.bind("admin-a");
  assert.deepEqual(await runAdminReview(scope,clientFor(()=>"admin-a"),async()=>({reviewed:true})),{reviewed:true});
});
