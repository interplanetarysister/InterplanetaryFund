import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { campaignShareUrl, shareTargets } from "../src/lib/campaignShare.js";

const sharing=readFileSync(new URL("../src/components/connections/CampaignShareConnections.jsx",import.meta.url),"utf8");
const hub=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
const id="4e79b8df-fba0-4b4d-8569-35f3e7f4c876";

test("Connections owner sharing only targets published campaigns and reviewable drafts",()=>{
 assert.match(sharing,/c\?\.status==="active"/);
 assert.match(sharing,/shareTargets\(campaign,url\)/);
 assert.match(sharing,/social\?shareCampaign=/);
 assert.match(sharing,/Nothing is posted automatically/);
 assert.match(hub,/CampaignShareConnections campaigns=\{campaigns\}/);
 assert.match(hub,/Recent connection activity/);
 const url=campaignShareUrl(id);
 assert.equal(url,"https://interplanetaryfund.com/campaign/"+id);
 for(const target of shareTargets({id,title:"Community support & hope",summary:"Help our neighbors"},url)){
  assert.ok(["https:","mailto:"].includes(new URL(target.href).protocol));
 }
});
test("Connections stays within member identity and admin-only diagnostics",()=>{
 assert.match(hub,/\\.eq\("owner_id",user\\.id\)/);
 assert.match(hub,/ifund_my_public_links/);
 assert.match(hub,/ifund_my_share_choices/);
 assert.match(hub,/adminStatus==="admin" && <details/);
 assert.match(hub,/canStart && <button/);
 assert.match(hub,/matchesStoredConnection/);
});
