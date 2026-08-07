/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Reports() {
  const reports = useQuery(api.protocol.getReports, { limit: 10 });
  const audit = useQuery(api.protocol.enforceProtocol, {});

  if (!reports) {
    return <div className="text-center text-ifmuted py-20">Loading reports...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Protocol Reports</h2>
        <p className="page-subtitle">Audit history · P-1 through P-8 compliance</p>
      </div>

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

          {/* Revenue Summary */}
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

          {/* Critical Violations */}
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

          {/* Auto-fixes Needed */}
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
      {audit && (
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
        {reports.length === 0 && (
          <p className="text-xs text-ifmuted">No reports yet. Reports are created by the weekly training job (Saturday 2am PT).</p>
        )}
        {reports.map((r: any) => (
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
  );
}
