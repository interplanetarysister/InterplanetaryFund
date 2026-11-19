import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
test("guides people through one account at a time",()=>{
  assert.match(source,/Three steps to share with confidence/);
  assert.match(source,/Choose an account/);
  assert.match(source,/Connect or save a link/);
  assert.match(source,/Manual or draft assistance/);
  assert.match(source,/scrollIntoView/);
});
test("account, public link, and posting permissions are distinct",()=>{
  assert.match(source,/What can iFund do with this account/);
  assert.match(source,/Automated external posting/);
  assert.match(source,/A verified sign-in, public URL and membership subscription are separate permissions/);
  assert.match(source,/providerReady\[selectedOAuth\]===true/);
  assert.match(source,/hostIsTrusted\(selectedOAuth,payload\.authorization_url\)/);
});
test("manual share copies only the member's verified active public campaign link",()=>{
  assert.match(source,/campaigns\.find\(row=>row\.id===pairedCampaign && row\.status==="active"\)/);
  assert.match(source,/authClient\(\)\.auth\.getUser\(\)/);
  assert.match(source,/data\?\.user\?\.id!==user\.id/);
  assert.match(source,/https:\/\/interplanetaryfund\.com\/campaign\//);
  assert.match(source,/navigator\.clipboard\.writeText/);
  assert.match(source,/Open \{selected\.name\} to post/);
  assert.match(source,/iFund does not post anything for you/);
});
