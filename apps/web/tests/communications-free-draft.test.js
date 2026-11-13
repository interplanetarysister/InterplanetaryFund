import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_WORKSPACES } from "../src/lib/agentWorkspaces.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const ui=read("../src/pages/CommunicationsWorkspace.jsx");
const app=read("../src/App.jsx");
const identity=AGENT_WORKSPACES.find(x=>x.service==="communications_agent");

test("ECHO is a free owner-scoped drafting tool, not an unapproved broadcast mechanism",()=>{
  assert.match(ui,/\.eq\("owner_id",user\.id\)/);
  assert.match(ui,/const client=authClient\(\)/);
  assert.match(ui,/client\.auth\.getUser\(\)/);
  assert.match(ui,/manual review and sharing/);
  assert.match(ui,/does not call an AI model or send email/);
  assert.doesNotMatch(ui,/sendCommunication|sendEmail|publishPost|\/v1\/messages|Mailgun|Resend|SMTP/);
});
test("only active campaign URLs are put in manual draft messages",()=>{
  assert.match(ui,/item\.status==="active"\?/);
  assert.match(ui,/https:\/\/interplanetaryfund\.com\/campaign/);
  assert.match(ui,/const item=state\.campaigns\.find\(c=>c\.id===campaignId\)/);
});
test("communications replace the placeholder route without lifting account controls",()=>{
  assert.match(app,/path="\/communications" element=\{<MemberAccess><CommunicationsWorkspace \/><\/MemberAccess>\}/);
  assert.ok(!app.includes('"/communications", "/mission"'));
  assert.equal(identity?.path,"/communications");
});
