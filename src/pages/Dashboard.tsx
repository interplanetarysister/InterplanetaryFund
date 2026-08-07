/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Dashboard() {
  const balances = useQuery(api.treasury.aggregateBalances, {});
  const agents = useQuery(api.agents.getAgentStats, {});
  const latestReport = useQuery(api.protocol.getLatestReport, {});

  if (!balances || !agents) {
    return <div className="text-center text-ifmuted py-20">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">Live overview across all platforms</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <p className="text-xs text-ifmuted font-medium">Total Raised</p>
          <p className="text-2xl font-bold text-ifcyan mt-1">
            ${balances.grandTotal.raised.toLocaleString()}
          </p>
          <p className="text-[10px] text-ifmuted mt-1">All platforms combined</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-ifmuted font-medium">Held in Treasury</p>
          <p className="text-2xl font-bold text-ifaccent mt-1">
            ${balances.holdingAccounts.totalHeld.toLocaleString()}
          </p>
          <p className="text-[10px] text-ifmuted mt-1">Before fees</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-ifmuted font-medium">Total Donors</p>
          <p className="text-2xl font-bold text-ifgreen mt-1">
            {balances.grandTotal.donors.toLocaleString()}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-ifmuted font-medium">Paid Out</p>
          <p className="text-2xl font-bold text-ifamber mt-1">
            ${balances.holdingAccounts.totalPaidOut.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Campaigns Summary */}
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

      {/* Agents Summary */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Agent Roster</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold text-ifaccent">{agents.total}</p>
            <p className="text-[10px] text-ifmuted">Total Agents</p>
          </div>
          <div>
            <p className="text-xl font-bold text-ifgreen">{agents.active}</p>
            <p className="text-[10px] text-ifmuted">Active</p>
          </div>
          <div>
            <p className="text-xl font-bold text-ifcyan">{agents.averageTrust.toFixed(0)}</p>
            <p className="text-[10px] text-ifmuted">Avg Trust</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {agents.agents.map((a: any) => (
            <div key={a.role} className="flex items-center justify-between text-xs">
              <span className="text-iftext">{a.name}</span>
              <span className="badge badge-green">Trust {a.trustScore}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Audit */}
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
          {latestReport.criticalViolations.length > 0 && (
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

      {/* Credit-Free Badge */}
      <div className="text-center py-2">
        <p className="text-[10px] text-ifmuted">
          ⚡ Running credit-free on Convex · Zero Base44 credits
        </p>
      </div>
    </div>
  );
}
