/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import ErrorBoundary from "../components/ErrorBoundary";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { AdminUser } from "../types";
import PermissionsManager from "../components/PermissionsManager";
import FraudControl from "../components/FraudControl";
import AgentActivity from "../components/AgentActivity";
import MissionBriefs from "../components/MissionBriefs";
import { useMutation } from "convex/react";
import UserManagement from "../components/UserManagement";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";

type AdminTab =
  | "overview"
  | "campaigns"
  | "agents"
  | "treasury"
  | "platforms"
  | "reports"
  | "interactions"
  | "permissions"
  | "activity"
  | "briefs";

// Each tab maps to a permission scope (or "all" for super admin)
const TAB_PERMISSIONS: Record<AdminTab, string> = {
  overview: "all",
  campaigns: "campaigns",
  agents: "all",       // agent management is super-admin only
  treasury: "finance",
  platforms: "platforms",
  reports: "reports",
  interactions: "reports",
  permissions: "users",  // only super admin
  control: "finance",  // super admin only — fraud prevention
  activity: "all",
  briefs: "all",
  users: "campaigns",  // admin with campaigns permission can view users
};

const ALL_TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "agents", label: "Agents" },
  { id: "treasury", label: "Treasury" },
  { id: "platforms", label: "Platforms" },
  { id: "reports", label: "Reports" },
  { id: "interactions", label: "Activity" },
  { id: "users", label: "Users" },
  { id: "permissions", label: "Access" },
  { id: "control", label: "Control" },
  { id: "activity", label: "Agent Log" },
  { id: "briefs", label: "Briefs" },
];

const ROLE_COLORS: Record<string, string> = {
  fundraising: "badge-cyan",
  story: "badge-pink",
  donor_relations: "badge-green",
  protocol: "badge-red",
  analytics: "badge-purple",
  treasury: "badge-amber",
  platform_sync: "badge-green",
};

export default function Admin({ adminUser }: { adminUser: { name: string; role: string; permissions: string[] } | null }) {
  const isSuperAdmin = adminUser?.role === "super_admin";
  const userPermissions = adminUser?.permissions || [];
  
  const hasPermission = (perm: string) => {
    if (isSuperAdmin) return true;
    if (perm === "all") return false;
    return userPermissions.includes(perm);
  };
  
  // Filter tabs based on permissions
  const TABS = ALL_TABS.filter(t => hasPermission(TAB_PERMISSIONS[t.id]));
  const [tab, setTab] = useState<AdminTab>("overview");

  // Shared queries
  const balances = useQuery(api.treasury.aggregateBalances, {});
  const agentsStats = useQuery(api.agents.getAgentStats, {});
  const agentsList = useQuery(api.agents.getAgents, {});
  const toggleAutomation = useMutation(api.agentAutomation.toggleAgentAutomation);
  const campaigns = useQuery(api.campaigns.getAllCampaigns, {});
  const latestReport = useQuery(api.protocol.getLatestReport, {});
  const reports = useQuery(api.protocol.getReports, { limit: 10 });
  const audit = useQuery(api.protocol.enforceProtocol, {});
  const compliance = useQuery(api.protocolAutoFix.getComplianceStatus, {});
  const migrateCampaigns = useMutation(api.protocolAutoFix.migrateAllCampaigns);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const externalBalances = useQuery(api.campaigns.getAllExternalBalances, {});
  const interactionStats = useQuery(api.interactions.getAllInteractionStats, {});

  // Treasury form state
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("cashapp");
  const [payoutDest, setPayoutDest] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const handleMigration = async () => {
    setMigrating(true);
    try {
      const result = await migrateCampaigns({});
      setMigrationResult(`Fixed ${result.campaignsFixed} of ${result.totalCampaigns} campaigns`);
    } catch (e: any) {
      setMigrationResult(`Error: ${e.message}`);
    }
    setMigrating(false);
  };
  const [depositPlatform, setDepositPlatform] = useState("GoFundMe");
  const [treasuryUser, setTreasuryUser] = useState("user1");
  const [showResult, setShowResult] = useState<any>(null);

  // Platforms form state
  const [platformName, setPlatformName] = useState("GoFundMe");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [connectionType, setConnectionType] = useState("manual");

  // Mutations
  const requestPayout = useMutation(api.treasury.requestPayout);
  const createDeposit = useMutation(api.treasury.createDeposit);
  const connectPlatform = useMutation(api.campaigns.connectExternalPlatform);
  const feeCalc = useQuery(api.treasury.calculatePayout, {
    amount: parseFloat(payoutAmount) || 0,
  });

  if (!balances || !agentsStats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handlePayout = async () => {
    try {
      const result = await requestPayout({
        userId: adminUser,
        payoutMethod,
        payoutDestination: payoutDest,
      });
      setShowResult(result);
    } catch (e: any) {
      setShowResult({ error: e.message });
    }
  };

  const handleDeposit = async () => {
    try {
      const result = await createDeposit({
        userId: adminUser,
        amount: parseFloat(depositAmount) || 0,
        sourcePlatform: depositPlatform,
      });
      setShowResult(result);
    } catch (e: any) {
      setShowResult({ error: e.message });
    }
  };

  const handleConnectPlatform = async () => {
    try {
      await connectPlatform({
        userId: adminUser,
        platformName,
        campaignUrl,
        campaignTitle,
        connectionType,
      });
      setCampaignUrl("");
      setCampaignTitle("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Admin badge */}
      <div className="flex items-center gap-2 text-xs text-ifmuted">
        <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent font-medium text-[10px]">
          ADMIN MODE
        </span>
        <span>Tap "Exit Admin" to return</span>
      </div>

      {/* Tab selector */}
      {/* Admin identity badge */}
      <div className="flex items-center gap-2 text-xs text-ifmuted">
        <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent font-medium text-[10px]">
          {isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
        </span>
        <span>{adminUser?.name || "Admin"} — Tap "Exit" to return</span>
      </div>

      {/* Tab selector — only shows permitted tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? "bg-ifaccent text-white"
                : "bg-ifcard text-ifmuted border border-ifborder"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW ============ */}
      <ErrorBoundary>
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="text-xs text-ifmuted font-medium">Total Raised</p>
              <p className="text-2xl font-bold text-ifcyan mt-1">
                ${(balances?.grandTotal?.raised || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-ifmuted mt-0.5">All platforms</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-ifmuted font-medium">Held in Treasury</p>
              <p className="text-2xl font-bold text-ifaccent mt-1">
                ${balances.holdingAccounts.totalHeld.toLocaleString()}
              </p>
              <p className="text-[10px] text-ifmuted mt-0.5">Before fees</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-ifmuted font-medium">Total Donors</p>
              <p className="text-2xl font-bold text-ifgreen mt-1">
                {(balances?.grandTotal?.donors || 0).toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-ifmuted font-medium">Paid Out</p>
              <p className="text-2xl font-bold text-ifamber mt-1">
                ${balances.holdingAccounts.totalPaidOut.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Campaigns</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-iftext">{balances.localCampaigns.count}</p>
                <p className="text-[10px] text-ifmuted">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ifgreen">{balances.localCampaigns.active}</p>
                <p className="text-[10px] text-ifmuted">Active</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ifamber">{balances.localCampaigns.draft}</p>
                <p className="text-[10px] text-ifmuted">Draft</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ifborder">
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Local Raised</span>
                <span className="text-iftext font-medium">${balances.localCampaigns.totalRaised.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-ifmuted">External Raised</span>
                <span className="text-iftext font-medium">${balances.externalPlatforms.totalRaised.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-ifmuted">Total Goal</span>
                <span className="text-iftext font-medium">${balances.localCampaigns.totalGoal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Agent Roster</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-ifaccent">{agentsStats.total}</p>
                <p className="text-[10px] text-ifmuted">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ifgreen">{agentsStats.active}</p>
                <p className="text-[10px] text-ifmuted">Active</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ifcyan">{agentsStats.averageTrust?.toFixed(0) ?? 0}</p>
                <p className="text-[10px] text-ifmuted">Avg Trust</p>
              </div>
            </div>
          </div>

          {latestReport && (
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">Latest Audit</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-bold text-ifgreen">{latestReport.compliantCampaigns}</p>
                  <p className="text-[10px] text-ifmuted">Compliant</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-ifred">{latestReport.nonCompliantCampaigns}</p>
                  <p className="text-[10px] text-ifmuted">Non-Compliant</p>
                </div>
              </div>
              {latestReport.criticalViolations?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ifborder">
                  <p className="text-xs text-ifred font-medium mb-1">
                    ⚠ {latestReport.criticalViolations.length} Critical Violations
                  </p>
                  {latestReport.criticalViolations.map((v: any, i: number) => (
                    <p key={i} className="text-[10px] text-ifmuted">
                      {v.standard}: {v.issue}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ CAMPAIGNS ============ */}
      {tab === "campaigns" && (
        <div className="space-y-3">
          {campaigns?.map((c: any) => {
            const progress = c.goalAmount > 0 ? Math.round((c.raisedAmount / c.goalAmount) * 100) : 0;
            return (
              <div key={c._id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-iftext">{c.title}</h4>
                  <span className={`badge ${c.status === "active" ? "badge-green" : "badge-amber"}`}>
                    {c.status}
                  </span>
                </div>
                {c.summary && (
                  <p className="text-[10px] text-ifmuted line-clamp-2">{c.summary}</p>
                )}
                <div className="w-full h-2 bg-ifborder rounded-full overflow-hidden">
                  <div className="h-full bg-ifaccent rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-ifmuted">
                  <span>${c.raisedAmount.toLocaleString()} / ${c.goalAmount.toLocaleString()}</span>
                  <span>{c.donorCount} donors</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className={`badge ${c.outreachEnabled ? "badge-green" : "badge-red"}`}>
                    P1 {c.outreachEnabled ? "✓" : "✗"}
                  </span>
                  <span className={`badge ${c.aiTone ? "badge-green" : "badge-muted"}`}>
                    P2 {c.aiTone ? "✓" : "✗"}
                  </span>
                  <span className={`badge ${c.storyPresent ? "badge-green" : "badge-muted"}`}>
                    P3 {c.storyPresent ? "✓" : "✗"}
                  </span>
                  <span className={`badge ${c.paymentActive ? "badge-green" : "badge-red"}`}>
                    P4 {c.paymentActive ? "✓" : "✗"}
                  </span>
                  <span className={`badge ${c.coverImagePresent ? "badge-green" : "badge-muted"}`}>
                    P5 {c.coverImagePresent ? "✓" : "✗"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.aiPriority && (
                    <span className="badge badge-purple">{c.aiPriority}</span>
                  )}
                  {c.category && (
                    <span className="badge badge-cyan">{c.category}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ AGENTS ============ */}
      {tab === "agents" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="stat-card">
              <p className="text-xl font-bold text-ifaccent">{agentsStats.total}</p>
              <p className="text-[10px] text-ifmuted">Total</p>
            </div>
            <div className="stat-card">
              <p className="text-xl font-bold text-ifgreen">{agentsStats.active}</p>
              <p className="text-[10px] text-ifmuted">Active</p>
            </div>
            <div className="stat-card">
              <p className="text-xl font-bold text-ifcyan">{agentsStats.averageTrust?.toFixed(0) ?? 0}</p>
              <p className="text-[10px] text-ifmuted">Avg Trust</p>
            </div>
          </div>
          {agentsList?.map((a: any) => (
            <div key={a._id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: a.accentColor || "#8b5cf6" }}
                  >
                    {a.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-iftext">{a.name}</h3>
                    <p className="text-[10px] text-ifmuted">{a.specialization}</p>
                  </div>
                </div>
                <span className={`badge ${ROLE_COLORS[a.role] || "badge-muted"}`}>
                  {a.status === "active" ? "● Active" : "○ Inactive"}
                </span>
              </div>

              <p className="text-xs text-ifmuted leading-relaxed">{a.purpose}</p>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-ifdark rounded-lg py-2">
                  <p className="text-sm font-bold text-ifaccent">{a.trustScore}</p>
                  <p className="text-[9px] text-ifmuted">Trust</p>
                </div>
                <div className="bg-ifdark rounded-lg py-2">
                  <p className="text-sm font-bold text-ifgreen">{a.reliabilityScore}</p>
                  <p className="text-[9px] text-ifmuted">Reliable</p>
                </div>
                <div className="bg-ifdark rounded-lg py-2">
                  <p className="text-sm font-bold text-ifcyan">{a.efficiencyScore}</p>
                  <p className="text-[9px] text-ifmuted">Efficient</p>
                </div>
                <div className="bg-ifdark rounded-lg py-2">
                  <p className="text-sm font-bold text-ifpink">{a.collaborationScore}</p>
                  <p className="text-[9px] text-ifmuted">Collab</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs">
                <span className="text-ifgreen">✓ {a.successfulOutcomes}</span>
                <span className="text-ifred">✗ {a.failedOutcomes}</span>
                <span className="text-ifmuted">{a.tasksCompleted} tasks</span>
              </div>

              {a.capabilities && a.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.capabilities.slice(0, 4).map((cap: string) => (
                    <span key={cap} className="badge badge-muted">{cap}</span>
                  ))}
                  {a.capabilities.length > 4 && (
                    <span className="badge badge-muted">+{a.capabilities.length - 4}</span>
                  )}
                </div>
              )}

              {a.workingMemory && a.workingMemory.length > 0 && (
                <div className="pt-2 border-t border-ifborder">
                  <p className="text-[10px] text-ifmuted font-medium mb-1">Working Memory</p>
                  {a.workingMemory.slice(-3).map((mem: string, i: number) => (
                    <p key={i} className="text-[10px] text-iftext bg-ifdark rounded px-2 py-1 mb-1">
                      {mem}
                    </p>
                  ))}
                </div>
              )}

              {a.longTermMemory && a.longTermMemory.length > 0 && (
                <div>
                  <p className="text-[10px] text-ifmuted font-medium mb-1">Long-Term Memory</p>
                  {a.longTermMemory.slice(-2).map((mem: string, i: number) => (
                    <p key={i} className="text-[10px] text-ifmuted bg-ifdark rounded px-2 py-1 mb-1">
                      {mem}
                    </p>
                  ))}
                </div>
              )}

              {/* Automation Toggle */}
              <div className="pt-2 border-t border-ifborder">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-ifmuted font-medium">Automation</p>
                    <p className="text-[10px] text-ifmuted">
                      Last run: {a.lastAutomationRun ? new Date(a.lastAutomationRun).toLocaleString() : "never"}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const enabled = a.automationEnabled ?? true;
                      await toggleAutomation({ agentName: a.name, enabled: !enabled });
                    }}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                      (a.automationEnabled ?? true)
                        ? "bg-ifgreen/20 text-ifgreen border border-ifgreen/30"
                        : "bg-ifborder text-ifmuted border border-ifborder"
                    }`}
                  >
                    {(a.automationEnabled ?? true) ? "● Auto ON" : "○ Auto OFF"}
                  </button>
                </div>
              </div>

              {a.managedCampaigns && a.managedCampaigns.length > 0 && (
                <div className="pt-2 border-t border-ifborder">
                  <p className="text-[10px] text-ifmuted font-medium mb-1">Managed Campaigns</p>
                  <div className="flex flex-wrap gap-1">
                    {a.managedCampaigns.map((mc: string, i: number) => (
                      <span key={i} className="badge badge-cyan">{mc}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ============ TREASURY ============ */}
      {tab === "treasury" && (
        <div className="space-y-3">
          {/* Holding Account Summary */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Holding Account</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-ifdark rounded-xl p-3">
                <p className="text-xs text-ifmuted">Available Balance</p>
                <p className="text-2xl font-bold text-ifgreen mt-1">
                  ${balances.holdingAccounts.totalHeld.toLocaleString()}
                </p>
                <p className="text-[10px] text-ifmuted mt-0.5">Before fees</p>
              </div>
              <div className="bg-ifdark rounded-xl p-3">
                <p className="text-xs text-ifmuted">Net (after fees)</p>
                <p className="text-2xl font-bold text-ifaccent mt-1">
                  ${((balances.holdingAccounts.totalHeld || 0) * 0.921).toFixed(2)}
                </p>
                <p className="text-[10px] text-ifmuted mt-0.5">5% + 2.9% + $0.30</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ifborder space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Total Paid Out</span>
                <span className="text-ifamber">${balances.holdingAccounts.totalPaidOut.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Total Fees Collected</span>
                <span className="text-ifcyan">${balances.holdingAccounts.totalFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Pending Payouts</span>
                <span className="text-iftext">${balances.holdingAccounts.pendingPayouts?.toLocaleString() ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Fee Calculator */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Fee Calculator</h3>
            <input
              type="number"
              placeholder="Enter amount to calculate"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="input"
            />
            {payoutAmount && feeCalc && parseFloat(payoutAmount) > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-ifmuted">Available Balance</span>
                  <span className="text-ifgreen font-semibold">{feeCalc.display.availableBalance}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ifmuted">Platform Fee (5%)</span>
                  <span className="text-ifred">${feeCalc.feeBreakdown.platformFee.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ifmuted">Processing (2.9% + $0.30)</span>
                  <span className="text-ifred">${feeCalc.feeBreakdown.processingFee.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-ifborder">
                  <span className="text-iftext font-semibold">You Receive</span>
                  <span className="text-ifaccent font-bold text-lg">{feeCalc.display.youReceive}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-ifmuted">Our Fee</span>
                  <span className="text-ifamber">{feeCalc.display.ourFee}</span>
                </div>
              </div>
            )}
          </div>

          {/* Deposit / Migrate Funds */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Deposit Funds (Migrate)</h3>
            <input
              type="text"
              placeholder="User ID"
              value={treasuryUser}
              onChange={(e) => setTreasuryUser(e.target.value)}
              className="input mb-2"
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="input mb-2"
            />
            <select
              value={depositPlatform}
              onChange={(e) => setDepositPlatform(e.target.value)}
              className="input mb-3"
            >
              <option value="GoFundMe">GoFundMe</option>
              <option value="Kickstarter">Kickstarter</option>
              <option value="Facebook">Facebook Fundraisers</option>
              <option value="Manual">Manual Entry</option>
            </select>
            <button
              onClick={handleDeposit}
              disabled={!depositAmount || !adminUser}
              className="btn-secondary"
            >
              Deposit to Holding Account
            </button>
          </div>

          {/* Request Payout */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Request Payout (Cash Out)</h3>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                onClick={() => setPayoutMethod("cashapp")}
                className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "cashapp" ? "bg-ifgreen text-white" : "bg-ifdark text-ifmuted"}`}
              >
                CashApp
              </button>
              <button
                onClick={() => setPayoutMethod("bitcoin")}
                className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "bitcoin" ? "bg-ifamber text-white" : "bg-ifdark text-ifmuted"}`}
              >
                Bitcoin
              </button>
              <button
                onClick={() => setPayoutMethod("paypal")}
                className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "paypal" ? "bg-ifcyan text-white" : "bg-ifdark text-ifmuted"}`}
              >
                PayPal
              </button>
            </div>
            <input
              type="text"
              placeholder={payoutMethod === "cashapp" ? "$Cashtag" : payoutMethod === "bitcoin" ? "Wallet Address" : "PayPal Email"}
              value={payoutDest}
              onChange={(e) => setPayoutDest(e.target.value)}
              className="input mb-3"
            />
            <button
              onClick={handlePayout}
              disabled={!payoutDest || !adminUser}
              className="btn-primary"
            >
              Request Payout
            </button>
          </div>

          {/* Result */}
          {showResult && (
            <div className="card">
              {showResult.error ? (
                <p className="text-sm text-ifred">Error: {showResult.error}</p>
              ) : showResult.summary ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ifgreen">Payout Requested ✓</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-ifmuted">Available</span>
                    <span className="text-iftext">{showResult.summary.availableBalance}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ifmuted">You Receive</span>
                    <span className="text-ifaccent font-bold">{showResult.summary.youReceive}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ifmuted">Our Fee</span>
                    <span className="text-ifamber">{showResult.summary.ourFee}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ifmuted">Method</span>
                    <span className="text-iftext">{showResult.summary.method} → {showResult.summary.destination}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ifgreen">Deposited ✓</p>
                  <p className="text-xs text-ifmuted">
                    ${showResult.depositedAmount?.toLocaleString() ?? 0} deposited
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ PLATFORMS ============ */}
      {tab === "platforms" && (
        <div className="space-y-3">
          {externalBalances && externalBalances.total > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">Connected Platforms</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ifdark rounded-xl p-3">
                  <p className="text-xs text-ifmuted">External Raised</p>
                  <p className="text-xl font-bold text-ifcyan mt-1">
                    ${(externalBalances?.grandTotalRaised || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-ifdark rounded-xl p-3">
                  <p className="text-xs text-ifmuted">External Donors</p>
                  <p className="text-xl font-bold text-ifgreen mt-1">
                    {(externalBalances?.grandTotalDonors || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              {externalBalances.byPlatform && Object.keys(externalBalances.byPlatform).length > 0 && (
                <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
                  {Object.entries(externalBalances.byPlatform).map(([platform, data]: [string, any]) => (
                    <div key={platform} className="bg-ifdark rounded-xl p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-iftext">{platform}</span>
                        <span className="badge badge-cyan">{data.count} campaigns</span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-ifmuted">Raised: ${data.totalRaised.toLocaleString()}</span>
                        <span className="text-ifmuted">{data.totalDonors} donors</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Connect External Campaign</h3>
            <select
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="input mb-2"
            >
              <option value="GoFundMe">GoFundMe</option>
              <option value="Kickstarter">Kickstarter</option>
              <option value="Facebook">Facebook Fundraisers</option>
              <option value="Instagram">Instagram</option>
              <option value="Custom">Custom / Other</option>
            </select>
            <input
              type="text"
              placeholder="Campaign URL"
              value={campaignUrl}
              onChange={(e) => setCampaignUrl(e.target.value)}
              className="input mb-2"
            />
            <input
              type="text"
              placeholder="Campaign Title"
              value={campaignTitle}
              onChange={(e) => setCampaignTitle(e.target.value)}
              className="input mb-2"
            />
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value)}
              className="input mb-3"
            >
              <option value="manual">Manual (enter data yourself)</option>
              <option value="oauth">OAuth (connect account)</option>
              <option value="api_key">API Key (platform API)</option>
            </select>
            <button
              onClick={handleConnectPlatform}
              disabled={!campaignUrl || !campaignTitle}
              className="btn-primary"
            >
              Connect Platform
            </button>
          </div>

          <div className="card bg-ifdark border-ifborder">
            <p className="text-xs text-ifmuted leading-relaxed">
              <span className="text-ifcyan font-medium">Phase 1:</span> Manual entry — enter campaign data from external platforms.
              {"\n\n"}
              <span className="text-ifcyan font-medium">Phase 2:</span> API sync — automatic polling for supported platforms.
              {"\n\n"}
              <span className="text-ifcyan font-medium">Phase 3:</span> Webhooks — real-time updates when donations arrive.
            </p>
          </div>
        </div>
      )}

      {/* ============ REPORTS ============ */}
      {tab === "reports" && (
        <div className="space-y-3">
          {/* Protocol Auto-Fix Dashboard */}
          {compliance && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-iftext">Protocol Compliance</h3>
                <button
                  onClick={handleMigration}
                  disabled={migrating}
                  className="px-3 py-1.5 rounded-lg bg-ifaccent text-ifdark text-xs font-bold disabled:opacity-50"
                >
                  {migrating ? "Fixing..." : "Auto-Fix All"}
                </button>
              </div>
              {migrationResult && (
                <p className="text-[11px] text-ifcyan mb-2">{migrationResult}</p>
              )}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-ifgreen">{compliance.compliant}</p>
                  <p className="text-[10px] text-ifmuted">Compliant</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-ifred">{compliance.nonCompliant}</p>
                  <p className="text-[10px] text-ifmuted">Non-Compliant</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-ifaccent">{compliance.total}</p>
                  <p className="text-[10px] text-ifmuted">Total</p>
                </div>
              </div>
              {compliance.results && compliance.results.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
                  {compliance.results.map((r: any, i: number) => (
                    <div key={i} className="bg-ifdark rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-iftext">{r.title}</span>
                        <span className={`text-[10px] font-bold ${r.compliant ? "text-ifgreen" : "text-ifred"}`}>
                          {r.compliant ? "✓ COMPLIANT" : `${r.violations.join(", ")} pending`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live Audit */}
          {audit && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-iftext">Live Audit</h3>
                <span className="text-[10px] text-ifmuted">
                  {new Date(audit.auditDate).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-ifgreen">{audit.compliant}</p>
                  <p className="text-[10px] text-ifmuted">Compliant</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-ifred">{audit.nonCompliant}</p>
                  <p className="text-[10px] text-ifmuted">Non-Compliant</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-ifaccent">{audit.totalCampaigns}</p>
                  <p className="text-[10px] text-ifmuted">Total</p>
                </div>
              </div>

              {audit.revenueSummary && (
                <div className="mt-3 pt-3 border-t border-ifborder">
                  <div className="flex justify-between text-xs">
                    <span className="text-ifmuted">Total Raised</span>
                    <span className="text-ifgreen font-medium">${audit.revenueSummary.totalRaised.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-ifmuted">Total Goal</span>
                    <span className="text-iftext">${audit.revenueSummary.totalGoal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-ifmuted">Funding Gap</span>
                    <span className="text-ifred">${audit.revenueSummary.fundingGap.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-ifmuted">Total Donors</span>
                    <span className="text-ifcyan">{audit.revenueSummary.totalDonors}</span>
                  </div>
                </div>
              )}

              {audit.criticalViolations && audit.criticalViolations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ifborder">
                  <p className="text-xs text-ifred font-medium mb-2">
                    ⚠ {audit.criticalViolations.length} Critical Violations
                  </p>
                  {audit.criticalViolations.map((v: any, i: number) => (
                    <div key={i} className="bg-ifdark rounded-lg px-2 py-1.5 mb-1">
                      <p className="text-[10px] text-ifred">{v.standard}: {v.issue}</p>
                    </div>
                  ))}
                </div>
              )}

              {audit.autoFixesNeeded && audit.autoFixesNeeded.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ifborder">
                  <p className="text-xs text-ifamber font-medium mb-2">
                    🔧 {audit.autoFixesNeeded.length} Auto-Fixes Available
                  </p>
                  {audit.autoFixesNeeded.map((fix: any, i: number) => (
                    <div key={i} className="bg-ifdark rounded-lg px-2 py-1.5 mb-1">
                      <p className="text-[10px] text-ifamber">
                        {fix.standard}: {fix.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-Campaign Results */}
          {audit && audit.results && audit.results.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">Campaign Details</h3>
              {audit.results.map((r: any, i: number) => (
                <div key={i} className="bg-ifdark rounded-xl p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-iftext">{r.title}</span>
                    <span className={`badge ${r.complianceScore >= 5 ? "badge-green" : r.complianceScore >= 3 ? "badge-amber" : "badge-red"}`}>
                      {r.complianceScore}/6
                    </span>
                  </div>
                  {r.violations && r.violations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {r.violations.map((v: any, j: number) => (
                        <p key={j} className="text-[10px] text-ifred">
                          {v.standard}: {v.issue || v.missing?.join(", ") || "violation"}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Historical Reports */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">Audit History</h3>
            {(!reports || reports.length === 0) && (
              <p className="text-xs text-ifmuted">No reports yet. Reports are created by the weekly training job (Saturday 2am PT).</p>
            )}
            {reports?.map((r: any) => (
              <div key={r._id} className="bg-ifdark rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-iftext">{r.reportType}</span>
                  <span className="text-[10px] text-ifmuted">
                    {new Date(r.auditDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px]">
                  <span className="text-ifgreen">{r.compliantCampaigns} compliant</span>
                  <span className="text-ifred">{r.nonCompliantCampaigns} non-compliant</span>
                  <span className="text-ifcyan">${r.totalRaised.toLocaleString()} raised</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ INTERACTIONS ============ */}
      {tab === "interactions" && (
        <div className="space-y-3">
          {interactionStats && (
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">Campaign Activity</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ifdark rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-ifaccent">
                    {interactionStats.totalViews ?? 0}
                  </p>
                  <p className="text-[10px] text-ifmuted">Total Views</p>
                </div>
                <div className="bg-ifdark rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-ifcyan">
                    {interactionStats.totalClicks ?? 0}
                  </p>
                  <p className="text-[10px] text-ifmuted">Total Clicks</p>
                </div>
                <div className="bg-ifdark rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-ifgreen">
                    {interactionStats.totalDonations ?? 0}
                  </p>
                  <p className="text-[10px] text-ifmuted">Donations</p>
                </div>
                <div className="bg-ifdark rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-ifamber">
                    {interactionStats.totalShares ?? 0}
                  </p>
                  <p className="text-[10px] text-ifmuted">Shares</p>
                </div>
              </div>
            </div>
          )}
          {interactionStats?.campaigns && interactionStats.campaigns.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">Per-Campaign</h3>
              {interactionStats.campaigns.map((c: any, i: number) => (
                <div key={i} className="bg-ifdark rounded-xl p-3 mb-2">
                  <p className="text-sm text-iftext">{c.campaignTitle}</p>
                  <div className="flex gap-3 mt-1 text-[10px]">
                    <span className="text-ifaccent">{c.views ?? 0} views</span>
                    <span className="text-ifcyan">{c.clicks ?? 0} clicks</span>
                    <span className="text-ifgreen">{c.donations ?? 0} donations</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ============ USER MANAGEMENT ============ */}
      {tab === "users" && (
        <UserManagement />
      )}

      {/* ============ FRAUD CONTROL ============ */}
      {tab === "control" && isSuperAdmin && (
        <FraudControl />
      )}
      {tab === "control" && !isSuperAdmin && (
        <div className="card text-center py-8">
          <p className="text-sm text-ifmuted">Access denied. Super admin only.</p>
        </div>
      )}

      {/* ============ PERMISSIONS / ACCESS CONTROL ============ */}
      {tab === "permissions" && isSuperAdmin && (
        <PermissionsManager adminPin={adminUser?.name || ""} />
      )}
      {tab === "permissions" && !isSuperAdmin && (
        <div className="card text-center py-8">
          <p className="text-sm text-ifmuted">Access denied. Super admin only.</p>
        </div>
      )}

      </ErrorBoundary>
      {/* Credit-free badge */}
      <div className="text-center py-2">
        <p className="text-[10px] text-ifmuted">
          ⚡ Credit-free · Convex backend · Zero Base44 credits
        </p>
      </div>
    </div>
  );
}
