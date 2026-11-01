// The platform's always-on in-app agent team. Used as a display fallback for
// the Ops Center when the legacy external mission backend returns no agents,
// so the dashboard is never blank.
export const IN_APP_AGENTS = [
  { name: "Chief of Staff", role: "coordinator", status: "active", trust_score: 98, description: "Coordinates the full AI team and surfaces any campaign's status, finances, and outreach." },
  { name: "Strategy", role: "strategy", status: "active", trust_score: 95, description: "Helps decide where to push for the greatest campaign impact." },
  { name: "Growth", role: "growth", status: "active", trust_score: 94, description: "Analyzes donations and connected platforms to find new supporter opportunities." },
  { name: "Communications", role: "communications", status: "active", trust_score: 93, description: "Drafts updates and thank-you messages for approval before sending." },
  { name: "Story", role: "story", status: "active", trust_score: 94, description: "Helps tell each campaign's story authentically." },
  { name: "Finance", role: "finance", status: "active", trust_score: 96, description: "Answers on raised amounts, clearing funds, fees, and payouts." },
  { name: "Outreach", role: "outreach", status: "active", trust_score: 92, description: "Surfaces recommendations and autonomous agent activity for opted-in campaigns." },
];