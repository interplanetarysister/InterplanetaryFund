import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import useUrlDialog from "@/hooks/useUrlDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { communityTypes } from "./communityTypes";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";

export default function CreateCommunityDialog() {
  const available = useFeatureEnabled("community_creation");
  const [open, setOpen] = useUrlDialog("newCommunity");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("interest");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const create = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("createCommunity", { name, description, type, location });
    if (data?.ok !== true || !data?.community?.id) throw new Error("Community creation rejected");
    navigate(`/community/${data.community.id}`);
  };

  if (!available) return <span className="text-sm text-muted-foreground">Community creation is not available yet. Existing communities remain open.</span>;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Create a community"
      trigger={
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          <Plus className="w-4 h-4" /> New Community
        </Button>
      }
    >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oakland Mutual Aid Network" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What brings this community together?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(communityTypes).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <Button onClick={create} disabled={saving || !name} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create community"}
          </Button>
        </div>
    </ResponsiveDialog>
  );
}