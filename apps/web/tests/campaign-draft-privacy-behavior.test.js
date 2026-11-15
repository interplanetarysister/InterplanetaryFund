import test from "node:test";
import assert from "node:assert/strict";
import {
  hasUnclaimedGuestCampaign,
  importGuestCampaign,
  restoreBrowserCampaign,
  rememberBrowserCampaign,
} from "../src/lib/browserCampaignDraft.js";

const GUEST = "ifund-guest-campaign-v1:guest";
const OWNER = (id) => "ifund-guest-campaign-v1:owner:" + encodeURIComponent(id);
const draft = (owner_id, title = "Private story") =>
  JSON.stringify({ version: 2, owner_id, form: { title, story: "Confidential" }, writing_brief: { writingPath: "write", details: "Sensitive" } });

function storage(seed = {}, failures = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { if (failures.get === key || failures.get === "*") throw Error("read denied"); return values.get(key) ?? null; },
    setItem(key, value) { if (failures.set === key || failures.set === "*") throw Error("write denied"); values.set(key, String(value)); },
    removeItem(key) { if (failures.remove === key || failures.remove === "*") throw Error("delete denied"); values.delete(key); },
  };
}

test("guest draft is never automatically attributed to a verified owner", () => {
  const s = storage({ [GUEST]: draft(null) });
  assert.equal(hasUnclaimedGuestCampaign(s), true);
  assert.equal(restoreBrowserCampaign(s, "A").title, "");
  assert.equal(s.values.has(OWNER("A")), false);
  assert.equal(importGuestCampaign(s, "A").status, "imported");
  assert.equal(restoreBrowserCampaign(s, "A").title, "Private story");
  assert.equal(s.values.has(GUEST), false);
});

test("A to B to A preserves separate private drafts", () => {
  const s = storage({ [OWNER("A")]: draft("A", "A only"), [OWNER("B")]: draft("B", "B only") });
  assert.equal(restoreBrowserCampaign(s, "A").title, "A only");
  assert.equal(restoreBrowserCampaign(s, "B").title, "B only");
  assert.equal(restoreBrowserCampaign(s, "A").title, "A only");
});

test("existing owner draft prevents guest import and remains unchanged", () => {
  const s = storage({ [GUEST]: draft(null), [OWNER("A")]: draft("A", "Owner original") });
  assert.equal(importGuestCampaign(s, "A").status, "owner_exists");
  assert.equal(restoreBrowserCampaign(s, "A").title, "Owner original");
  assert.equal(s.values.has(GUEST), true);
});

test("corrupt guest and invalid owner fail without creating an owner record", () => {
  const s = storage({ [GUEST]: "{bad json" });
  assert.equal(hasUnclaimedGuestCampaign(s), false);
  assert.equal(importGuestCampaign(s, "A").status, "invalid_guest");
  assert.equal(importGuestCampaign(s, null).status, "invalid_owner");
  assert.equal(s.values.has(OWNER("A")), false);
});

test("storage read and destination write failures retain guest draft", () => {
  const unreadable = storage({ [GUEST]: draft(null) }, { get: "*" });
  assert.equal(importGuestCampaign(unreadable, "A").status, "storage_error");
  const unwritable = storage({ [GUEST]: draft(null) }, { set: OWNER("A") });
  assert.equal(importGuestCampaign(unwritable, "A").status, "write_failed");
  assert.equal(unwritable.values.has(GUEST), true);
  assert.equal(unwritable.values.has(OWNER("A")), false);
});

test("failed guest cleanup is reported as imported with retained private copy", () => {
  const s = storage({ [GUEST]: draft(null) }, { remove: GUEST });
  assert.equal(importGuestCampaign(s, "A").status, "imported_guest_retained");
  assert.equal(restoreBrowserCampaign(s, "A").title, "Private story");
  assert.equal(s.values.has(GUEST), true);
});

test("corrupt owner record cannot be silently overwritten by autosave", () => {
  const s = storage({ [OWNER("A")]: "broken" });
  assert.equal(rememberBrowserCampaign(s, "A", { title: "New" }, {}), false);
  assert.equal(s.values.get(OWNER("A")), "broken");
});

test("blank pre-hydration autosave cannot erase an existing nonempty owner draft", () => {
  const s = storage({ [OWNER("A")]: draft("A", "Keep my story") });
  assert.equal(rememberBrowserCampaign(s, "A", {}, {}), false);
  assert.equal(restoreBrowserCampaign(s, "A").title, "Keep my story");
  assert.equal(rememberBrowserCampaign(s, "A", {}, {}, { allowBlankOverwrite: true }), true);
  assert.equal(restoreBrowserCampaign(s, "A").title, "");
});

test("legacy draft owned by another account is never imported into current account", () => {
  const legacy = "ifund-guest-campaign-v1";
  const s = storage({ [legacy]: draft("B", "B private") });
  assert.equal(restoreBrowserCampaign(s, "A").title, "");
  assert.equal(s.values.has(OWNER("A")), false);
  assert.equal(s.values.get(legacy), draft("B", "B private"));
  assert.equal(restoreBrowserCampaign(s, "B").title, "B private");
  assert.equal(s.values.has(OWNER("B")), true);
  assert.equal(s.values.has(legacy), false);
});
