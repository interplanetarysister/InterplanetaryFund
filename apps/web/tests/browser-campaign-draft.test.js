import test from "node:test";
import assert from "node:assert/strict";
import {
  restoreBrowserCampaign,
  restoreWritingBrief,
  emptyWritingBrief,
  rememberBrowserCampaign,
  forgetBrowserCampaign,
} from "../src/lib/browserCampaignDraft.js";
import { emptyCampaignForm } from "../src/lib/campaignLifecycle.js";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
function store() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test("guest campaign text transfers once to its first signed-in owner", () => {
  const storage = store(),
    form = { ...emptyCampaignForm(), title: "Guest's campaign" };
  rememberBrowserCampaign(storage, null, form);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  rememberBrowserCampaign(storage, A, form);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, null), emptyCampaignForm());
});
test("successful saving erases the browser handoff without changing a saved record", () => {
  const storage = store();
  rememberBrowserCampaign(storage, A, {
    ...emptyCampaignForm(),
    title: "Private text",
  });
  forgetBrowserCampaign(storage);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
});
test("legacy unscoped text is preserved without exposing it to another identity", () => {
  const storage = store(),
    legacy = JSON.stringify({ title: "Unattributed old draft" });
  storage.setItem("ifund-guest-campaign-v1", legacy);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  rememberBrowserCampaign(storage, B, emptyCampaignForm());
  assert.equal(storage.getItem("ifund-unscoped-campaign-v1"), legacy);
});
test("invalid storage never becomes a private campaign form", () => {
  const storage = store();
  for (const raw of [
    "broken",
    "null",
    JSON.stringify({ version: 2, owner_id: A, form: [] }),
  ]) {
    storage.setItem("ifund-guest-campaign-v1", raw);
    assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  }
});
test("writing brief follows the same guest handoff and identity boundary without storing execution credentials", () => {
  const storage = store();
  const brief = {
    writingPath: "creative",
    details: "Private creative project facts",
    beneficiary: "My family",
    need: "Recording equipment",
    request_id: "never-store-this",
    access_token: "never-store-token",
  };
  rememberBrowserCampaign(storage, null, emptyCampaignForm(), brief);
  assert.equal(restoreWritingBrief(storage, A).details, brief.details);
  rememberBrowserCampaign(
    storage,
    A,
    {
      ...emptyCampaignForm(),
      request_id: "never-store-request",
      access_token: "never-store-token",
    },
    brief,
  );
  assert.equal(restoreWritingBrief(storage, A).writingPath, "creative");
  assert.deepEqual(restoreWritingBrief(storage, B), emptyWritingBrief());
  assert.deepEqual(restoreWritingBrief(storage, null), emptyWritingBrief());
  assert.doesNotMatch(
    storage.getItem("ifund-guest-campaign-v1"),
    /never-store|request_id|access_token/,
  );
});

test("Base44 wizard extras and progress survive identity-scoped guest handoff", () => {
  const storage = store();
  const draft = { ...emptyCampaignForm(), title: "Care project", end_date: "2026-12-31",
    location: "Everett, Washington", cover_image_is_ai: true,
    ai_profile: { tone: "respectful", never_change: "Keep exact beneficiary name" },
    story_versions: [{ text: "A prior complete story", saved_at: "2026-11-10" }] };
  rememberBrowserCampaign(storage, null, draft, { draftStep: 2, details: "Campaign information", writingPath: "write" });
  assert.deepEqual(restoreBrowserCampaign(storage, A), draft);
  assert.equal(restoreWritingBrief(storage, A).draftStep, 2);
  rememberBrowserCampaign(storage, A, draft, { draftStep: 2 });
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.equal(restoreWritingBrief(storage, B).draftStep, 0);
});
