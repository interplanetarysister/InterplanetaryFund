import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pause, Play, XCircle, Loader2 } from "lucide-react";

const statusStyles = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
};

export default function RecurringPlanCard({ donation, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const status = donation.recurring_status || "active";

  const setStatus = async (recurring_status) => {
    setSaving(true);
    setError("");
    try {
      await base44.functions.invoke("manageRecurringDonation", {
        donation_id: donation.id,
        recurring_status,
      });
      onChanged?.();
    } catch (_) {
      setError("Unable to update this recurring gift. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200/70 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/campaign/${donation.campaign_id}`} className="font-medium text-stone-900 hover:text-primary transition-colors block truncate">
            {donation.campaign_title || "Campaign"}
          </Link>
          <p className="text-sm text-stone-500"><span className="font-semibold text-stone-800">${donation.amount.toLocaleString()}</span> / month</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`capitalize ${statusStyles[status] || statusStyles.cancelled}`}>{status}</Badge>
          {saving ? <Loader2 className="w-4 h-4 animate-spin text-stone-400" /> : status === "active" ? <>
            <Button size="sm" variant="ghost" onClick={() => setStatus("paused")} className="text-stone-600"><Pause className="w-4 h-4 mr-1" />Pause</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")} className="text-red-500 hover:text-red-600"><XCircle className="w-4 h-4 mr-1" />Cancel</Button>
          </> : status === "paused" ? <>
            <Button size="sm" variant="ghost" onClick={() => setStatus("active")} className="text-emerald-600 hover:text-emerald-700"><Play className="w-4 h-4 mr-1" />Resume</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus("cancelled")} className="text-red-500 hover:text-red-600"><XCircle className="w-4 h-4 mr-1" />Cancel</Button>
          </> : null}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
