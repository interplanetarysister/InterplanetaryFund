const STORAGE_KEY = "ifund-guest-campaign-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CATEGORIES = new Set([
  "medical", "emergency", "education", "community", "animals", "business",
  "memorial", "disaster_relief", "creative", "environment", "other",
]);

function getStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function text(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

export function readGuestCampaignDraft({ storage = getStorage(), now = Date.now() } = {}) {
  const empty = { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "" };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      storage.removeItem(STORAGE_KEY);
      return empty;
    }
    const savedAt = Number(value.savedAt);
    if (!Number.isFinite(savedAt) || savedAt <= 0 || now - savedAt > MAX_AGE_MS || savedAt > now + 60_000) {
      storage.removeItem(STORAGE_KEY);
      return empty;
    }
    return {
      title: text(value.title, 120),
      summary: text(value.summary, 600),
      story: text(value.story, 15000),
      category: CATEGORIES.has(value.category) ? value.category : "community",
      goal_amount: text(value.goal_amount, 20),
      cover_image_url: text(value.cover_image_url, 2048),
    };
  } catch {
    try { storage.removeItem(STORAGE_KEY); } catch { /* storage may be unavailable */ }
    return empty;
  }
}

export function saveGuestCampaignDraft(form, { storage = getStorage(), now = Date.now() } = {}) {
  if (!storage) return false;
  try {
    const value = {
      title: text(form?.title, 120),
      summary: text(form?.summary, 600),
      story: text(form?.story, 15000),
      category: CATEGORIES.has(form?.category) ? form.category : "community",
      goal_amount: text(String(form?.goal_amount ?? ""), 20),
      cover_image_url: text(form?.cover_image_url, 2048),
      savedAt: now,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestCampaignDraft({ storage = getStorage() } = {}) {
  try {
    storage?.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export const GUEST_CAMPAIGN_DRAFT_TTL_MS = MAX_AGE_MS;
