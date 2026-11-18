import test from "node:test";
import assert from "node:assert/strict";
import {
  restoreBrowserCampaign,
  restoreWritingBrief,
  emptyWritingBrief,
  rememberBrowserCampaign,
  forgetBrowserCampaign,
  importGuestCampaign,
  hasUnclaimedGuestCampaign,
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
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
  assert.equal(hasUnclaimedGuestCampaign(storage), true);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
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
test("browser campaign autosave requires exact readback, including unchanged existing drafts", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Original campaign" };
  assert.equal(rememberBrowserCampaign(storage, A, form), true);
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  const before = storage.getItem(key);
  const blocked = { ...storage, setItem() {} };
  const changed = { ...form, story: "New details not stored" };
  assert.equal(rememberBrowserCampaign(blocked, A, changed), false);
  assert.equal(storage.getItem(key), before);
  assert.equal(restoreBrowserCampaign(storage, A).story, form.story);
  const fresh = store();
  assert.equal(rememberBrowserCampaign({ ...fresh, setItem() {} }, B, form), false);
  assert.deepEqual(restoreBrowserCampaign(fresh, B), emptyCampaignForm());
});

test("silent scoped deletion cannot masquerade as a successful privacy cleanup", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Private work still present" };
  assert.equal(rememberBrowserCampaign(storage, A, form), true);
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  const retained = storage.getItem(key);
  const silent = { ...storage, removeItem() {} };
  assert.equal(forgetBrowserCampaign(silent, A), false);
  assert.equal(storage.getItem(key), retained);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.equal(forgetBrowserCampaign(storage, A), true, "explicit retry can complete cleanup");
  assert.equal(storage.getItem(key), null);
});

test("legacy owner cleanup must verify removal instead of reporting success", () => {
  const storage = store();
  const legacyKey = "ifund-guest-campaign-v1";
  const form = { ...emptyCampaignForm(), title: "Legacy private owner text" };
  const raw = JSON.stringify({ version: 2, owner_id: A, form });
  storage.setItem(legacyKey, raw);
  const silent = { ...storage, removeItem() {} };
  assert.equal(forgetBrowserCampaign(silent, A), false);
  assert.equal(storage.getItem(legacyKey), raw);
  assert.equal(forgetBrowserCampaign(storage, A), true);
  assert.equal(storage.getItem(legacyKey), null);
});

test("cross-account and corrupted browser drafts are never removed", () => {
  const storage = store();
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  const foreign = JSON.stringify({ version: 2, owner_id: B, form: emptyCampaignForm() });
  storage.setItem(key, foreign);
  assert.equal(forgetBrowserCampaign(storage, A), false);
  assert.equal(storage.getItem(key), foreign);
  storage.setItem(key, "{recoverable");
  assert.equal(forgetBrowserCampaign(storage, A), false);
  assert.equal(storage.getItem(key), "{recoverable");
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
  assert.deepEqual(restoreWritingBrief(storage, A), emptyWritingBrief());
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
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
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.deepEqual(restoreBrowserCampaign(storage, null), form);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
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
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  const unavailable = { getItem: () => { throw new Error("Storage disabled"); } };
  assert.deepEqual(restoreBrowserCampaign(unavailable, A), emptyCampaignForm());
  assert.equal(rememberBrowserCampaign(unavailable, A, emptyCampaignForm()), false);
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

test("autosave preserves malformed scoped form payloads without erasing recoverable bytes", () => {
  const storage = store();
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  for (const malformedForm of [null, [], "unexpected text", 42]) {
    const raw = JSON.stringify({ version: 2, owner_id: A, form: malformedForm });
    storage.setItem(key, raw);
    assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
    assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
    assert.equal(storage.getItem(key), raw);
  }
});

test("malformed guest drafts remain recoverable when verified owner opens editor", () => {
  for (const invalidForm of [null, [], "broken", 42]) {
    const storage = store();
    const raw = JSON.stringify({ version: 2, owner_id: null, form: invalidForm });
    const guestKey = "ifund-guest-campaign-v1:guest";
    storage.setItem(guestKey, raw);
    assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
    assert.equal(storage.getItem(guestKey), raw, "invalid guest record must not be consumed");
    assert.equal(storage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(A)), null);
    assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), true);
    assert.equal(storage.getItem(guestKey), raw, "saving a new owner draft must not erase malformed guest data");
  }
});

test("legacy matching-owner malformed forms survive autosave without byte loss", () => {
  for (const malformedForm of [null, [], "recoverable text", 42]) {
    const storage = store();
    const raw = JSON.stringify({ version: 2, owner_id: A, form: malformedForm });
    storage.setItem("ifund-guest-campaign-v1", raw);
    assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
    assert.equal(storage.getItem("ifund-guest-campaign-v1"), raw);
    assert.equal(storage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(A)), null);
    assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
    assert.equal(storage.getItem("ifund-guest-campaign-v1"), raw);
  }
});

test("valid matching-owner legacy draft migrates intact before autosave", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Legacy owner text" };
  const raw = JSON.stringify({ version: 2, owner_id: A, form });
  storage.setItem("ifund-guest-campaign-v1", raw);
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.equal(storage.getItem("ifund-guest-campaign-v1"), null);
  assert.equal(restoreBrowserCampaign(storage, A).title, "Legacy owner text");
});

test("failed legacy migration retains original source when destination write throws", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Preserve on quota" };
  const raw = JSON.stringify({ version: 2, owner_id: A, form });
  storage.setItem("ifund-guest-campaign-v1", raw);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(rememberBrowserCampaign(storage, A, form), false);
  assert.equal(storage.getItem("ifund-guest-campaign-v1"), raw);
});

test("first blank autosave cannot erase a newly migrated matching-owner legacy draft", () => {
  const storage = store();
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  const form = { ...emptyCampaignForm(), title: "Keep original title", story: "Keep original story" };
  const raw = JSON.stringify({ version: 2, owner_id: A, form });
  storage.setItem("ifund-guest-campaign-v1", raw);
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  assert.equal(storage.getItem(key), raw, "migration must retain the exact original bytes");
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.equal(rememberBrowserCampaign(storage, A, form), true, "hydrated editor may save");
});

test("owner autosave cannot claim a guest draft without explicit consent", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Guest story" };
  assert.equal(rememberBrowserCampaign(storage, null, form), true);
  // A new owner may save their own empty draft, but must not consume or
  // expose the guest's private text without an explicit import action.
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), true);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
  assert.equal(restoreBrowserCampaign(storage, null).title, "Guest story");
  assert.deepEqual(importGuestCampaign(storage, A), { status: "owner_exists" });
  assert.equal(restoreBrowserCampaign(storage, null).title, "Guest story");
});

test("legacy remove failure never erases migrated text", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Retain on remove failure" };
  const raw = JSON.stringify({ version: 2, owner_id: A, form });
  storage.setItem("ifund-guest-campaign-v1", raw);
  storage.removeItem = () => { throw new Error("RemoveBlocked"); };
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  assert.equal(storage.getItem("ifund-guest-campaign-v1"), raw);
  assert.equal(storage.getItem("ifund-guest-campaign-v1:owner:" + encodeURIComponent(A)), raw);
});


test("repeated blank pre-hydration autosaves preserve migrated text until deliberate clear", () => {
  const storage = store();
  const key = "ifund-guest-campaign-v1:owner:" + encodeURIComponent(A);
  const form = { ...emptyCampaignForm(), title: "Keep across effects", story: "Do not erase" };
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({ version: 2, owner_id: A, form }));
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  const bytes = storage.getItem(key);
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm()), false);
  assert.equal(storage.getItem(key), bytes);
  assert.equal(rememberBrowserCampaign(storage, A, emptyCampaignForm(), undefined, { allowBlankOverwrite: true }), true);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
});

test("legacy guest draft requires consent and imports only into chosen owner", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Legacy guest needs consent" };
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({
    version: 2, owner_id: null, form, brief: emptyWritingBrief(),
  }));
  assert.equal(hasUnclaimedGuestCampaign(storage), true);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
  assert.equal(restoreBrowserCampaign(storage, A).title, form.title);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
  assert.equal(hasUnclaimedGuestCampaign(storage), false);
});

test("legacy guest cleanup failure preserves original and reports retained copy", () => {
  const storage = store();
  const raw = JSON.stringify({ version: 2, owner_id: null,
    form: { ...emptyCampaignForm(), title: "Retain on cleanup failure" } });
  storage.setItem("ifund-guest-campaign-v1", raw);
  const throwing = { ...storage, removeItem(key) {
    if (key === "ifund-guest-campaign-v1") throw new Error("blocked");
    storage.removeItem(key);
  } };
  assert.deepEqual(importGuestCampaign(throwing, A), { status: "imported_guest_retained" });
  assert.equal(storage.getItem("ifund-guest-campaign-v1"), raw);
  assert.equal(restoreBrowserCampaign(storage, A).title, "Retain on cleanup failure");
});

test("silent destination writes never claim a guest draft was imported", () => {
  const storage = store();
  const form = { ...emptyCampaignForm(), title: "Unclaimed guest text" };
  assert.equal(rememberBrowserCampaign(storage, null, form), true);
  const guestKey = "ifund-guest-campaign-v1:guest";
  const raw = storage.getItem(guestKey);
  const silent = { ...storage, setItem() {} };
  assert.deepEqual(importGuestCampaign(silent, A), { status: "write_failed" });
  assert.equal(storage.getItem(guestKey), raw, "the original guest draft is retained");
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
});

test("silent removals flag retained guest text, then explicit retry can finish cleanup", () => {
  const storage = store();
  const guestKey = "ifund-guest-campaign-v1:guest";
  const form = { ...emptyCampaignForm(), title: "Shared device private text" };
  assert.equal(rememberBrowserCampaign(storage, null, form), true);
  const raw = storage.getItem(guestKey);
  const silent = { ...storage, removeItem() {} };
  assert.deepEqual(importGuestCampaign(silent, A), { status: "imported_guest_retained" });
  assert.equal(storage.getItem(guestKey), raw);
  assert.equal(restoreBrowserCampaign(storage, A).title, form.title);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" }, "explicit retry cleans up the unchanged duplicate");
  assert.equal(storage.getItem(guestKey), null);
  assert.equal(hasUnclaimedGuestCampaign(storage), false);
});

test("import cleanup retry never overwrites a modified owner record", () => {
  const storage = store(), guestKey = "ifund-guest-campaign-v1:guest";
  const form = { ...emptyCampaignForm(), title: "Original guest story" };
  rememberBrowserCampaign(storage, null, form);
  const silent = { ...storage, removeItem() {} };
  assert.deepEqual(importGuestCampaign(silent, A), { status: "imported_guest_retained" });
  const edited = { ...form, title: "Revised by verified owner" };
  assert.equal(rememberBrowserCampaign(storage, A, edited), true);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "owner_exists" });
  assert.equal(restoreBrowserCampaign(storage, A).title, edited.title);
  assert.ok(storage.getItem(guestKey), "guest text is retained rather than presumed redundant");
  assert.deepEqual(importGuestCampaign(storage, B), { status: "imported" }, "different owner still requires an explicit import");
  assert.equal(restoreBrowserCampaign(storage, A).title, edited.title);
});

test("silent guest cleanup followed by a foreign new guest never destroys their later draft", () => {
  const storage = store();
  const original = { ...emptyCampaignForm(), title: "Original guest" };
  rememberBrowserCampaign(storage, null, original);
  const silent = { ...storage, removeItem() {} };
  assert.deepEqual(importGuestCampaign(silent, A), { status: "imported_guest_retained" });
  const second = { ...emptyCampaignForm(), title: "Other guest" };
  rememberBrowserCampaign(storage, null, second);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "owner_exists" });
  assert.equal(restoreBrowserCampaign(storage, A).title, original.title);
  assert.equal(restoreBrowserCampaign(storage, null).title, second.title);
});

test("failed legacy guest storage read blocks consent detection instead of treating as absent", () => {
  const storage = { getItem() { throw new Error("storage blocked"); } };
  assert.throws(() => hasUnclaimedGuestCampaign(storage), /storage blocked/);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "storage_error" });
});

test("a corrupt scoped guest slot cannot conceal a valid older guest draft", () => {
  const storage = store();
  const scoped = "ifund-guest-campaign-v1:guest";
  const legacy = "ifund-guest-campaign-v1";
  const rawScoped = "{recoverable broken guest bytes";
  const form = { ...emptyCampaignForm(), title: "Older legitimate guest" };
  storage.setItem(scoped, rawScoped);
  storage.setItem(legacy, JSON.stringify({ version: 2, owner_id: null, form }));
  assert.equal(hasUnclaimedGuestCampaign(storage), true);
  assert.deepEqual(restoreBrowserCampaign(storage, A), emptyCampaignForm());
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
  assert.deepEqual(restoreBrowserCampaign(storage, A), form);
  assert.equal(storage.getItem(scoped), rawScoped, "corrupt source remains available for recovery");
  assert.equal(storage.getItem(legacy), null);
  assert.deepEqual(restoreBrowserCampaign(storage, B), emptyCampaignForm());
});

test("a valid scoped guest wins over legacy without deleting the older copy", () => {
  const storage = store();
  const scoped = "ifund-guest-campaign-v1:guest";
  const legacy = "ifund-guest-campaign-v1";
  const scopedForm = { ...emptyCampaignForm(), title: "Newer guest" };
  const legacyRaw = JSON.stringify({ version: 2, owner_id: null,
    form: { ...emptyCampaignForm(), title: "Older guest" } });
  storage.setItem(scoped, JSON.stringify({ version: 2, owner_id: null, form: scopedForm }));
  storage.setItem(legacy, legacyRaw);
  assert.deepEqual(importGuestCampaign(storage, A), { status: "imported" });
  assert.deepEqual(restoreBrowserCampaign(storage, A), scopedForm);
  assert.equal(storage.getItem(legacy), legacyRaw);
});

test("existing owner draft is never overwritten during fallback legacy import", () => {
  const storage = store();
  const owner = { ...emptyCampaignForm(), title: "Existing owner content" };
  const legacy = { ...emptyCampaignForm(), title: "Unclaimed legacy" };
  assert.equal(rememberBrowserCampaign(storage, A, owner), true);
  storage.setItem("ifund-guest-campaign-v1:guest", "{corrupt");
  storage.setItem("ifund-guest-campaign-v1", JSON.stringify({ version: 2, owner_id: null, form: legacy }));
  assert.deepEqual(importGuestCampaign(storage, A), { status: "owner_exists" });
  assert.deepEqual(restoreBrowserCampaign(storage, A), owner);
  assert.equal(hasUnclaimedGuestCampaign(storage), true);
});
