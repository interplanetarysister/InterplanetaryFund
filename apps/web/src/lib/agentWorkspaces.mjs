// Presentation and available platform tools; not proof of specialist execution.
// Each service ID matches the canonical database registry, never a frontend alias.
export const AGENT_WORKSPACES = Object.freeze([
  { identity:"story", service:"story_agent", tool:"Private AI campaign writing", path:"/agents", liveTool:true, evidence:"Provider-backed Story draft recorded in preview; hosted production member acceptance remains unverified." },
  { identity:"polaris", service:"strategy_agent", tool:"Free campaign readiness review", path:"/strategy", liveTool:true, evidence:"Owner-only Strategy checklist is available without inference; direct Strategy AI chat and provider-backed execution remain unverified." },
  { identity:"forge", service:"growth_agent", tool:"Owner campaign engagement metrics", path:"/engagement", liveTool:true, evidence:"Aggregate engagement reporting deployed; independent Growth AI execution is not verified." },
  { identity:"echo", service:"communications_agent", tool:"Free campaign message drafts", path:"/communications", liveTool:true, evidence:"Manual owner-only communication drafting is available; external automatic sending remains disabled and specialist AI chat is unverified." },
  { identity:"link", service:"managed_connection_agent", tool:"Manage authorized connections", path:"/connections", liveTool:false, evidence:"Connection workspace exists; automated provider publishing must pass individual OAuth and consent verification." },
  { identity:"discover", service:"connection_discovery_agent", tool:"Review connection availability", path:"/connections", liveTool:false, evidence:"Source provider inventory exists; live independent Discovery Agent execution is unverified." },
  { identity:"pulse", service:"outreach_agent", tool:"Search grants and volunteer opportunities", path:"/institutions", liveTool:false, evidence:"Opportunity discovery exists; unattended outreach and grant submission are not authorized." },
  { identity:"orbit", service:"finance_agent", tool:"Owner finance and verified receipts", path:"/finances", liveTool:true, evidence:"Owner finance reports deployed; agent-initiated financial action is not enabled." },
  { identity:"nexus", service:"chief_of_staff", tool:"Campaign dashboard and coordination", path:"/dashboard", liveTool:false, evidence:"Member dashboard exists; autonomous cross-agent orchestration is unverified." },
]);
