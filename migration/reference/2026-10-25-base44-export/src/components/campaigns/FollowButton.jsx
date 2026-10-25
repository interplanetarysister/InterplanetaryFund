import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { hapticTap, hapticSuccess } from "@/lib/haptics";

// Persistent follow heart. Tapping saves the campaign to the user's
// Followed Campaigns collection, animates the heart fill, and toasts a
// confirmation. State is DB-backed so it syncs across devices automatically.
export default function FollowButton({ campaign }) {
  const [follow, setFollow] = useState(null);
  const [meId, setMeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me) { setLoading(false); return; }
        setMeId(me.id);
        const existing = await base44.entities.FollowedCampaign.filter({ user_id: me.id, campaign_id: campaign.id });
        setFollow(existing[0] || null);
      } catch { /* not logged in */ }
      setLoading(false);
    })();
  }, [campaign.id]);

  const followPrefs = {
    updates: true, media: true, milestones: true, goal_reached: true,
    nearing_completion: true, comments: false, volunteer: true,
    events: true, emergencies: true, completed: true,
  };

  const toggle = async () => {
    hapticTap();
    if (busy) return;
    if (!meId) { base44.auth.redirectToLogin(window.location.pathname); return; }
    const wasFollow = follow;
    setBusy(true);
    if (wasFollow) {
      // Optimistic unfollow — clear immediately, restore only if the delete fails.
      setFollow(null);
      try {
        const { data } = await base44.functions.invoke("toggleCampaignFollow", { campaign_id: campaign.id });
        if (data?.ok !== true || data?.following !== false) throw new Error("Unfollow rejected");
        toast({ title: "Removed from Followed" });
      } catch (e) {
        setFollow(wasFollow);
        toast({ title: "Couldn't update follow", variant: "destructive" });
      }
    } else {
      // Optimistic follow — show the filled heart instantly, roll back on failure.
      const payload = {
        user_id: meId,
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        category: campaign.category,
        cover_image_url: campaign.cover_image_url,
        notification_prefs: followPrefs,
      };
      setFollow({ ...payload, id: "pending" });
      try {
        const { data } = await base44.functions.invoke("toggleCampaignFollow", { campaign_id: campaign.id });
        if (data?.ok !== true || data?.following !== true || !data?.follow) throw new Error("Follow rejected");
        setFollow(data.follow);
        hapticSuccess();
        toast({ title: "Campaign Added to Followed", description: "You'll get updates in your Follow Feed." });
      } catch (e) {
        setFollow(null);
        toast({ title: "Couldn't update follow", variant: "destructive" });
      }
    }
    setBusy(false);
  };

  if (loading) return <div className="w-10 h-10 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-stone-300" /></div>;

  const active = !!follow;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? "Unfollow campaign" : "Follow campaign"}
      className="relative w-10 h-10 shrink-0 rounded-full bg-white border border-stone-200 flex items-center justify-center hover:border-rose-200 transition-colors disabled:opacity-70"
    >
      <motion.span
        initial={false}
        animate={{ scale: active ? [1, 1.35, 1] : 1 }}
        transition={{ duration: 0.35 }}
        key={active ? "on" : "off"}
      >
        <Heart className={`w-5 h-5 transition-colors ${active ? "text-rose-500 fill-rose-500" : "text-stone-400"}`} />
      </motion.span>
    </button>
  );
}