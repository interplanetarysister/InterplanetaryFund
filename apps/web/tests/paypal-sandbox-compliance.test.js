import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/paypal/sandbox/[[path]].js";

const request = (path, method="GET", body=null) => new Request("https://interplanetaryfund.com/api/paypal/sandbox/"+path,{
  method, ...(body===null?{}:{headers:{"content-type":"application/json"},body:JSON.stringify(body)})
});
const invoke = (path,method,body,env={}) => onRequest({request:request(path,method,body),env,params:{path}});
test("sandbox status defaults disabled without secret bindings",async()=>{
  const r=await invoke("status","GET",null,{});
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.enabled,false);
  assert.equal(body.live_payments_enabled,false);
  assert.equal(body.webhook_ready,false);
});
test("all transactional endpoints fail closed before any network call",async()=>{
  for(const action of ["orders","capture","webhook"]){
    const r=await invoke(action,"POST",{order_id:"ORDER-12345678"},{});
    assert.equal(r.status,503,action);
    const body=await r.json();
    assert.equal(body.ok,false);
  }
});
test("sandbox does not allow GET for money operations",async()=>{
  const env={IFUND_PAYPAL_SANDBOX_ENABLED:"enabled",PAYPAL_CLIENT_ID:"sandbox-public",
    PAYPAL_CLIENT_SECRET:"placeholder",SUPABASE_URL:"https://example.supabase.co",
    SUPABASE_SECRET_KEY:"test-secret"};
  const r=await invoke("capture","GET",null,env);
  assert.equal(r.status,405);
});
test("reject unknown sandbox routes",async()=>{
  const r=await invoke("live-checkout","POST",{},{});
  assert.equal(r.status,404);
});
test("no sandbox receipts are written to real donation tables",async()=>{
  const fs=await import("node:fs/promises");
  const file=await fs.readFile(new URL("../functions/api/paypal/sandbox/[[path]].js",import.meta.url),"utf8");
  assert.match(file,/ifund_paypal_sandbox_orders/);
  assert.match(file,/ifund_paypal_sandbox_events/);
  assert.doesNotMatch(file,/db\(env,["']ifund_donations["']/);
  assert.doesNotMatch(file,/api-m\.paypal\.com/);
});

test("sandbox preview hostname regex accepts the deployed Pages host",async()=>{
  const fs=await import("node:fs/promises");
  const source=await fs.readFile(new URL("../functions/api/paypal/sandbox/[[path]].js",import.meta.url),"utf8");
  // A JS regex literal needs a single backslash before each literal dot.
  assert.ok(source.includes(String.raw`/^(?:[a-z0-9-]+\\.)?interplanetaryfund-migration\\.pages\\.dev$/`));
  const hostPattern=/^(?:[a-z0-9-]+\\.)?interplanetaryfund-migration\\.pages\\.dev$/;
  assert.equal(hostPattern.test("a213266c.interplanetaryfund-migration.pages.dev"),true);
  assert.equal(hostPattern.test("attacker.interplanetaryfund-migrationXpages.dev"),false);
});
