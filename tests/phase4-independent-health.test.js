import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import {probeIndependentBackend} from "../worker/independentHealth.js";
const url="https://test.invalid/api/health/independent";
const config={MIGRATION_API_PREVIEW:"enabled",SUPABASE_URL:"https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test_only"};
test("independent health does not equate ping response with migration complete",async()=>{
  const ready=await probeIndependentBackend(config,async()=>new Response("{}",{status:200}));
  assert.equal(ready.supabase_auth,"reachable");
  assert.equal(ready.ready,false);
  assert.equal(ready.legacy_accounts_verified,false);
  assert.equal(ready.finance_ready,false);
  assert.equal(ready.workflows_ready,false);
});
test("health returns bounded, sanitized failure when independent auth is unreachable",async()=>{
  const ready=await probeIndependentBackend(config,async()=>{throw Error("private error");});
  assert.equal(ready.supabase_auth,"unavailable");
  assert.ok(!JSON.stringify(ready).includes("private error"));
});
test("public probe requires safe Supabase hostname and no secret output",async()=>{
  let calls=0;
  const check=await probeIndependentBackend({...config,SUPABASE_URL:"https://evil.invalid"},
    async()=>{calls++;return new Response("{}")});
  assert.equal(calls,0);
  assert.equal(check.supabase_auth,"unconfigured");
  const response=await worker.fetch(new Request(url),config);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.ready,false);
  assert.ok(!JSON.stringify(body).includes(config.SUPABASE_PUBLISHABLE_KEY));
});
