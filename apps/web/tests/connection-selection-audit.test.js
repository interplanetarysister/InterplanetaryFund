import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");

// The redesigned LINK page selects platforms by query parameter, not the
// deprecated local selectedProvider state. Assert current behavior rather than
// anchoring tests to removed component variable names.
test("LINK shows connection totals and selected-provider instructions",()=>{
  assert.match(source,/Connection overview/);
  assert.match(source,/>Actively connected</);
  assert.match(source,/>Available to add</);
  assert.match(source,/CONNECTION_PLATFORMS\.filter/);
  assert.match(source,/selectedConnectionPlatform\(requested\)/);
  assert.match(source,/aria-pressed=\{active\}/);
  assert.match(source,/onClick=\{\(\)=>choosePlatform\(platform\)\}/);
  assert.match(source,/setParams\(\{connect:platform\.id\}\)/);
  assert.match(source,/id="connection-details"/);
});
test("connection state never implies permission to publish outside iFund",()=>{
  assert.match(source,/row\.status==="connected" && Boolean\(row\.verified_at\)/);
  assert.match(source,/connectionCapabilityReadiness\(\{record:account,authorizationEnabled:canStart\}\)/);
  assert.match(source,/chooseHelp\(helpConsent\?\.enabled!==true\)/);
  assert.match(source,/This setting does not post to outside accounts or grant anyone permission to post/);
  assert.match(source,/Review each share before posting outside iFund/);
  assert.match(source,/providerReady\[selectedOAuth\]===true/);
  assert.match(source,/adminStatus==="admin"/);
});
test("member-managed account operations remain identity-, provider-, and URL-verified",()=>{
  assert.match(source,/Confirm disconnect/);
  assert.match(source,/payload\.provider!==selectedOAuth/);
  assert.match(source,/if \(!hostIsTrusted\(selectedOAuth,payload\.authorization_url\)\)/);
  assert.match(source,/u\.protocol==="https:"/);
  assert.match(source,/client\.from\("ifund_connections"\)/);
  assert.match(source,/\.eq\("owner_id",user\.id\)/);
  assert.match(source,/busyLock\.current=true/);
  assert.match(source,/validatePublicConnectionLink\(selected\.id,/);
});
