// Modular, pluggable configuration for the Interplanetary Fund onboarding experience.
// Add new capability modules, AI agents, or integrations here without redesigning the UI.

export const ENGINE_CAPABILITIES = [
  {
    id: "discovery",
    icon: "Compass",
    title: "Donor Discovery",
    description: "Identifies likely supporters across your connected platforms and recommends outreach.",
  },
  {
    id: "optimization",
    icon: "Sparkles",
    title: "Campaign Optimization",
    description: "Continuously reviews your campaigns and suggests improvements to story, goal, and timing.",
  },
  {
    id: "automation",
    icon: "Zap",
    title: "Fundraising Automation",
    description: "Helps share campaign updates to the places you connect.",
  },
  {
    id: "support",
    icon: "LifeBuoy",
    title: "Ongoing Support",
    description: "Mission Control monitors every campaign and alerts you to risks and opportunities.",
  },
];

// Capability modules describe what the application supports, not live provider
// health. Never hard-code a payment provider as "connected" here: connection/
// live status must come from verified runtime/provider capability data. The
// PayPal donation path is implemented in this app, but that fact alone is not
// permission to manufacture a connection state for the current environment.
export const CAPABILITY_MODULES = [
  {
    id: "external_fundraising",
    group: "Fundraising Platforms",
    items: [
      { id: "gofundme", label: "GoFundMe", status: "coming_soon" },
      { id: "kickstarter", label: "Kickstarter", status: "coming_soon" },
      { id: "indiegogo", label: "Indiegogo", status: "coming_soon" },
    ],
  },
  {
    id: "social",
    group: "Social Media & Channels",
    items: [
      { id: "facebook_pages", label: "Facebook Pages", status: "available" },
      { id: "instagram", label: "Instagram Business", status: "available" },
      { id: "tiktok", label: "TikTok", status: "available" },
      { id: "linkedin", label: "LinkedIn", status: "available" },
    ],
  },
  {
    id: "payments",
    group: "Payment Providers",
    items: [
      { id: "paypal", label: "PayPal", status: "verify_runtime" },
    ],
  },
];

export const FUNDRAISING_GOALS = [
  { id: "nonprofit", label: "Nonprofit / Charity" },
  { id: "personal", label: "Personal Cause" },
  { id: "community", label: "Community Project" },
  { id: "creative", label: "Creative Project" },
  { id: "business", label: "Social Enterprise" },
  { id: "other", label: "Other" },
];