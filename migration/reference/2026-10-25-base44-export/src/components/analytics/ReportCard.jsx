import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const typeLabels = {
  executive_summary: "Executive Summary",
  board_report: "Board Report",
  impact_report: "Impact Report",
  operational_review: "Operational Review",
  forecast: "Forecast",
};

function List({ title, items, tone }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${tone}`}>{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className="text-sm text-stone-600">• {it}</li>)}
      </ul>
    </div>
  );
}

export default function ReportCard({ report }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{report.title}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {report.period} · generated {format(new Date(report.created_date), "MMM d, yyyy")}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">{typeLabels[report.report_type] || report.report_type}</Badge>
      </div>
      {report.summary && <p className="text-sm text-stone-600 whitespace-pre-line">{report.summary}</p>}
      <List title="Highlights" items={report.highlights} tone="text-emerald-700" />
      <List title="Concerns" items={report.concerns} tone="text-red-600" />
      {report.forecast && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">Forecast (projected, not historical)</p>
          <p className="text-sm text-stone-600">{report.forecast}</p>
        </div>
      )}
      <List title="Recommended actions" items={report.recommended_actions} tone="text-stone-800" />
    </div>
  );
}