import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Check, Link2, Share2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { isUsableConnection } from "@/lib/connectionHealth";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit",
};

// Share-to-Profile flow: user clicks "Share", an AI agent drafts a post, the
// user reviews and approves, and it's posted to their feed + cross-posted to
// their connected external accounts.
export default function ShareToProfileDialog({ open, onClose, sourceType, sourceId, user, connections, providerCapabilities = [], onShared }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [crossPost, setCrossPost] = useState([]);
  const [sharingDevice, setSharingDevice] = useState(false);
  const MAX_BULK_DESTINATIONS = 5;

  useEffect(() => {
    if (!open || !sourceType || !sourceId) return;
    setLoading(true);
    setDraft("");
    setCrossPost([]);
    base44.functions
      .invoke("draftSharePost", { source_type: sourceType, source_id: sourceId })
      .then((res) => {
        setDraft(res?.data?.draft_text || "");
        setSourceTitle(res?.data?.source_title || "");
      })
      .catch(() => toast({ title: "Couldn't draft post", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, sourceType, sourceId]);

  const capabilityFor = (platform) => providerCapabilities.find((c) => String(c.platform).toLowerCase() === String(platform).toLowerCase());
  const connectedSocial = (connections || []).filter((c) => {
    if (!isUsableConnection(c) || c.kind !== "social") return false;
    const cap = capabilityFor(c.platform);
    return cap?.direct_publish_verified === true && cap?.test_status === "passing" && cap?.implementation_status === "implemented";
  });
  const campaignId = sourceType === "campaign" ? sourceId : undefined;

  const shareViaDevice = async () => {
    if (!draft.trim() || sharingDevice) return;
    const url = campaignId ? `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaignId)}` : "";
    const text = [draft.trim(), url].filter(Boolean).join("\n\n");
    setSharingDevice(true);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: sourceTitle || "Interplanetary Fund", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Post copied", description: "Paste it into any app where you're signed in." });
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast({ title: "Sharing unavailable", description: "Please copy the text manually and share from your preferred app.", variant: "destructive" });
    } finally { setSharingDevice(false); }
  };

  const handleShare = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const { data } = await base44.functions.invoke("createSocialPost", {
        content: draft.trim(), campaign_id: campaignId, crosspost_platforms: [], ai_generated: true,
      });
      if (data?.ok !== true || !data?.post) throw new Error("Social share creation rejected");
      const post = data.post;
      const newScore = data.social_score;
      const newTier = data.banner_tier;

      // Keep IFund's own publication separate from external provider outcomes.
      // Every selected ID identifies one specific connection/asset, not the
      // first account found for a provider with several Pages/profiles.
      const externallyPublished = [];
      const requiresManual = [];
      for (const connectionId of crossPost) {
        const conn = connectedSocial.find((c) => c.id === connectionId);
        if (!conn || !campaignId) continue;
        try {
          const { data: distributed } = await base44.functions.invoke("createDistributedPost", { campaign_id: campaignId, connection_id: conn.id, content: draft.trim() });
          if (distributed?.ok !== true || !distributed?.post?.id) throw new Error("Post not queued");
          const { data: result } = await base44.functions.invoke("publishPost", { post_id: distributed.post.id, user_publish_authorized: true });
          if (result?.manual === false && result?.post?.status === "published") externallyPublished.push(conn.display_name || conn.platform);
          else requiresManual.push(conn.display_name || conn.platform);
        } catch {
          requiresManual.push(conn.display_name || conn.platform);
        }
      }
      const providerSummary = externallyPublished.length || requiresManual.length
        ? ` External: ${externallyPublished.length} confirmed published, ${requiresManual.length} needs manual attention.`
        : " External publishing was not requested.";
      toast({ title: "Shared to your IFund profile", description: (newTier !== (user?.banner_tier || "none") ? `You reached ${newTier} tier.` : "+10 social points.") + providerSummary });
      onShared?.(post, newScore, newTier);
      onClose();
    } catch {
      toast({ title: "Couldn't share", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 text-violet-400" /> Share to Your Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="ml-2 text-sm text-slate-200">AI agent drafting your post…</span>
          </div>
        ) : (
          <>
            {sourceTitle && <p className="text-sm text-slate-200 mb-2">Source: {sourceTitle}</p>}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="!bg-slate-800 !border-slate-500 !text-white placeholder:!text-slate-300 caret-white resize-y text-base leading-relaxed"
              placeholder="Your AI-drafted post will appear here…"
            />

            {campaignId && connectedSocial.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-slate-200 mb-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Publish to:
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button type="button" onClick={() => setCrossPost(connectedSocial.slice(0, MAX_BULK_DESTINATIONS).map(c => c.id))}
                    className="px-2.5 py-1 rounded-full border border-cyan-400/50 text-xs text-cyan-100">Select up to {MAX_BULK_DESTINATIONS}</button>
                  <button type="button" onClick={() => setCrossPost([])}
                    className="px-2.5 py-1 rounded-full border border-white/30 text-xs text-slate-100">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {connectedSocial.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCrossPost((prev) => prev.includes(c.id) ? prev.filter((p) => p !== c.id) : prev.length < MAX_BULK_DESTINATIONS ? [...prev, c.id] : prev)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                        crossPost.includes(c.id)
                          ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                          : "bg-white/10 border-white/30 text-slate-100"
                      }`}
                    >
                      {crossPost.includes(c.id) && <Check className="w-3 h-3 inline mr-1" />}
                      {PLATFORM_LABELS[c.platform] || c.platform}{c.display_name ? ` · ${c.display_name}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(connectedSocial.length === 0 || !campaignId) && (
              <p className="text-sm text-slate-200 mt-2">
                External direct publishing is available only for verified campaign connections. You can still share manually from your device. <a href="/connections" className="text-cyan-400 hover:underline">Manage connections</a>
              </p>
            )}

            {crossPost.length > 0 && (
              <p className="text-xs text-slate-200 mt-2">{crossPost.length} of {MAX_BULK_DESTINATIONS} destinations selected. Direct publishing works only on verified connections. You can also share through apps signed in on your device.</p>
            )}

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
              <Button type="button" variant="outline" onClick={shareViaDevice} disabled={sharingDevice || posting || !draft.trim()} className="border-cyan-400/60 !text-white bg-slate-800 hover:bg-slate-700">
                {sharingDevice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                Share to apps
              </Button>
              <Button onClick={handleShare} disabled={posting || !draft.trim()} className="bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 border-none">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publish to IFund
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}