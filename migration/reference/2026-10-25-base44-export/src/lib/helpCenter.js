// Help Center taxonomy and stable URLs shared by the web and installed app.
// Article bodies are fetched from Base44 at runtime, not bundled into the app.
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
  if (/connections|\/connect\b|\/admin\/integrations/.test(pathname)) return "Connections & Publishing";
  if (/withdrawals|ledger|giving/.test(pathname)) return "Money & Withdrawals";
  if (/campaign|\/create/.test(pathname)) return "Campaigns";
  if (/subscriptions/.test(pathname)) return "Subscriptions";
  if (/agents|\/mission/.test(pathname)) return "AI Assistance";
  if (/\/community|\/social|\/blogs/.test(pathname)) return "Community";
  if (/founding-members/.test(pathname)) return "Getting Started";
  if (/profile|\/devices/.test(pathname)) return "Account & Security";
  return "";
}
export function helpPathForLocation(pathname) {
  const topic = helpTopicForPath(pathname);
  return topic ? "/help?category=" + encodeURIComponent(topic) : "/help";
}
