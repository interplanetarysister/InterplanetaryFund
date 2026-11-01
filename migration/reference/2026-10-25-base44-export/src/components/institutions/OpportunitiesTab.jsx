import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ApplyDialog from "./ApplyDialog";
import PublishOpportunityForm from "./PublishOpportunityForm";
import { Loader2, Plus, CalendarDays, Check } from "lucide-react";
import { opportunityCategories } from "./institutionTypes";
import { format } from "date-fns";

export default function OpportunitiesTab({ institution, isOwner }) {
  const [opportunities, setOpportunities] = useState(null);
  const [myApplied, setMyApplied] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const [opps, apps] = await Promise.all([
        base44.entities.InstitutionOpportunity.filter({ institution_id: institution.id }, "-created_date"),
        base44.entities.GrantApplication.filter({ institution_id: institution.id, applicant_user_id: me.id }),
      ]);
      setOpportunities(opps);
      setMyApplied(apps.map((a) => a.opportunity_id));
    })();
  }, [institution.id]);

  if (!opportunities) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const toggleStatus = async (opp) => {
    const status = opp.status === "open" ? "closed" : "open";
    setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status } : o)));
    await base44.entities.InstitutionOpportunity.update(opp.id, { status });
  };

  return (
    <div className="space-y-4">
      {isOwner && !showForm && (
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          <Plus className="w-4 h-4" /> Publish opportunity
        </Button>
      )}
      {showForm && (
        <PublishOpportunityForm
          institution={institution}
          onCancel={() => setShowForm(false)}
          onCreated={(opp) => { setOpportunities((prev) => [opp, ...prev]); setShowForm(false); }}
        />
      )}

      {opportunities.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No opportunities published yet.</p>
      ) : (
        opportunities.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{o.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-stone-500">
                  <Badge variant="secondary">{opportunityCategories[o.category] || o.category}</Badge>
                  {o.award_amount && <Badge variant="outline" className="text-emerald-700 border-emerald-200">{o.award_amount}</Badge>}
                  {o.deadline && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Due {format(new Date(o.deadline), "MMM d, yyyy")}</span>}
                </div>
              </div>
              <Badge variant="outline" className={o.status === "open" ? "text-emerald-700 border-emerald-200" : "text-stone-500"}>{o.status}</Badge>
            </div>
            {o.description && <p className="text-sm text-stone-600 mt-2">{o.description}</p>}
            <div className="mt-3 space-y-1.5 text-xs text-stone-500">
              {o.eligibility && <p><span className="font-semibold text-stone-700">Eligibility:</span> {o.eligibility}</p>}
              {o.requirements && <p><span className="font-semibold text-stone-700">Requirements:</span> {o.requirements}</p>}
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-stone-400">{o.application_count || 0} application{(o.application_count || 0) === 1 ? "" : "s"}</p>
              {isOwner ? (
                <Button size="sm" variant="outline" onClick={() => toggleStatus(o)} className="rounded-lg">
                  {o.status === "open" ? "Close" : "Reopen"}
                </Button>
              ) : myApplied.includes(o.id) ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><Check className="w-4 h-4" /> Applied</span>
              ) : (
                o.status === "open" && (
                  <ApplyDialog
                    opportunity={o}
                    institution={institution}
                    onApplied={() => {
                      setMyApplied((prev) => [...prev, o.id]);
                      setOpportunities((prev) => prev.map((x) => (x.id === o.id ? { ...x, application_count: (x.application_count || 0) + 1 } : x)));
                    }}
                  />
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}