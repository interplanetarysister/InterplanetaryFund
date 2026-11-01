import React, { useEffect, useState } from "react";
import AgentMonitor from "@/components/agents/AgentMonitor";
import { base44 } from "@/api/base44Client";
import { getFrontendIdentity } from "@/lib/adminBootstrap";
import { Sparkles, TrendingUp, MessageSquare, PenLine, Wallet, Megaphone, Crown, Compass, Link2 } from "lucide-react";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";
import { Link } from "react-router-dom";

// Always-on AI agent team. The Chief of Staff coordinates; each specialist
// handles one domain. Switching agents starts a fresh conversation.
const AGENTS = [
  { name: "chief_of_staff", label: "Chief of Staff", icon: Crown, greeting: "I'm your Chief of Staff — always on. I coordinate your full AI team and can pull up any campaign's status, finances, and outreach. What would you like to work on?" },
  { name: "strategy_agent", label: "Strategy", icon: Sparkles, greeting: "I'm your Strategy Agent. Tell me which campaign you're focused on and I'll help you decide where to push for the greatest impact." },
  { name: "growth_agent", label: "Growth", icon: TrendingUp, greeting: "I'm your Growth Agent. I analyze donations and your connected platforms to find new supporter opportunities." },
  { name: "communications_agent", label: "Communications", icon: MessageSquare, greeting: "I'm your Communications Agent. I'll draft updates and thank-you messages for your supporters — you approve everything before it sends." },
  { name: "story_agent", label: "Story", icon: PenLine, greeting: "I'm your Story Agent. Share your campaign and I'll help you tell its story authentically." },
  { name: "finance_agent", label: "Finance", icon: Wallet, greeting: "I'm your Finance Agent. Ask me about raised amounts, clearing funds, fees, or payouts for any of your campaigns." },
  { name: "outreach_agent", label: "Outreach", icon: Megaphone, greeting: "I'm your Outreach Agent. I'll surface open recommendations and the autonomous agent's activity for your opted-in campaigns." },
  { name: "connection_discovery_agent", label: "Discovery", icon: Compass, greeting: "I'm your Connection Discovery Agent. I research fundraising and social platforms, verify their capabilities, and record what Interplanetary Fund can do with each one. Ask me about any platform or request a discovery scan." },
  { name: "managed_connection_agent", label: "Managed Connections", icon: Link2, minLevel: 2, greeting: "Tell me which account you want to connect or fix. I'll give you the right IFund connection link and check what can be completed for you. You just sign in and approve any permissions requested by the provider." },
];

export default function Agents() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoadingUser(false));
  }, []);

  if (loadingUser) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-muted-foreground">Loading your AI team…</div>;
  if (!hasPlanLevel(user, 1)) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
    <h1 className="font-display text-3xl text-foreground">Your AI team</h1>
    <p className="text-muted-foreground">An agent monitor, updates, and personal campaign conversations are available with an eligible AI subscription.</p>
    <div className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-semibold text-foreground text-lg">Enable your AI team</h2>
      <p className="text-sm text-muted-foreground mt-2">You can still create campaigns and participate in the community with a free account.</p>
      <Link to="/subscriptions" className="inline-flex mt-4 min-h-11 items-center rounded-xl bg-blue-700 px-4 text-white text-sm font-semibold hover:bg-blue-800">Explore AI subscriptions</Link>
    </div>
  </div>;

  const visibleAgents = AGENTS.filter((agent) => !agent.minLevel || hasPlanLevel(user, agent.minLevel));
  const canUseAdminTools = getFrontendIdentity(user).superAdminOwner;
  return <AgentMonitor user={user} agents={visibleAgents} canUseAdminTools={canUseAdminTools} />;
}
