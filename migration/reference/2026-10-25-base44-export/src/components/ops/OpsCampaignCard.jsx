import React from "react";
import { Megaphone, CreditCard } from "lucide-react";

// Protocol standards P-1..P-5 compliance, computed from synced fields.
export function protocolChecks(c) {
  return [
    { code: "P-1", label: "Outreach", pass: !!c.outreach_enabled },
    { code: "P-2", label: "Payment", pass: !!c.payment_active },
    { code: "P-3", label: "Story", pass: !!c.story_present },
    { code: "P-4", label: "Cover", pass: !!c.cover_image_present },
    { code: "P-5", label: "AI Targeting", pass: !!(c.ai_ideal_donors || c.ai_interested_orgs) },
  ];
}

export default function OpsCampaignCard({ campaign }) {
  const checks = protocolChecks(campaign);
  const pct = campaign.goal_amount ? Math.min(100, ((campaign.raised_amount || 0) / campaign.goal_amount) * 100) : 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-100 text-sm leading-snug">{campaign.title}</p>
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 shrink-0 capitalize">
          {campaign.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        <span className="font-semibold text-cyan-300">${(campaign.raised_amount || 0).toLocaleString()}</span>
        <span className="text-slate-500"> / ${(campaign.goal_amount || 0).toLocaleString()}</span>
      </p>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1 ${campaign.outreach_enabled ? "text-emerald-400" : "text-slate-500"}`}>
          <Megaphone className="w-3.5 h-3.5" /> Outreach {campaign.outreach_enabled ? "on" : "off"}
        </span>
        <span className={`flex items-center gap-1 ${campaign.payment_active ? "text-emerald-400" : "text-amber-400"}`}>
          <CreditCard className="w-3.5 h-3.5" /> Payments {campaign.payment_active ? "active" : "inactive"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {checks.map((p) => (
          <span key={p.code} title={p.label}
            className={`text-[10px] font-bold px-2 py-1 rounded-md border ${p.pass ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-rose-400/30 bg-rose-400/10 text-rose-400"}`}>
            {p.code}
          </span>
        ))}
      </div>
    </div>
  );
}