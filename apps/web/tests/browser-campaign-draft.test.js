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
  forgetBrowserCampaign(storage, A);
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
    storage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(A)),
    /never-store|request_id|access_token/,
  );
});

test("two verified accounts retain separate drafts across A to B to A transitions", () => {
  const storage = store();
  const a = { ...emptyCampaignForm(), title: "Account A private" };
  const b = { ...emptyCampaignForm(), title: "Account B private" };
  rememberBrowserCampaign(storage, A, a);
  rememberBrowserCampaign(storage, B, b);
  assert.deepEqual(restoreBrowserCampaign(storage, A), a);
  assert.deepEqual(restoreBrowserCampaign(storage, B), b);
  assert.deepEqual(restoreBrowserCampaign(storage, null), emptyCampaignForm());
  assert.equal(forgetBrowserCampaign(storage, B), true);
  assert.deepEqual(restoreBrowserCampaign(storage, A), a);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
});

test("legacy v2 guest text transfers to verified owner without leaking to another owner", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Legacy guest" };
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({
    version: 2, owner_id: null, form,
  }));
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, null), emptyCampaignForm());
});

test("legacy v2 owned draft remains scoped to its matching identity", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Legacy owner A" };
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({
    version: 2, owner_id: A, form,
  }));
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
});

test("quota and unavailable storage failures cannot produce a saved receipt", () => {
  const storage = store();
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => rememberBrowserCampaign(storage, A, emptyCampaignForm()), /QuotaExceededError/);
  const unavailable = { getItem: () => { throw new Error("Storage disabled"); } };
  assert.throws(() => restoreBrowserCampaign(unavailable, A), /Storage disabled/);
  assert.throws(() => rememberBrowserCampaign(unavailable, A, emptyCampaignForm()), /Storage disabled/);
});

test("initial mount and autosave preserve malformed and foreign scoped records", () => {
  const storage = store();
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2, owner_id: B, form: emptyCampaignForm() })]) {
    storage.setItem(key, raw);
    assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
    assert.equal(rememberBrowserCampaign(storage, A, { ...emptyCampaignForm(), title: "New text" }), false);
    assert.equal(storage.getItem(key), raw, "autosave must not destroy a recoverable record");
  }
  storage.removeItem(key);
  assert.equal(rememberBrowserCampaign(storage, A, { ...emptyCampaignForm(), title: "Safe" }), true);
  assert.equal(restoreBrowserCampaign(storage, A).title, "Safe");
});
