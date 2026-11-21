import { useEffect, useState } from "react";
import { Bot, Compass, LogIn, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import SiteTour from "@/components/onboarding/SiteTour";
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
  const { pathname } = useLocation();
  const { user } = useAuthSession();
  const isHome = pathname === "/";
  const signedIn = Boolean(user?.id && !user.is_anonymous);
  useEffect(() => {
    const openAgent = event => { if (window.location.pathname !== "/") setActiveAgent(event.detail?.agent || "nexus"); };
    window.addEventListener("ifund-open-agent", openAgent);
    return () => window.removeEventListener("ifund-open-agent", openAgent);
  }, []);
  useEffect(() => { if (isHome) setActiveAgent(null); }, [isHome]);
  return <div className="ifund-global-companion-shell">
    <ReferralTrialBootstrap />
    <div className="ifund-global-companion-main">{children}</div>
    <SiteTour />
    <Link to={signedIn ? "/profile" : "/login"} className={"ifund-global-account-launcher " + (isHome ? "is-home" : "")} aria-label={signedIn ? "Open my account profile" : "Log in to Interplanetary Fund"}>
      {signedIn ? <UserRound size={20} aria-hidden="true"/> : <LogIn size={20} aria-hidden="true"/>}
      <span>{signedIn ? "Account" : "Log in"}</span>
    </Link>
    {!isHome && activeAgent == null && <button type="button"
      className="ifund-global-agent-launcher"
      aria-label="Ask IFund for guidance or help navigating this page"
      onClick={() => setActiveAgent("nexus")}>
      <Bot size={21} aria-hidden="true" />
      <span>Ask IFund</span>
      <Compass size={15} aria-hidden="true" />
    </button>}
    {!isHome && <AgentSidePanel agent={activeAgent} onSelect={setActiveAgent} onClose={() => setActiveAgent(null)} />}
  </div>;
}
