import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifiedFundingProgress } from "../src/lib/fundingTotals.js";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public campaign iframe and download route replace placeholders",()=>{
  const app=file("src/App.jsx");
  assert.match(app,/path="\/embed\/campaign\/:id" element={<EmbedCampaign \/>}/);
  assert.match(app,/path="\/download" element={<DownloadApp \/>}/);
  assert.doesNotMatch(app,/STANDALONE_COMING_SOON = \[[\s\S]*?"\/embed\/campaign\/:id"/);
});

test("embeds only show real published campaign and never accept money inside iframe",()=>{
  const embed=file("src/pages/EmbedCampaign.jsx");
  assert.match(embed,/getCampaignDetail\(id\)/);
  assert.match(embed,/verifiedFundingProgress/);
  assert.match(embed,/target="_blank" rel="noopener noreferrer"/);
  assert.match(embed,/donations are currently paused/);
  assert.doesNotMatch(embed,/base44|service_role|PayPalDonateButton|createDonation|checkout|onPayment/i);
  assert.equal(verifiedFundingProgress({raised_amount:null,goal_amount:100}),null);
  assert.deepEqual(verifiedFundingProgress({raised_amount:20,goal_amount:100}),{raised:20,goal:100,percentage:20});
});

test("download is honest about PWA availability versus signed APK",()=>{
  const download=file("src/pages/DownloadApp.jsx");
  assert.match(download,/beforeinstallprompt/);
  assert.match(download,/appinstalled/);
  assert.match(download,/Android APK downloads are offered only when a signed public IFund release is available/);
  assert.match(download,/This browser install does not download an APK/);
  assert.doesNotMatch(download,/https:\/\/.*\.apk|base44Client|signingKeystore/);
});
