/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Campaigns() {
  const campaigns = useQuery(api.campaigns.getAllCampaigns, {});
  const latestReport = useQuery(api.protocol.getLatestReport, {});

  if (!campaigns) {
    return <div className="text-center text-ifmuted py-20">Loading campaigns...</div>;
  }

  // Build compliance map from latest report
  const complianceMap: Record<string, any> = {};
  if (latestReport?.results) {
    for (const r of latestReport.results as any[]) {
      complianceMap[r.title] = r;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Campaigns</h2>
        <p className="page-subtitle">{campaigns.length} campaigns · Protocol P-1 through P-8</p>
      </div>

      {campaigns.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-sm text-ifmuted">No campaigns synced yet.</p>
          <p className="text-xs text-ifmuted mt-1">Run the seed function to initialize.</p>
        </div>
      )}

      {campaigns.map((c: any) => {
        const compliance = complianceMap[c.title];
        const score = compliance?.complianceScore ?? 0;
        const violations = compliance?.violations ?? 0;
        const progress = c.goalAmount > 0 ? Math.round((c.raisedAmount / c.goalAmount) * 100) : 0;

        return (
          <div key={c._id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-iftext truncate">{c.title}</h3>
                <p className="text-[10px] text-ifmuted mt-0.5">
                  {c.category} · {c.status}
                </p>
              </div>
              <span className={`badge ${c.status === "active" ? "badge-green" : "badge-amber"}`}>
                {c.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ifmuted">Raised</span>
                <span className="text-iftext font-medium">
                  ${c.raisedAmount.toLocaleString()} / ${c.goalAmount.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-ifborder rounded-full overflow-hidden">
                <div
                  className="h-full bg-ifaccent rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-ifmuted mt-1 text-right">{progress}% · {c.donorCount} donors</p>
            </div>

            {/* Compliance Badges */}
            <div className="flex flex-wrap gap-1.5">
              <span className={`badge ${c.outreachEnabled ? "badge-green" : "badge-red"}`}>
                P1 Outreach {c.outreachEnabled ? "✓" : "✗"}
              </span>
              <span className={`badge ${c.aiTone ? "badge-green" : "badge-muted"}`}>
                P2 AI {c.aiTone ? "✓" : "✗"}
              </span>
              <span className={`badge ${c.storyPresent ? "badge-green" : "badge-muted"}`}>
                P3 Story {c.storyPresent ? "✓" : "✗"}
              </span>
              <span className={`badge ${c.paymentActive ? "badge-green" : "badge-red"}`}>
                P4 Pay {c.paymentActive ? "✓" : "✗"}
              </span>
              <span className="badge badge-purple">Score: {score}/6</span>
            </div>

            {/* Last Synced */}
            <p className="text-[10px] text-ifmuted">
              Last synced: {c.lastSynced ? new Date(c.lastSynced).toLocaleString() : "Never"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
