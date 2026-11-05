import test from "node:test";
import assert from "node:assert/strict";
import { restoreBrowserCampaign, rememberBrowserCampaign, forgetBrowserCampaign } from "../src/lib/browserCampaignDraft.js";
import { emptyCampaignForm } from "../src/lib/campaignLifecycle.js";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
function store() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test("guest campaign text transfers once to its first signed-in owner", () => {
  const storage = store(), form = { ...emptyCampaignForm(), title: "Guest's campaign" };
  rememberBrowserCampaign(storage, null, form);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  rememberBrowserCampaign(storage, A, form);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, null), emptyCampaignForm());
});
test("successful saving erases the browser handoff without changing a saved record", () => {
  const storage = store();
  rememberBrowserCampaign(storage, A, { ...emptyCampaignForm(), title: "Private text" });
  forgetBrowserCampaign(storage);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
});
test("legacy unscoped text is preserved without exposing it to another identity", () => {
  const storage = store(), legacy = JSON.stringify({ title: "Unattributed old draft" });
  storage.setItem("ifund-guest-campaign-v1", legacy);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  rememberBrowserCampaign(storage, B, emptyCampaignForm());
  assert.equal(storage.getItem("ifund-unscoped-campaign-v1"), legacy);
});
test("invalid storage never becomes a private campaign form", () => {
  const storage = store();
  for (const raw of ["broken", "null", JSON.stringify({ version: 2, owner_id: A, form: [] })]) {
    storage.setItem("ifund-guest-campaign-v1", raw);
    assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  }
});
