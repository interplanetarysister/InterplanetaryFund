import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, DollarSign } from "lucide-react";

// Owner-only: set the Cash App $Cashtag supporters can send money to.
export default function CashAppSettings({ campaign, onSaved }) {
  const [tag, setTag] = useState(campaign.cashapp_tag || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("updateCampaignSettings", { campaign_id: campaign.id, patch: { cashapp_tag: tag.replace(/^\$/, "") } });
    if (data?.ok !== true) throw new Error("Campaign setting update rejected");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onSaved) onSaved();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-1">
        <DollarSign className="w-4 h-4 text-primary" /> Cash App giving
      </h3>
      <p className="text-xs text-stone-500 mb-3">Add your Cashtag so supporters can also give with Cash App.</p>
      <Label htmlFor="cashtag" className="text-xs text-stone-600">Your Cashtag</Label>
      <div className="flex gap-2 mt-1">
        <Input id="cashtag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="$yourtag" />
        <Button onClick={save} disabled={saving} className="rounded-xl shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}