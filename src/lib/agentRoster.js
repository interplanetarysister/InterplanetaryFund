// Source-matched specialist roster; these are definitions, not active executors.
// Migration must not claim conversations or automation work occurred without proof.
export const AGENT_ROSTER = [
  { id: "chief_of_staff", name: "Chief of Staff", description: "Coordinates campaign planning and connects specialists." },
  { id: "strategy_agent", name: "Strategy", description: "Helps choose truthful, achievable campaign next steps." },
  { id: "growth_agent", name: "Growth", description: "Reviews verified campaign discovery opportunities." },
  { id: "communications_agent", name: "Communications", description: "Prepares communications for member approval before any sending." },
  { id: "story_agent", name: "Story", description: "Assists creators with accurate and compelling campaign stories." },
  { id: "finance_agent", name: "Finance", description: "Reviews verified balances and fees only when ledger reconciliation is active." },
  { id: "outreach_agent", name: "Outreach", description: "Finds legitimate supporters and requires consent for external messages." },
  { id: "connection_discovery_agent", name: "Discovery", description: "Researches external platform capabilities and connection requirements." },
  { id: "managed_connection_agent", name: "Managed Connections", description: "Assists with authorized provider sign-in and permission verification." },
];
export const AGENT_RUNTIME = {
  active: false,
  verification: "not_verified",
  reason: "Independent agent runtime, private conversation storage, and authorization have not been verified.",
};
