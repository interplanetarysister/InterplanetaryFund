// One policy for campaign-related popup, notification and recommendation actions.
// A destination opens the interaction itself, never performs a mutation on click.
// Do not generate external redirects from notification links or user-supplied text.
const CAMPAIGN_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const SECTIONS = new Set([
  "campaign-updates", "campaign-distribution", "campaign-outreach",
  "campaign-funding", "campaign-share", "campaign-story",
  "campaign-instructions", "campaign-ai", "campaign-health",
  "campaign-settings",
]);
const GENERAL_ROUTES = new Set([
  "/dashboard", "/create", "/connections", "/inbox", "/notifications",
  "/giving", "/ledger", "/withdrawals", "/subscriptions", "/mission",
  "/community", "/institutions", "/discover", "/profile", "/social",
  "/communications", "/following", "/admin/integrations", "/admin/audit",
  "/help", "/about", "/contact",
]);
const DETAIL_ROUTES = [
  /^\/community\/[a-zA-Z0-9_-]{1,128}$/,
  /^\/institutions\/[a-zA-Z0-9_-]{1,128}$/,
];

export function safeActionRoute(value) {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || value.includes("\\") || /[\x00-\x1f]/.test(value) ||
      /%(?:2f|5c|00)/i.test(value)) return null;
  try {
    const url = new URL(value, "https://ifund.invalid");
    if (url.origin !== "https://ifund.invalid" || !url.pathname.startsWith("/")) return null;
    if (GENERAL_ROUTES.has(url.pathname) || DETAIL_ROUTES.some(rule => rule.test(url.pathname)))
      return url.pathname + url.search + url.hash;
    const detail = /^\/campaign\/([^/]+)$/.exec(url.pathname);
    if (detail && CAMPAIGN_ID.test(detail[1])) {
      const fragment = url.hash.replace(/^#/, "");
      return url.pathname + (SECTIONS.has(fragment) ? "#" + fragment : "");
    }
    const draftId = url.searchParams.get("draft");
    if (url.pathname === "/create" && draftId && CAMPAIGN_ID.test(draftId)) {
      return "/create?draft=" + encodeURIComponent(draftId);
    }
    return null;
  } catch { return null; }
}

export function campaignActionSection(action = "") {
  const text = String(action || "").toLowerCase();
  // Specific edit requests take precedence over the generic verb "update".
  if (/\b(ai profile|ai instruction)\b/.test(text)) return "campaign-instructions";
  if (/\b(campaign coach|ai coach)\b/.test(text)) return "campaign-ai";
  if (/\b(story|summary|cover|image|photo|headline|goal|campaign details|campaign description)\b/.test(text))
    return "campaign-settings";
  if (/\b(update|progress|milestone|announcement|news|supporter update)\b/.test(text)) return "campaign-updates";
  if (/\b(outreach|engagement|audience|donor discovery|contact supporters)\b/.test(text)) return "campaign-outreach";
  if (/\b(share link|embed|qr code|copy link|share campaign)\b/.test(text)) return "campaign-share";
  if (/\b(post|posting|publish to|social|cross.platform|distribution|broadcast|share|promot)\b/.test(text))
    return "campaign-distribution";
  if (/\b(donation|funding|fundraiser|payment|raise funds|donor count)\b/.test(text)) return "campaign-funding";
  return "campaign-health";
}

export function campaignActionDestination({ campaignId, action, title, description, status } = {}) {
  const id = String(campaignId || "").trim();
  const label = [action, title].filter(Boolean).join(" ");
  const text = [label, description].filter(Boolean).join(" ");
  if (id && CAMPAIGN_ID.test(id)) {
    if (status === "draft") return "/create?draft=" + encodeURIComponent(id);
    if (/\b(reply|respond|message|comment|question|inbox)\b/i.test(label)) {
      return "/inbox?campaign=" + encodeURIComponent(id);
    }
    // The requested action has precedence over incidental words in the
    // explanatory text. "Improve story" should not open outreach merely
    // because its description happens to mention outreach.
    const primary = campaignActionSection(label);
    const section = primary === "campaign-health"
      ? campaignActionSection(description) : primary;
    return "/campaign/" + encodeURIComponent(id) + "#" + section;
  }
  if (/\b(create|start|draft|launch)\b.*\bcampaign\b/i.test(text)) return "/create";
  if (/\b(connect|reconnect)\b.*\b(platform|account)\b/i.test(text)) return "/connections";
  if (/\b(subscription|upgrade plan)\b/i.test(text)) return "/subscriptions";
  if (/\b(message|reply|inbox)\b/i.test(text)) return "/inbox";
  return null;
}

export function contextualNotificationDestination(notification) {
  if (!notification || typeof notification !== "object") return null;
  const direct = safeActionRoute(notification.link);
  const match = direct && /^\/campaign\/([^/#?]+)/.exec(direct);
  if (match) {
    const campaignId = match[1];
    if (direct.includes("#")) return direct;
    return campaignActionDestination({
      campaignId,
      action: notification.action,
      title: notification.title,
      description: notification.body,
    });
  }
  if (direct) return direct;
  return campaignActionDestination({
    campaignId: notification.campaign_id,
    action: notification.action,
    title: notification.title,
    description: notification.body,
  });
}
