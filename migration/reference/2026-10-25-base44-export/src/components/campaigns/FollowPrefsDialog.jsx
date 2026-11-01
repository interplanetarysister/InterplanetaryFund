import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PREFS = [
  { key: "updates", label: "New campaign updates" },
  { key: "media", label: "New media uploads" },
  { key: "milestones", label: "Milestone achievements" },
  { key: "goal_reached", label: "Goal reached" },
  { key: "nearing_completion", label: "Nearing completion" },
  { key: "comments", label: "New comments" },
  { key: "volunteer", label: "Volunteer opportunities" },
  { key: "events", label: "Event announcements" },
  { key: "emergencies", label: "Fundraising emergencies" },
  { key: "completed", label: "Campaign completed" },
];

// Per-campaign notification preferences. Defaults are all-on (except comments);
// the owner of the follow can mute any event type here.
export default function FollowPrefsDialog({ follow, onChanged }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(follow?.notification_prefs || {});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    const { data } = await base44.functions.invoke("updateFollowPreferences", { follow_id: follow.id, notification_prefs: prefs });
    if (data?.ok !== true) throw new Error("Notification preference update rejected");
    onChanged(data.follow);
    setSaving(false);
    setOpen(false);
    toast({ title: "Notification preferences saved" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-lg"><Bell className="w-3.5 h-3.5" /> Notifications</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-stone-500 -mt-1">Choose which alerts you receive for “{follow?.campaign_title}”.</p>
        <div className="space-y-3 mt-2 max-h-[50vh] overflow-y-auto">
          {PREFS.map((p) => (
            <div key={p.key} className="flex items-center justify-between">
              <span className="text-sm text-stone-700">{p.label}</span>
              <Switch
                checked={prefs[p.key] !== false}
                onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving} className="rounded-xl">Save preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}