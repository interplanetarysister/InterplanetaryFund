import test from "node:test";
import assert from "node:assert/strict";
import { campaignPublicUrl, campaignEmbedCode } from "../src/lib/campaignSharing.js";
const id = "9f43b6f7-4581-47fc-a267-2c4157ec48eb";

test("campaign sharing only uses valid UUIDs and secure origins", () => {
  assert.equal(campaignPublicUrl("https://interplanetaryfund.com", id),
    "https://interplanetaryfund.com/campaign/" + id);
  assert.throws(() => campaignPublicUrl("javascript:alert(1)", id), /Secure/);
  assert.throws(() => campaignPublicUrl("http://example.com", id), /Secure/);
  assert.throws(() => campaignPublicUrl("https://example.com", '" onload="evil'), /Invalid campaign/);
});
test("share embed uses the read-only public card route", () => {
  const html = campaignEmbedCode("https://interplanetaryfund.com", id);
  assert.match(html, /<iframe /);
  assert.match(html, /\/embed\/campaign\/9f43b6f7/);
  assert.match(html, /referrerpolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(html, /paypal|checkout|payment/);
});
