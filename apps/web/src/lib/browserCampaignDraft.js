import { emptyCampaignForm } from "./campaignLifecycle.js";
import { CAMPAIGN_WRITING_PATHS } from "./campaignWritingPaths.js";

const KEY = "ifund-guest-campaign-v1";
const LEGACY_BACKUP = "ifund-unscoped-campaign-v1";

// A browser draft may pass from a guest to their first signed-in identity.
// Once attributed, another identity (including signed-out) cannot restore it.
// This is local UI isolation; server ownership is still checked on every save.
function scopedRecord(storage, ownerId) {
  const raw = storage.getItem(KEY);
  if (!raw) return null;
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return null;
  }
  if (record?.version !== 2) {
    return null;
  }
  if (record.owner_id !== null && record.owner_id !== ownerId) return null;
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
  const raw = storage.getItem(KEY);
  let version;
  try {
    version = JSON.parse(raw)?.version;
  } catch {
    /* preserve unparseable old text too */
  }
  // Never overwrite a draft owned by another signed-in account or a signed-out user.
  // A guest-owned (null) draft may still be claimed by the first verified account.
  if (version === 2) {
    let existing;
    try { existing = JSON.parse(raw); } catch { /* invalid record is handled below */ }
    if (existing?.owner_id != null && existing.owner_id !== ownerId) return false;
  }
  // Older previews did not record ownership. Archive before overwriting; never
  // automatically display unattributed text to the next authenticated account.
  if (raw && version !== 2 && !storage.getItem(LEGACY_BACKUP))
    storage.setItem(LEGACY_BACKUP, raw);
  storage.setItem(
    KEY,
    JSON.stringify({
      version: 2,
      owner_id: ownerId,
      form: campaignForm(form),
      writing_brief: writingBrief(brief),
    }),
  );
  return true;
}

export function forgetBrowserCampaign(storage) {
  storage.removeItem(KEY);
}
