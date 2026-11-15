import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { oauthProviders, routeOAuthRequest } from "../worker/oauth.js";
import { CONNECTION_PLATFORMS, OAUTH_PLATFORM_IDS } from "../apps/web/src/lib/connectionCatalog.mjs";
const added=["discord","github","twitch","slack","patreon","eventbrite","pinterest","reddit"];
test("eight new identity-only OAuth choices are wired and never claim Bluesky/Telegram OAuth",()=>{
 for(const id of added){assert.ok(oauthProviders.includes(id));assert.equal(OAUTH_PLATFORM_IDS[id],id);assert.equal(CONNECTION_PLATFORMS.find(p=>p.id===id)?.method,"secure");}
 assert.equal(CONNECTION_PLATFORMS.find(p=>p.id==="telegram")?.method,"link");
 assert.equal(OAUTH_PLATFORM_IDS.telegram,undefined);assert.equal(OAUTH_PLATFORM_IDS.bluesky,undefined);
});
test("new providers fail closed without approved runtime bindings",async()=>{
 for(const id of added){
  const request=new Request("https://interplanetaryfund.com/api/oauth/"+id+"/start",{method:"POST",headers:{origin:"https://interplanetaryfund.com"}});
  const res=await routeOAuthRequest(request,{OAUTH_API_ENABLED:"false"},()=>{throw Error("unexpected request")});
  assert.equal(res.status,503,id);
 }
});
test("migration retains owner lifecycle authorization and all provider constraints",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261113193000_ifund_identity_oauth_provider_expansion.sql",import.meta.url),"utf8");
 for(const id of added)assert.ok(sql.includes("'"+id+"'"),id);
 for(const table of ["ifund_oauth_transactions","ifund_provider_tokens","ifund_provider_connection_events"])assert.ok(sql.includes("add constraint "+table+"_provider_check"));
 for(const fn of ["ifund_store_provider_connection(","ifund_store_provider_connection_v2(","ifund_disconnect_provider("])assert.ok(sql.includes(fn),fn);
 assert.ok(sql.includes("pg_catalog.pg_advisory_xact_lock"));
});
