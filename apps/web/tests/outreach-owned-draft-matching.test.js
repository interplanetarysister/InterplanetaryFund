import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui=readFileSync(new URL("../src/pages/Institutions.jsx",import.meta.url),"utf8");

test("Outreach research can match signed-in creator drafts without exporting them",()=>{
  assert.match(ui,/const client=authClient\(\)/);
  assert.match(ui,/client\.auth\.getUser\(\)/);
  assert.match(ui,/\.eq\("owner_id",user\.id\)/);
  assert.match(ui,/select\("id,title,summary,story,category,status"\)/);
  assert.match(ui,/ownerCampaigns/);
  assert.match(ui,/private draft content is not sent to external providers/);
  assert.match(ui,/listActiveCampaigns\(\{limit:100\}\)/);
});
test("private campaign context is cleared immediately on identity change",()=>{
  assert.match(ui,/onAuthStateChange/);
  assert.match(ui,/\+\+revision/);
  assert.match(ui,/setOwnerCampaigns\(\[\]\)/);
  assert.match(ui,/setSelectedCampaign\(""\)/);
  assert.match(ui,/checked\.data\?\.user\?\.id!==user\.id/);
  assert.match(ui,/subscription\?\.unsubscribe\(\)/);
});
test("opportunity provider names and programs remain verified external data",()=>{
  assert.match(ui,/body\.source!=="canonical_supabase_rls"/);
  assert.match(ui,/No unverified listings were substituted/);
  assert.match(ui,/A program listing is not a guarantee/);
});
