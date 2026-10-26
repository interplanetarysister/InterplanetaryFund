import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { applicationStatuses } from "./institutionTypes";

export default function MyApplications() {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setApps(await base44.entities.GrantApplication.filter({ applicant_user_id: me.id }, "-created_date", 10));
    })();
  }, []);

  if (apps.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="font-semibold text-stone-900 mb-3">My applications</h2>
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
        {apps.map((a) => {
          const s = applicationStatuses[a.status] || applicationStatuses.submitted;
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <Link to={`/institutions/${a.institution_id}`} className="text-sm font-medium text-stone-900 hover:text-primary truncate block">
                  {a.opportunity_title}
                </Link>
                <p className="text-xs text-stone-400 truncate">{a.institution_name} · for {a.campaign_title}</p>
                {a.decision_note && <p className="text-xs text-stone-500 mt-1">"{a.decision_note}"</p>}
              </div>
              <Badge className={`shrink-0 ${s.className}`}>{s.label}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}