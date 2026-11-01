import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MediaUpload from "@/components/media/MediaUpload";
import { Pencil, Loader2 } from "lucide-react";

function editable(campaign) {
  return {
    title: campaign.title || "",
    summary: campaign.summary || "",
    story: campaign.story || "",
    goal_amount: campaign.goal_amount || "",
    cover_image_url: campaign.cover_image_url || "",
  };
}

// Campaign recommendations about the story, image or goal open an actual
// editing surface, not a read-only campaign page. Server verifies ownership.
export default function EditCampaignDetailsDialog({ campaign, onSaved }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => editable(campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (location.hash === "#campaign-settings") {
      setForm(editable(campaign));
      setError("");
      setOpen(true);
    }
  }, [location.hash, location.key, campaign.id]);

  const save = async () => {
    if (!form.title.trim() || !Number.isFinite(Number(form.goal_amount)) ||
        Number(form.goal_amount) <= 0 || !String(form.story || form.summary).trim()) {
      setError("A published campaign needs a title, positive funding goal and a story.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("saveCampaign", {
        campaign_id: campaign.id,
        campaign: {
          title: form.title,
          summary: form.summary,
          story: form.story,
          goal_amount: Number(form.goal_amount),
          cover_image_url: form.cover_image_url,
          category: campaign.category,
          status: campaign.status,
        },
      });
      if (data?.ok !== true) throw new Error("Save rejected");
      setOpen(false);
      onSaved?.();
    } catch {
      setError("We couldn't save your changes. Your edits are still here; please retry.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button type="button" variant="outline" className="w-full rounded-xl justify-start"
        onClick={() => { setForm(editable(campaign)); setError(""); setOpen(true); }}>
        <Pencil className="w-4 h-4 mr-2 text-primary" /> Edit campaign details
      </Button>
      <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Edit campaign details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Campaign title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} /></div>
            <div><Label>Short summary</Label>
              <Textarea rows={2} value={form.summary} onChange={e => setForm(f => ({ ...f, summary:e.target.value }))} /></div>
            <div><Label>Campaign story</Label>
              <Textarea rows={8} value={form.story} onChange={e => setForm(f => ({ ...f, story:e.target.value }))} /></div>
            <div><Label>Funding goal</Label>
              <Input type="number" min="1" value={form.goal_amount}
                onChange={e => setForm(f => ({ ...f, goal_amount:e.target.value }))} /></div>
            <MediaUpload value={form.cover_image_url} onChange={value => setForm(f => ({ ...f, cover_image_url:value }))}
              label="Upload or replace cover image" />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
