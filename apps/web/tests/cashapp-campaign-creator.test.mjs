import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const create=read("../src/pages/CreateCampaign.jsx");
const edit=read("../src/pages/EditCampaign.jsx");
const lifecycle=read("../src/lib/campaignLifecycle.js");
const owner=read("../src/api/ownerCampaigns.js");
const detail=read("../src/pages/CampaignDetail.jsx");
const button=read("../src/components/payments/CashAppDonateButton.jsx");
const migration=read("../../../supabase/migrations/20261121190000_ifund_public_donation_visibility.sql");

test("campaign creator and editor both accept an optional Cash App cashtag",()=>{
  assert.match(create,/id="campaign-cashapp-tag"/);
  assert.match(create,/cashapp_tag:data\.cashapp_tag/);
  assert.match(edit,/id="campaign-cashapp-tag"/);
  assert.match(lifecycle,/cashapp_tag: text\(value\.cashapp_tag\)/);
  assert.match(lifecycle,/valid Cash App \$Cashtag/);
  assert.match(owner,/cashapp_tag/);
});

test("Cash App external payments are disclosed as unverified and separate from campaign totals",()=>{
  assert.match(detail,/CashAppDonateButton/);
  assert.match(button,/not verified or an IFund-verified capture/);
  assert.match(button,/not an IFund-verified capture or a ledger credit/);
});

test("campaign Cashtag storage is validated and selectively exposed",()=>{
  assert.match(migration,/cashapp_tag text/);
  assert.match(migration,/cashapp_tag_check/);
  assert.match(migration,/grant select \(cashapp_tag\)/);
  assert.match(migration,/grant insert, update \(cashapp_tag\)/);
});
