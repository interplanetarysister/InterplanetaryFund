// Help Center taxonomy and stable URLs shared by the web and installed app.
// Article bodies are fetched from the platform backend at runtime, not bundled into the app.
export const HELP_CATEGORIES = Object.freeze([
  { name: "Getting Started", description: "Your first steps with IFund", icon: "Rocket" },
  { name: "Campaigns", description: "Create, manage and share a fundraiser", icon: "Megaphone" },
  { name: "Donations", description: "Giving, confirmations and receipts", icon: "HeartHandshake" },
  { name: "Connections & Publishing", description: "Link accounts and share your campaigns", icon: "Link2" },
  { name: "Money & Withdrawals", description: "Balances, transfers and payout questions", icon: "Wallet" },
  { name: "Account & Security", description: "Your profile, sign-in and privacy", icon: "ShieldCheck" },
  { name: "Subscriptions", description: "Plans, charges and billing", icon: "CreditCard" },
  { name: "AI Assistance", description: "How IFund assistants can help", icon: "Bot" },
  { name: "Community", description: "Groups, posts and conversations", icon: "Users" },
  { name: "Legal & Policies", description: "Terms, privacy, copyright and permissions", icon: "ShieldCheck" },
]);
export const HELP_CATEGORY_NAMES = HELP_CATEGORIES.map((item) => item.name);
const LEGACY_CATEGORY_MAP = Object.freeze({
  "Creating Campaigns": "Campaigns",
  "Donating": "Donations",
  "Payouts": "Money & Withdrawals",
});
export function displayHelpCategory(value) {
  return LEGACY_CATEGORY_MAP[value] || value || "Getting Started";
}
export function helpSlug(value) {
  return String(value || "").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}
export function helpArticlePath(slug) {
  return "/help/" + encodeURIComponent(slug);
}
export function helpTopicForPath(pathname = "") {
  const path = String(pathname || "").toLowerCase();
  if (/^\/(?:plans|subscriptions)(?:\/|$)/.test(path)) return "Subscriptions";
  if (/^\/(?:finances|withdrawals|ledger|giving)(?:\/|$)|^\/admin\/finance(?:\/|$)/.test(path)) return "Money & Withdrawals";
  if (/^\/(?:donors|engagement)(?:\/|$)/.test(path)) return "Donations";
  if (/^\/(?:connections|connect|communications|publication|my-blog)(?:\/|$)|^\/admin\/(?:integrations|studio)(?:\/|$)/.test(path)) return "Connections & Publishing";
  if (/^\/(?:campaign|campaigns|create|strategy|fundraising-partners)(?:\/|$)/.test(path)) return "Campaigns";
  if (/^\/(?:agents|ai-images|mission|analytics)(?:\/|$)/.test(path)) return "AI Assistance";
  if (/^\/(?:community|social|blogs|blog|news|shorts|publications)(?:\/|$)/.test(path)) return "Community";
  if (/^\/(?:profile|my-profile|devices|permissions|preferences|login|register|forgot-password|reset-password|delete-account|onboarding|auth)(?:\/|$)/.test(path)) return "Account & Security";
  if (/^\/(?:terms|privacy|health-privacy)(?:\/|$)/.test(path)) return "Legal & Policies";
  if (/^\/(?:founding-members|download|dashboard)(?:\/|$)/.test(path)) return "Getting Started";
  return "";
}
export function helpPathForLocation(pathname) {
  const topic = helpTopicForPath(pathname);
  return topic ? "/help?category=" + encodeURIComponent(topic) : "/help";
}
