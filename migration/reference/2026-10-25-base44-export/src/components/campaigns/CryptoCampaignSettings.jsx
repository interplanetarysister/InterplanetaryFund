import React, { useEffect, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function CryptoCampaignSettings({ campaign, onSaved }) {
  const [enabled, setEnabled] = useState(campaign?.accept_crypto_donations === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setEnabled(campaign?.accept_crypto_donations === true); }, [campaign?.accept_crypto_donations]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      const { data } = await base44.functions.invoke("updateCampaignSettings", {
        campaign_id: campaign.id,
        patch: { accept_crypto_donations: enabled },
      });
      if (data?.ok !== true) throw new Error("Update rejected");
      onSaved?.();
    } catch { setError("Could not save cryptocurrency preference. Try again."); }
    finally { setSaving(false); }
  };

  return <section className="bg-white rounded-2xl border border-stone-200 p-5">
    <h3 className="flex items-center gap-2 font-display text-lg text-stone-900"><Wallet className="w-4 h-4 text-primary" /> Cryptocurrency donations</h3>
    <p className="text-xs text-stone-600 mt-1">Choose whether this campaign will offer crypto giving when verified receiving becomes available.</p>
    <label className="flex items-center gap-3 text-sm text-stone-800 mt-3">
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      Allow supporters to donate using a crypto wallet
    </label>
    <Button type="button" onClick={save} disabled={saving || enabled === (campaign?.accept_crypto_donations === true)} className="mt-3 rounded-xl">
      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save preference
    </Button>
    <p className="text-xs text-amber-800 mt-2">Opt-in does not enable live crypto transfers until the receiving and accounting system is verified.</p>
    {error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
  </section>;
}
