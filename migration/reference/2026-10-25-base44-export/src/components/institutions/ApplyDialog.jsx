import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { draftGrantApplication } from "@/lib/creditFreeGenerators";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import useUrlDialog from "@/hooks/useUrlDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

export default function ApplyDialog({ opportunity, institution, onApplied }) {
  const [open, setOpen] = useUrlDialog("apply", opportunity.id);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [amount, setAmount] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const me = await base44.auth.me();
      setCampaigns(await base44.entities.Campaign.filter({ created_by_id: me.id }));
    })();
  }, [open]);

  const campaign = campaigns.find((c) => c.id === campaignId);

  const draft = () => {
    setDrafting(true);
    const generated = draftGrantApplication({ opportunity, institution, campaign });
    setNarrative(generated.draftBody);
    setDrafting(false);
  };

  const submit = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("applyInstitutionOpportunity", {
      opportunity_id: opportunity.id,
      institution_id: institution.id,
      campaign_id: campaignId,
      campaign_title: campaign?.title,
      narrative,
      requested_amount: amount ? Number(amount) : undefined,
    });
    if (data?.application) {
      onApplied(data.application);
      setOpen(false);
    } else if (data?.error) {
      alert("The application could not be submitted. Please try again.");
    }
    setSaving(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title={`Apply — ${opportunity.title}`}
      desktopClassName="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
      trigger={<Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">Apply</Button>}
    >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {campaigns.length === 0 && <p className="text-xs text-stone-400">You need a campaign before applying.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Requested amount (optional)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Narrative</Label>
              <Button size="sm" variant="ghost" onClick={draft} disabled={drafting || !campaignId} className="text-primary hover:text-primary/80 h-7">
                {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Draft narrative
              </Button>
            </div>
            <Textarea rows={8} value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Why this campaign is a strong fit…" />
            <p className="text-xs text-stone-400">Credit-free drafts are suggestions — review and edit before submitting.</p>
          </div>
          <Button onClick={submit} disabled={saving || !campaignId || !narrative.trim()} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit application"}
          </Button>
        </div>
    </ResponsiveDialog>
  );
}