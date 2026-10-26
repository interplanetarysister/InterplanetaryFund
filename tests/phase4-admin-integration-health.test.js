import test from "node:test";
import assert from "node:assert/strict";
import { routeAdminIntegrationHealth } from "../worker/adminIntegrationHealth.js";
const endpoint = "https://ifund.example/api/admin/integrations/health";
const adminID = "12345678-1234-1234-1234-123456789012";
const env = {
  MIGRATION_API_PREVIEW: "enabled", SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  IFUND_ADMIN_HEALTH_ENABLED: "enabled",
  IFUND_CLOUDFLARE_VERIFY_TOKEN: "SECRET_NEVER_RETURNED",
};
function req(method="GET", jwt="fake.jwt.test") {
  return new Request(endpoint, {method, headers:{Authorization:"Bearer "+jwt}});
}
function fakeFetch(role="admin",providerStatus="active") {
  return async (url,options) => {
    if (url.includes("/auth/v1/user")) {
      assert.ok(options.headers.Authorization.startsWith("Bearer "));
      return Response.json({id:adminID,app_metadata:{role},user_metadata:{role:"super_admin"}});
    }
    if (url.includes("tokens/verify")) {
      assert.equal(options.headers.Authorization,"Bearer "+env.IFUND_CLOUDFLARE_VERIFY_TOKEN);
      return Response.json({success:true,result:{status:providerStatus}});
    }
    throw Error("Unknown upstream");
  };
}
test("administrator-only provider probe never activates payments or agents",async()=>{
  const res=await routeAdminIntegrationHealth(req(),env,fakeFetch());
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.readiness,"partial");
  assert.equal(data.active_financial_operations,false);
  assert.equal(data.automation_dispatch_enabled,false);
  assert.equal(data.provider_evidence.find(p=>p.provider==="cloudflare").status,"verified");
  assert.equal(data.provider_evidence.find(p=>p.provider==="paypal").status,"unverified");
  assert.equal(data.provider_evidence.every(p=>!p.actionable),true);
  assert.ok(!JSON.stringify(data).includes(env.IFUND_CLOUDFLARE_VERIFY_TOKEN));
});
test("member role cannot impersonate admin through self-editable metadata",async()=>{
  let checkedProvider=false;
  const res=await routeAdminIntegrationHealth(req(),env,async (url,options)=>{
    if(url.includes("tokens/verify")) {checkedProvider=true;throw Error("Provider should not be probed");}
    return Response.json({id:adminID,app_metadata:{role:"member"},user_metadata:{role:"super_admin"}});
  });
  assert.equal(res.status,403);
  assert.equal(checkedProvider,false);
});
test("missing session and disabled readiness fail closed",async()=>{
  const a=await routeAdminIntegrationHealth(new Request(endpoint),env,fakeFetch());
  assert.equal(a.status,401);
  const b=await routeAdminIntegrationHealth(req(),{...env,IFUND_ADMIN_HEALTH_ENABLED:"disabled"},fakeFetch());
  assert.equal(b.status,503);
  const c=await routeAdminIntegrationHealth(req("POST"),env,fakeFetch());
  assert.equal(c.status,405);
});
test("configured token alone never means connected",async()=>{
  const r=await routeAdminIntegrationHealth(req(),env,fakeFetch("super_admin","inactive"));
  assert.equal((await r.json()).provider_evidence.find(p=>p.provider==="cloudflare").status,"needs_attention");
  const unreachable=await routeAdminIntegrationHealth(req(),env,async(url)=>{
    if(url.includes("tokens/verify"))throw Error("provider offline");
    return Response.json({id:adminID,app_metadata:{role:"admin"}});
  });
  assert.equal((await unreachable.json()).provider_evidence.find(p=>p.provider==="cloudflare").status,"unavailable");
});
test("server errors never expose provider secrets or internal errors",async()=>{
  const r=await routeAdminIntegrationHealth(req(),env,async()=>{throw Error("secret=EXPOSED");});
  assert.equal(r.status,503);
  assert.ok(!JSON.stringify(await r.json()).includes("EXPOSED"));
});
