import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONNECTION_PLATFORMS, OAUTH_PLATFORM_IDS, selectedConnectionPlatform, connectionSteps } from "../src/lib/connectionCatalog.mjs";
import { validatePublicConnectionLink } from "../src/lib/connectionLinkValidation.mjs";

const page=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");

test("the Base44 reference destinations appear in the independent, icon-first catalog",()=>{
  assert.equal(CONNECTION_PLATFORMS.length,47);
  assert.equal(new Set(CONNECTION_PLATFORMS.map(item=>item.id)).size,47);
  for (const kind of ["crowdfunding","social","app"]) assert.ok(CONNECTION_PLATFORMS.some(item=>item.kind===kind));
  for (const name of ["gofundme","kickstarter","bluesky","facebook","youtube","gmail","dropbox","google"]) assert.ok(selectedConnectionPlatform(name));
  assert.deepEqual(Object.keys(OAUTH_PLATFORM_IDS).sort(),["facebook","google","instagram","linkedin","tiktok","x","youtube"]);
  assert.match(page,/aria-label="Platform icons"/);
  assert.match(page,/aria-pressed={active}/);
  assert.match(page,/id="connection-details"/);
  assert.match(page,/connectionSteps\(selected/);
  assert.match(page,/connectionCapabilityReadiness/);
});
test("regular users see actionable connection steps, not developer diagnostics",()=>{
  assert.match(page,/adminStatus==="admin" && <details/);
  assert.match(page,/Administrator diagnostics/);
  assert.match(page,/Save a public /);
  assert.match(page,/Connect securely/);
  assert.match(page,/Save public link/);
  assert.match(page,/How to connect/);
  assert.match(page,/This setting does not post to outside accounts/);
  const steps=connectionSteps(selectedConnectionPlatform("gofundme"));
  assert.ok(steps.join(" ").includes("Copy its public page address"));
  assert.ok(!steps.join(" ").includes("API"));
});
test("public URL validation rejects credentials, HTTP, private hosts, fake providers and strips tracking",()=>{
  for(const url of ["http://www.gofundme.com/f/abc","https://evil.com/f/abc","https://gofundme.com.evil.com/f/abc",
   "https://me:password@www.gofundme.com/f/abc","https://localhost/f/abc","https://example.local/test"]) {
    assert.equal(validatePublicConnectionLink("gofundme",url).ok,false,url);
  }
  const real=validatePublicConnectionLink("gofundme","https://www.gofundme.com/f/actual?utm_campaign=ads#private");
  assert.deepEqual(real,{ok:true,url:"https://www.gofundme.com/f/actual"});
  assert.equal(validatePublicConnectionLink("custom","https://example.com/our-campaign").ok,true);
  assert.equal(validatePublicConnectionLink("gmail","https://mail.google.com/mail/u/0").ok,false);
});

test("revocable iFund help consent is explicit, member-scoped and cannot publish elsewhere",()=>{
 assert.match(page,/ifund_my_connection_assistance/);
 assert.match(page,/ifund_set_connection_assistance/);
 assert.match(page,/Turn on help/);
 assert.match(page,/Turn off help/);
 assert.match(page,/never signs in to your outside accounts, sends messages, or publishes posts/);
 const sql=readFileSync(new URL("../../../supabase/migrations/20261113080000_ifund_member_connections_hub.sql",import.meta.url),"utf8");
 assert.match(sql,/ifund_member_connection_assistance enable row level security/);
 assert.match(sql,/on conflict\(owner_id\) do update/);
 assert.match(sql,/grant execute on function public\.ifund_set_connection_assistance\(boolean\) to authenticated/);
});
