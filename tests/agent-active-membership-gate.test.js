import test from "node:test";
import assert from "node:assert/strict";
import { memberApi } from "../worker/agents/memberApi.js";

const UID = "11111111-1111-4111-8111-111111111111";
const env = {
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
};
const req = () => new Request("https://interplanetaryfund.com/api/agents/connections/workspace", {
  headers: { authorization: "Bearer verified.member.token" },
});
function mockAccount(active) {
  const paths = [];
  const fetcher = async (url, init) => {
    const path = new URL(url).pathname;
    paths.push(path);
    if (path === "/auth/v1/user")
      return Response.json({ id: UID, email_confirmed_at: "2026-11-01T00:00:00Z", is_anonymous: false });
    if (path === "/rest/v1/rpc/ifund_current_account_is_active") {
      assert.equal(init.method, "POST");
      return Response.json(active);
    }
    throw Error("Unexpected upstream path: " + path);
  };
  return { fetcher, paths };
}
test("verified active IFund member can enter shared agent services", async () => {
  const m=mockAccount(true);
  const api=await memberApi(req(),env,m.fetcher);
  assert.equal(api.user.id,UID);
  assert.deepEqual(m.paths,["/auth/v1/user","/rest/v1/rpc/ifund_current_account_is_active"]);
});
test("suspended, deleted, missing, or unverified membership fails closed", async () => {
  for (const active of [false,null,undefined,{allowed:true},"true"]) {
    const m=mockAccount(active);
    await assert.rejects(memberApi(req(),env,m.fetcher),error=>error.status===403);
    assert.deepEqual(m.paths,["/auth/v1/user","/rest/v1/rpc/ifund_current_account_is_active"]);
  }
});
test("canonical Supabase project is required before contacting a backend",async()=>{
 const m=mockAccount(true);
 await assert.rejects(memberApi(req(),{...env,SUPABASE_URL:"https://another-project.supabase.co"},m.fetcher),error=>error.status===503);
 assert.equal(m.paths.length,0);
});
test("missing authentication prevents all upstream agent calls",async()=>{
 const m=mockAccount(true);
 await assert.rejects(memberApi(new Request("https://interplanetaryfund.com/api/agents/team/question"),env,m.fetcher),error=>error.status===401);
 assert.equal(m.paths.length,0);
});
