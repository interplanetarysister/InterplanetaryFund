import { emptyCampaignForm } from "./campaignLifecycle.js";

const KEY = "ifund-guest-campaign-v1";
const LEGACY_BACKUP = "ifund-unscoped-campaign-v1";

// A browser draft may pass from a guest to their first signed-in identity.
// Once attributed, another identity (including signed-out) cannot restore it.
// This is local UI isolation; server ownership is still checked on every save.
export function restoreBrowserCampaign(storage, ownerId) {
  const raw = storage.getItem(KEY);
  if (!raw) return emptyCampaignForm();
  let record;
  try { record = JSON.parse(raw); } catch { return emptyCampaignForm(); }
  if (record?.version !== 2) {
    return emptyCampaignForm();
  }
  if (record.owner_id !== null && record.owner_id !== ownerId) return emptyCampaignForm();
  if (!record.form || typeof record.form !== "object" || Array.isArray(record.form)) return emptyCampaignForm();
  return Object.fromEntries(Object.entries(emptyCampaignForm()).map(([key, fallback]) => [
    key, typeof record.form[key] === "string" ? record.form[key] : fallback,
  ]));
}

export function rememberBrowserCampaign(storage, ownerId, form) {
  const raw = storage.getItem(KEY);
  let version;
  try { version = JSON.parse(raw)?.version; } catch { /* preserve unparseable old text too */ }
  // Older previews did not record ownership. Archive before overwriting; never
  // automatically display unattributed text to the next authenticated account.
  if (raw && version !== 2 && !storage.getItem(LEGACY_BACKUP)) storage.setItem(LEGACY_BACKUP, raw);
  storage.setItem(KEY, JSON.stringify({ version: 2, owner_id: ownerId, form }));
}

export function forgetBrowserCampaign(storage) {
  storage.removeItem(KEY);
}
