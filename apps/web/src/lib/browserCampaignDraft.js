import { emptyCampaignForm } from "./campaignLifecycle.js";
import { CAMPAIGN_WRITING_PATHS } from "./campaignWritingPaths.js";

const KEY = "ifund-guest-campaign-v1";
const LEGACY_BACKUP = "ifund-unscoped-campaign-v1";

// Each verified owner gets a distinct session draft. The guest slot stays
// separate so signing out never reveals a previous account's work.
const ownerKey = ownerId => ownerId == null ? KEY + ":guest" : KEY + ":owner:" + encodeURIComponent(ownerId);

function scopedRecord(storage, ownerId) {
  const key = ownerKey(ownerId);
  let raw = storage.getItem(key);
  if (!raw) {
    // Migrate a legacy single-slot v2 record only to its matching owner.
    // Never erase a different owner's legacy record or claim it as guest.
    const legacy = storage.getItem(KEY);
    if (legacy) {
      let parsed;
      try { parsed = JSON.parse(legacy); } catch { return null; }
      if (parsed?.version === 2 && parsed.owner_id === ownerId) {
        storage.setItem(key, legacy);
        storage.removeItem(KEY);
        raw = legacy;
      }
    }
  }
  if (!raw && ownerId != null) {
    // A v2 guest record from older previews used the unscoped key.
    // Copy it into the guest slot before claiming it, preserving it if
    // the destination write fails.
    const legacyGuest = storage.getItem(KEY);
    if (legacyGuest && !storage.getItem(ownerKey(null))) {
      let parsed;
      try { parsed = JSON.parse(legacyGuest); } catch { /* keep corrupt text */ }
      if (parsed?.version === 2 && parsed.owner_id === null) {
        storage.setItem(ownerKey(null), legacyGuest);
        storage.removeItem(KEY);
      }
    }
  }
  if (!raw && ownerId != null) {
    // Transfer the unclaimed guest draft to the first verified owner.
    const guestRaw = storage.getItem(ownerKey(null));
    if (guestRaw) {
      let guest;
      try { guest = JSON.parse(guestRaw); } catch { /* preserve malformed data */ }
      if (guest?.version === 2 && guest.owner_id === null &&
          guest.form && typeof guest.form === "object" && !Array.isArray(guest.form)) {
        const claimed = JSON.stringify({ ...guest, owner_id: ownerId });
        storage.setItem(key, claimed);
        storage.removeItem(ownerKey(null));
        raw = claimed;
      }
    }
  }
  if (!raw) return null;
  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  if (record?.version !== 2 || record.owner_id !== ownerId) return null;
  return record;
}

export function restoreBrowserCampaign(storage, ownerId) {
  const record = scopedRecord(storage, ownerId);
  if (!record) return emptyCampaignForm();
  return campaignForm(record.form);
}

function campaignForm(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptyCampaignForm();
  return Object.fromEntries(
    Object.entries(emptyCampaignForm()).map(([key, fallback]) => [
      key,
      typeof fallback === "boolean" ? value[key] === true :
        typeof value[key] === "string" ? value[key] : fallback,
    ]),
  );
}

export function emptyWritingBrief() {
  return { writingPath: "write", details: "", beneficiary: "", need: "" };
}

function writingBrief(value) {
  const result = emptyWritingBrief();
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  if (CAMPAIGN_WRITING_PATHS.some((path) => path.id === value.writingPath))
    result.writingPath = value.writingPath;
  for (const key of ["details", "beneficiary", "need"])
    if (typeof value[key] === "string") result[key] = value[key];
  return result;
}

export function restoreWritingBrief(storage, ownerId) {
  return writingBrief(scopedRecord(storage, ownerId)?.writing_brief);
}

export function rememberBrowserCampaign(storage, ownerId, form, brief) {
  const key = ownerKey(ownerId);
  // Do not overwrite a damaged or mismatched scoped record on initial mount.
  // The editor will show an autosave warning instead of destroying recoverable text.
  const existing = storage.getItem(key);
  if (existing) {
    let parsed;
    try { parsed = JSON.parse(existing); } catch { return false; }
    if (parsed?.version !== 2 || parsed.owner_id !== ownerId ||
        !parsed.form || typeof parsed.form !== "object" || Array.isArray(parsed.form)) return false;
  }
  // Preserve unattributed or malformed legacy data without exposing it to an account.
  const legacy = storage.getItem(KEY);
  if (legacy && !storage.getItem(LEGACY_BACKUP)) {
    let parsed;
    try { parsed = JSON.parse(legacy); } catch { /* preserve malformed source */ }
    if (parsed?.version !== 2) storage.setItem(LEGACY_BACKUP, legacy);
  }
  // Preserve a matching legacy record if the current slot is empty.
  scopedRecord(storage, ownerId);
  storage.setItem(key, JSON.stringify({
    version: 2, owner_id: ownerId,
    form: campaignForm(form), writing_brief: writingBrief(brief),
  }));
  return true;
}

export function forgetBrowserCampaign(storage, ownerId) {
  const key = ownerKey(ownerId);
  const raw = storage.getItem(key);
  if (raw) {
    let record;
    try { record = JSON.parse(raw); } catch { return false; }
    if (record?.version !== 2 || record.owner_id !== ownerId) return false;
    storage.removeItem(key);
  }
  // Only clear the old single-slot record if it belongs to this owner.
  const legacy = storage.getItem(KEY);
  if (legacy) {
    let record;
    try { record = JSON.parse(legacy); } catch { return false; }
    if (record?.version === 2 && record.owner_id === ownerId) storage.removeItem(KEY);
  }
  return true;
}
