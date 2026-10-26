import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReportCard from "./ReportCard";
import { FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { secureInvokeLLM } from "@/lib/secureLLM";

const reportTypes = [
  { value: "executive_summary", label: "Executive Summary" },
  { value: "board_report", label: "Board Report" },
  { value: "impact_report", label: "Impact Report" },
  { value: "operational_review", label: "Operational Review" },
  { value: "forecast", label: "Forecast" },
];

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    forecast: { type: "string" },
    recommended_actions: { type: "array", items: { type: "string" } },
  },
};

export default function ReportsPanel({ data }) {
  const [reports, setReports] = useState(null);
  const [type, setType] = useState("executive_summary");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.ExecutiveReport.list("-created_date", 20).then(setReports).catch(() => {
      setReports([]);
      setError("Existing reports could not be loaded. Try again later.");
    });
  }, []);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    try {
    const { donations, campaigns, communities, signups, institutions, applications, volunteerOpps } = data;
    const snapshot = {
      total_raised: donations.reduce((s, d) => s + (d.amount || 0), 0),
      donor_count: donations.length,
      active_campaigns: campaigns.filter((c) => c.status === "active").length,
      communities: communities.length,
      volunteers: signups.length,
      institutions: institutions.length,
    };

    const result = await secureInvokeLLM({
      task: `Act as the executive analyst for Interplanetary Fund. Produce a ${reportTypes.find((t) => t.value === type).label}. Write an evidence-based analysis grounded strictly in supplied data: what happened, why, what is likely next, and what to do. Never invent data. Forecasts must be clearly labeled estimates, not guarantees.`,
      untrusted: [{ label: "platform_snapshot", value: `Platform snapshot:
- Total raised: $${snapshot.total_raised}
- Donations: ${snapshot.donor_count} (${donations.filter((d) => d.is_recurring).length} recurring)
- Campaigns: ${campaigns.length} total, ${snapshot.active_campaigns} active
- Campaign detail: ${campaigns.map((c) => `${c.title}: $${c.raised_amount || 0}/$${c.goal_amount} goal, ${c.donor_count || 0} donors, status ${c.status}`).join("; ") || "none"}
- Communities: ${communities.length} (${communities.reduce((s, c) => s + (c.member_count || 0), 0)} total members)
- Volunteer opportunities: ${volunteerOpps.length}, signups: ${signups.length}
- Institutions: ${institutions.length}, grant applications: ${applications.length} (${applications.filter((a) => a.status === "awarded").length} awarded)

Write an evidence-based analysis grounded strictly in these numbers. Answer: what happened, why, what is likely next, and what to do.
- summary: 3-5 sentences of plain-language executive narrative.
- highlights: 3-4 concrete wins with numbers.
- concerns: 2-4 specific risks with numbers.
- forecast: a projection with a clear confidence statement; make clear these are estimates, not guarantees.
- recommended_actions: 3-5 specific, prioritized next steps.
Never invent data that isn't in the snapshot.` }],
      response_json_schema: schema,
    });

    const report = await base44.entities.ExecutiveReport.create({
      title: `${reportTypes.find((t) => t.value === type).label} — ${format(new Date(), "MMM d, yyyy")}`,
      report_type: type,
      period: "All-time to date",
      snapshot,
      ...result,
    });
    setReports((prev) => [report, ...(prev || [])]);
    } catch {
      setError("IFund could not generate or save the report. No report was added; try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {reportTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={generate} disabled={generating} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generate report
        </Button>
      </div>
      {generating && <p className="text-xs text-stone-400">Analyzing platform activity and drafting your report…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {reports === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">No reports yet — generate your first executive report.</p>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} />)
      )}
    </div>
  );
}