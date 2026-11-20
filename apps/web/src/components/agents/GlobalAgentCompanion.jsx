import { useEffect, useState } from "react";
import { Bot, Compass } from "lucide-react";
import AgentSidePanel from "@/components/agents/AgentSidePanel";
import "@/styles/agent-companion.css";
import ReferralTrialBootstrap from "@/components/referrals/ReferralTrialBootstrap";

/**
 * One persistent companion for both public pages and member workspaces.
 * Chat stays mounted across client-side navigation, while every AI request
 * continues through the existing verified member/permission/billing checks.
 */
export default function GlobalAgentCompanion({ children }) {
  const [activeAgent, setActiveAgent] = useState(null);
  useEffect(() => {
    const openAgent = event => setActiveAgent(event.detail?.agent || "nexus");
    window.addEventListener("ifund-open-agent", openAgent);
    return () => window.removeEventListener("ifund-open-agent", openAgent);
  }, []);
  return <div className="ifund-global-companion-shell">
    <ReferralTrialBootstrap />
    <div className="ifund-global-companion-main">{children}</div>
    {activeAgent == null && <button type="button"
      className="ifund-global-agent-launcher"
      aria-label="Ask IFund for guidance or help navigating this page"
      onClick={() => setActiveAgent("nexus")}>
      <Bot size={21} aria-hidden="true" />
      <span>Ask IFund</span>
      <Compass size={15} aria-hidden="true" />
    </button>}
    <AgentSidePanel agent={activeAgent} onSelect={setActiveAgent} onClose={() => setActiveAgent(null)} />
  </div>;
}
