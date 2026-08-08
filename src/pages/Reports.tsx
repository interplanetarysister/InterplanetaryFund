/*
 * Interplanetary Fund — Reports & Analytics
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Combines protocol compliance reports with donation analytics.
 * Charts are dependency-free (pure SVG) — no recharts needed.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MiniBarChart, MiniPieChart, MiniLineChart } from "../components/MiniCharts";

export default function Reports() {
  const reports = useQuery(api.protocol.getReports, { limit: 10 });
  const audit = useQuery(api.protocol.enforceProtocol, {});
  const donations = useQuery(api.campaigns.getDonations, {});
  const campaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  if (!reports) {
    return <div className="text-center text-ifmuted py-20">Loading reports...</div>;
  }

  // Compute analytics from donations
  const allDonations = donations || [];
  const allCampaigns = campaigns || [];

  // Donations over time (last 14 days)
  const byDate: Record<string, { ts: number; label: string; value: number }> = {};
  allDonations.forEach((d: any) => {
    const dt = new Date(d.created_date || d._creationTime || Date.now());
    const key = dt.toISOString().slice(0, 10);
    if (!byDate[key]) {
      byDate[key] = { ts: dt.getTime(), label: dt.toLocaleDateString("en", { month: "short", day: "numeric" }), value: 0 };
    }
    byDate[key].value += d.amount || 0;
  });
  const donationsOverTime = Object.values(byDate).sort((a, b) => a.ts - b.ts).slice(-14);

  // By platform
  const byPlatformMap: Record<string, number> = {};
  allDonations.forEach((d: any) => {
    const k = d.platform || "direct";
    byPlatformMap[k] = (byPlatformMap[k] || 0) + (d.amount || 0);
  });
  const byPlatform = Object.entries(byPlatformMap).map(([label, value]) => ({ label, value }));

  // By category
  const byCategoryMap: Record<string, number> = {};
  allCampaigns.forEach((c: any) => {
    const k = c.category || "other";
    byCategoryMap[k] = (byCategoryMap[k] || 0) + 1;
  });
  const byCategory = Object.entries(byCategoryMap).map(([name, value]) => ({ name, value }));

  // Top donors
  const donorMap: Record<string, { label: string; total: number; count: number }> = {};
  allDonations.forEach((d: any) => {
    const name = d.donorName || d.donor_name || "Anonymous";
    if (!donorMap[name]) donorMap[name] = { label: name, total: 0, count: 0 };
    donorMap[name].total += d.amount || 0;
    donorMap[name].count += 1;
  });
  const topDonors = Object.values(donorMap).sort((a, b) => b.total - a.total).slice(0, 8);

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="page-title">Reports & Analytics</h2>
        <p className="page-subtitle">Protocol compliance · Donation insights · Audit history</p>
      </div>

      {/* Analytics Section */}
      {allDonations.length > 0 && (
        <>
          {/* Donations Over Time */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">📈 Donations Over Time</h3>
            <MiniLineChart data={donationsOverTime} height={140} />
          </div>

          {/* Two-column charts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">📊 By Platform</h3>
              {byPlatform.length > 0 ? (
                <MiniBarChart data={byPlatform} height={100} />
              ) : (
                <p className="text-xs text-ifmuted text-center py-4">No platform data</p>
              )}
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold text-iftext mb-3">🥧 By Category</h3>
              {byCategory.length > 0 ? (
                <MiniPieChart data={byCategory} size={100} />
              ) : (
                <p className="text-xs text-ifmuted text-center py-4">No category data</p>
              )}
            </div>
          </div>

          {/* Top Donors */}
          <div className="card">
            <h3 className="text-sm font-semibold text-iftext mb-3">🏆 Top Donors</h3>
            {topDonors.length > 0 ? (
              <div className="space-y-2">
                {topDonors.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-ifdark rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ifcyan">#{i + 1}</span>
                      <span className="text-sm text-iftext">{d.label}</span>
                      <span className="text-[10px] text-ifmuted">{d.count} gifts</span>
                    </div>
                    <span className="text-sm font-bold text-ifgreen">${d.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ifmuted text-center py-4">No donor data yet</p>
            )}
          </div>
        </>
      )}

      {/* Protocol Compliance Section */}
      <div className="border-t border-ifborder pt-4">
        <h3 className="text-sm font-semibold text-iftext mb-3">🛡️ Protocol Compliance</h3>
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
