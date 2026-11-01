import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AIInstructionsStep, { emptyAiProfile } from "@/components/campaigns/AIInstructionsStep";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function EditAIInstructionsDialog({ campaign, onSaved }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({ ...emptyAiProfile, ...(campaign.ai_profile || {}) });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await base44.functions.invoke("updateCampaignSettings", { campaign_id: campaign.id, patch: { ai_profile: profile } });
      if (data?.ok !== true) throw new Error("Campaign setting update rejected");
      onSaved?.();
      setOpen(false);
    } catch (e) {
      console.error("EditAIInstructionsDialog AI profile save failed:", e);
      toast({ title: "Couldn't save AI profile", description: "We couldn't save the AI profile. Please try again. If the problem continues, contact support.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setProfile({ ...emptyAiProfile, ...(campaign.ai_profile || {}) });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full rounded-xl justify-start">
          <Sparkles className="w-4 h-4 mr-2 text-primary" /> Edit AI instructions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Campaign AI profile</DialogTitle>
        </DialogHeader>
        <AIInstructionsStep value={profile} onChange={setProfile} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save AI profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}