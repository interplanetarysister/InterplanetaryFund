// Campaign sharing: builds the canonical public link, the share text and the
// third-party share targets. Pure functions only, so the logic is unit
// testable without a browser. No SDK, no tracking, no network calls.
//
// Relative import target so node:test can import this directly.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only the branded production origin may appear in a link we hand to another
// platform, so a preview or hostile origin can never be shared as canonical.
export const CANONICAL_ORIGIN = "https://interplanetaryfund.com";

function normalizeOrigin(origin) {
  if (typeof origin !== "string" || origin === "") return CANONICAL_ORIGIN;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return CANONICAL_ORIGIN;
    return parsed.origin;
  } catch {
    return CANONICAL_ORIGIN;
  }
}

/** Canonical public link for a campaign. Returns "" for a non-UUID id. */
export function campaignShareUrl(campaignId, origin = CANONICAL_ORIGIN) {
  if (!UUID.test(String(campaignId || ""))) return "";
  return `${normalizeOrigin(origin)}/campaign/${String(campaignId).toLowerCase()}`;
}

/** Canonical embeddable card URL for a campaign. Returns "" for a non-UUID id. */
export function campaignEmbedUrl(campaignId, origin = CANONICAL_ORIGIN) {
  if (!UUID.test(String(campaignId || ""))) return "";
  return `${normalizeOrigin(origin)}/embed/campaign/${String(campaignId).toLowerCase()}`;
}

// The title is interpolated into an HTML attribute of code the owner pastes into
// their own site, so it must not be able to close the attribute or the tag.
function escapeHtmlAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Ready-to-paste iframe snippet for the embeddable campaign card. Returns "" for
 * a non-UUID id. No script is emitted: the card is inert markup and the visitor
 * is sent to the public campaign page for anything interactive.
 */
export function campaignEmbedSnippet(campaign = {}, origin = CANONICAL_ORIGIN) {
  const src = campaignEmbedUrl(campaign?.id, origin);
  if (!src) return "";
  const title = escapeHtmlAttribute(String(campaign?.title || "").trim() || "Interplanetary Fund campaign");
  return `<iframe src="${src}" title="${title}" width="100%" height="420" ` +
    `style="border:0;max-width:420px" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
}

/** Title + one-line summary used as the share message. */
export function campaignShareText(campaign = {}) {
  const title = String(campaign.title || "").trim() || "an Interplanetary Fund campaign";
  const summary = String(campaign.summary || "").trim();
  return summary ? `${title} — ${summary}` : title;
}

const clamp = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);

/**
 * Third-party share destinations. Every dynamic value is percent-encoded, so a
 * campaign title containing "&" or quotes cannot break out of the query string.
 */
export function shareTargets(campaign = {}, url = "") {
  if (!url) return [];
  const text = clamp(campaignShareText(campaign), 200);
  const subject = String(campaign.title || "").trim() || "Interplanetary Fund campaign";
  const e = encodeURIComponent;
  return [
    { id: "x", label: "Share on X", href: `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}` },
    { id: "facebook", label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { id: "bluesky", label: "Post on Bluesky", href: "https://bsky.app/intent/compose?" + new URLSearchParams({
      text: `${Array.from(campaignShareText(campaign)).slice(0, 150).join("").trimEnd()}\n\n${campaignShareUrl(campaign.id) || url}`,
    }) },
    { id: "linkedin", label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}` },
    { id: "email", label: "Share by email", href: `mailto:?subject=${e(subject)}&body=${e(`${text}\n\n${url}`)}` },
  ];
}

/** Payload for the Web Share API. */
export function buildSharePayload(campaign = {}, url = "") {
  return { title: String(campaign.title || "").trim() || "Interplanetary Fund campaign", text: campaignShareText(campaign), url };
}

/** True when the browser exposes the Web Share API (mobile-first path). */
export function canUseWebShare(navigatorLike) {
  return Boolean(navigatorLike && typeof navigatorLike.share === "function");
}
