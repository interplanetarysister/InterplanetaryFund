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
      if (parsed?.version === 2 && parsed.owner_id === ownerId &&
          parsed.form && typeof parsed.form === "object" && !Array.isArray(parsed.form)) {
        storage.setItem(key, legacy);
        storage.removeItem(KEY);
        raw = legacy;
      }
    }
  }
  if (!raw && ownerId != null) {
    // A v2 guest record from older previews used the unscoped key.
    // Copy it into the isolated guest slot, preserving it if
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
  if (!raw) return null;
  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  if (record?.version !== 2 || record.owner_id !== ownerId) return null;
  return record;
}

// Never expose a guest's private text to a newly signed-in account without
// an explicit user action. An import is non-destructive until the owner slot
// is written successfully; no existing owner draft is overwritten.
export function hasUnclaimedGuestCampaign(storage) {
  const raw = storage.getItem(ownerKey(null));
  if (!raw) return false;
  try {
    const record = JSON.parse(raw);
    return record?.version === 2 && record.owner_id === null &&
      record.form && typeof record.form === "object" && !Array.isArray(record.form);
  } catch { return false; }
}

export function importGuestCampaign(storage, ownerId) {
  // A structured result prevents the UI from mistaking failed cleanup for
  // a failed import after the owner copy has already been written.
  if (ownerId == null) return { status: "invalid_owner" };
  const destination = ownerKey(ownerId);
  let guestRaw;
  try {
    if (storage.getItem(destination)) return { status: "owner_exists" };
    guestRaw = storage.getItem(ownerKey(null));
  } catch { return { status: "storage_error" }; }
  if (!guestRaw) return { status: "missing_guest" };
  let guest;
  try { guest = JSON.parse(guestRaw); } catch { return { status: "invalid_guest" }; }
  if (guest?.version !== 2 || guest.owner_id !== null || !guest.form ||
      typeof guest.form !== "object" || Array.isArray(guest.form))
    return { status: "invalid_guest" };
  try {
    storage.setItem(destination, JSON.stringify({ ...guest, owner_id: ownerId }));
  } catch { return { status: "write_failed" }; }
  try {
    storage.removeItem(ownerKey(null));
  } catch {
    return { status: "imported_guest_retained" };
  }
  return { status: "imported" };
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

export function rememberBrowserCampaign(storage, ownerId, form, brief, { allowBlankOverwrite = false } = {}) {
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
  // Resolve any legacy migration before checking the destination. A malformed
  // matching legacy record must remain untouched rather than being overwritten.
  const legacyOwned = storage.getItem(KEY);
  if (!existing && legacyOwned) {
    let parsed;
    try { parsed = JSON.parse(legacyOwned); } catch { /* preserve original bytes */ }
    if (parsed?.version === 2 && parsed.owner_id === ownerId &&
        (!parsed.form || typeof parsed.form !== "object" || Array.isArray(parsed.form))) return false;
  }
  // Migrate before writing, then validate again: a legacy record may have
  // populated the owner slot since the initial lookup.
  // If the first editor autosave still has its blank initial form, do not
  // replace a newly migrated draft before hydration can display its text.
  const restored = scopedRecord(storage, ownerId);
  const migrated = storage.getItem(key);
  if (!existing && migrated && restored) {
    const incoming = campaignForm(form);
    const original = campaignForm(restored.form);
    const blank = emptyCampaignForm();
    const incomingBlank = Object.keys(blank).every(field => incoming[field] === blank[field]);
    const originalHasContent = Object.keys(blank).some(field => original[field] !== blank[field]);
    if (incomingBlank && originalHasContent) return false;
  }
  // A repeated pre-hydration autosave must not erase an already migrated
  // nonempty draft. Only an explicit user edit may authorize a blank clear.
  if (migrated && !allowBlankOverwrite) {
    let saved;
    try { saved = JSON.parse(migrated); } catch { return false; }
    if (saved?.version === 2 && saved.owner_id === ownerId && saved.form &&
        typeof saved.form === "object" && !Array.isArray(saved.form)) {
      const blank = emptyCampaignForm();
      const incoming = campaignForm(form);
      const original = campaignForm(saved.form);
      if (Object.keys(blank).every(field => incoming[field] === blank[field]) &&
          Object.keys(blank).some(field => original[field] !== blank[field])) return false;
    }
  }
  if (migrated) {
    let parsed;
    try { parsed = JSON.parse(migrated); } catch { return false; }
    if (parsed?.version !== 2 || parsed.owner_id !== ownerId ||
        !parsed.form || typeof parsed.form !== "object" || Array.isArray(parsed.form)) return false;
  }
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
