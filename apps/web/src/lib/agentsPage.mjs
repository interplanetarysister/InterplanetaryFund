// Sprint 6 (2026-11-25): pure helpers for the unified Agents page
// (40-page list, page 28 — Analysis & Recommendations). No DOM, no network,
// no fabricated results: tabs are a reorganisation of the existing pages,
// and every recommendation surface reads real owner-scoped data or says
// plainly that the capability is not yet verified.

import { validCampaignSelection } from "./agentFeatureRoutes.mjs";

// The single tabbed Agents page. "Overview" holds the 9-agent directory
// (the Team), Ask Mission Control, the editorial queue, the shared team
// history and the writing studio — the existing AgentsTeam content.
// Analytics, Strategy and Communications are the folded legacy routes;
// Recommendations surfaces real NEXUS triage plus the detailed checks that
// live in the Strategy and Analytics tabs. Messaging is NOT a tab here:
// it stays a dedicated route behind the floating sidebar (owner decision 2,
// 2026-11-25) and is linked from this page instead.
export const AGENTS_PAGE_TABS = Object.freeze([
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "strategy", label: "Strategy" },
  { id: "recommendations", label: "Recommendations" },
  { id: "communications", label: "Communications" },
]);

// Tab state lives in the URL (?tab=strategy) so Agents tabs are deep-linkable.
// Unknown or missing values fall back to the Overview.
export function tabFromParam(value) {
  const found = AGENTS_PAGE_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "overview";
}

// Tabs whose panels used to sit behind MemberAccess on their own routes.
// The Overview stays public (the agent directory is public); these panels
// show a sign-in card to signed-out visitors instead of mounting.
export const MEMBER_TABS = Object.freeze(["analytics", "strategy", "recommendations", "communications"]);

// Legacy routes folded into the Agents page (owner rule: preserve existing
// URLs through redirects). The redirect keeps any campaign query and the
// caller preserves the #hash separately — see LegacyAgentsRedirect in App.jsx.
export const LEGACY_TAB_REDIRECTS = Object.freeze({
  "/analytics": "analytics",
  "/strategy": "strategy",
  "/communications": "communications",
});

// Build the ?tab= search string for a legacy redirect, preserving every
// other query parameter the caller arrived with (for example ?campaign=).
export function agentsRedirectSearch(tab, search = "") {
  const params = new URLSearchParams(typeof search === "string" ? search : "");
  params.set("tab", tabFromParam(tab));
  const text = params.toString();
  return text ? `?${text}` : "?tab=overview";
}

// The nine registered agent identities (DISCOVER is consolidated into LINK
// in the directory, but remains a valid conversation identity in Messaging).
export const AGENT_MESSAGING_IDS = Object.freeze([
  "nexus", "story", "orbit", "polaris", "forge", "echo", "pulse", "link", "discover",
]);

export function agentFromParam(value) {
  return typeof value === "string" && AGENT_MESSAGING_IDS.includes(value) ? value : null;
}

// Per-agent "continue conversation" link to the dedicated Messaging route.
// Carries the agent and, when it is a valid saved campaign, the campaign —
// so the conversation keeps its context. Invalid values are dropped, never
// invented: an unknown agent links to plain /messaging.
export function messagingHref(agent, campaignId = null) {
  const identity = agentFromParam(agent);
  const params = new URLSearchParams();
  if (identity) params.set("agent", identity);
  const campaign = validCampaignSelection(campaignId);
  if (campaign) params.set("campaign", campaign);
  const text = params.toString();
  return text ? `/messaging?${text}` : "/messaging";
}
