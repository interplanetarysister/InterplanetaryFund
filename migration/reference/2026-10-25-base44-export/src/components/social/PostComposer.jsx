import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ImagePlus, Send, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { isUsableConnection } from "@/lib/connectionHealth";
import { brandAndUploadGeneratedImage, uploadUserImage } from "@/lib/ifundImageBranding";
import { resolveGeneratedImageUrl } from "@/lib/generatedMedia";
import { buildCoverPrompt } from "@/lib/coverPrompt";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit", pinterest: "Pinterest",
};

export default function PostComposer({ user, connections, campaigns, providerCapabilities = [], onPosted, initialShare = null }) {
  const { toast } = useToast();
  const [content, setContent] = useState(() => initialShare?.content || "");
  const [mediaUrl, setMediaUrl] = useState(() => initialShare?.mediaUrl || "");
  const [improvedMediaUrl, setImprovedMediaUrl] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageGenerationCount, setImageGenerationCount] = useState(0);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [crossPost, setCrossPost] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          "Generate a short, inspiring social media post (under 280 characters) for the Interplanetary Fund — a fundraising home that helps one campaign reach many places. Be cosmic, empowering, and community-focused. No hashtags, no emojis beyond one.",
        response_json_schema: { type: "object", properties: { post_text: { type: "string" } } },
      });
      if (res?.post_text) {
        setContent(res.post_text);
        setAiGenerated(true);
      }
    } catch {
      toast({ title: "AI generation failed", description: "Try writing your own post.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const file_url = await uploadUserImage(base44, file, { publicFile: true });
      setMediaUrl(file_url);
      setImprovedMediaUrl("");
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const generatePostImage = async () => {
    if (imageGenerating) return;
    setImageGenerating(true);
    try {
      const campaign = campaigns?.find(c => c.id === selectedCampaign);
      const title = campaign?.title || content.trim().slice(0, 90) || "Interplanetary Fund";
      const category = campaign?.category || "community";
      const prompt = buildCoverPrompt({
        title, category, story: content, regenCount: imageGenerationCount,
      });
      const result = await base44.functions.invoke("generateCampaignCover", { prompt });
      const source = resolveGeneratedImageUrl(result?.data);
      if (!source) throw new Error("Image generator did not return an image");
      const branded = await brandAndUploadGeneratedImage(base44, source);
      setMediaUrl(branded);
      setImprovedMediaUrl(branded);
      setImageGenerationCount(c => c + 1);
      toast({ title: "Image created", description: "Your AI-generated IFund-style image is ready." });
    } catch {
      toast({ title: "Image creation failed", description: "The image could not be saved. Please try again.", variant: "destructive" });
    } finally { setImageGenerating(false); }
  };

  const toggleCrossPost = (platform) => {
    setCrossPost((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const capabilityFor = (platform) => providerCapabilities.find((c) => String(c.platform).toLowerCase() === String(platform).toLowerCase());
  const publishableConnections = (connections || []).filter((c) => {
    if (!isUsableConnection(c)) return false;
    const cap = capabilityFor(c.platform);
    return (cap?.direct_publish_verified === true && cap?.test_status === "passing" && cap?.implementation_status === "implemented") || cap?.manual_share_verified === true;
  });

  const handlePost = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const campaign = campaigns?.find((c) => c.id === selectedCampaign);
      const { data } = await base44.functions.invoke("createSocialPost", {
        content: content.trim(), media_url: mediaUrl || undefined, campaign_id: campaign?.id,
        // Only mark an external platform as shared after it returns a verified
        // published result, not when the user merely selects a destination.
        crosspost_platforms: [], ai_generated: aiGenerated,
        image_generated: Boolean(improvedMediaUrl && mediaUrl === improvedMediaUrl),
      });
      if (data?.ok !== true || !data?.post) throw new Error("Social post creation rejected");
      const post = data.post;
      const newScore = data.social_score;
      const newTier = data.banner_tier;

      // The IFund post is independent of external publishing. Each external
      // result must be inspected, because publishPost may return manual=true
      // and an approved draft rather than a provider-published post.
      const publishedPlatforms = [];
      let manualCount = 0;
      let failedCount = 0;
      if (crossPost.length && !campaign) failedCount = crossPost.length;
      if (campaign && crossPost.length > 0) {
        for (const platform of crossPost) {
          const conn = connections?.find((c) => c.platform === platform && isUsableConnection(c));
          if (!conn) { failedCount += 1; continue; }
          try {
            const { data: distributed } = await base44.functions.invoke("createDistributedPost", {
              campaign_id: campaign.id, connection_id: conn.id, content: content.trim(),
              media_url: mediaUrl || undefined,
            });
            if (distributed?.ok !== true || !distributed?.post?.id) {
              failedCount += 1;
              continue;
            }
            const result = await base44.functions.invoke("publishPost", {
              post_id: distributed.post.id, user_publish_authorized: true,
            });
            const outcome = result?.data;
            if (outcome?.manual === false && outcome?.post?.status === "published") {
              publishedPlatforms.push(platform);
            } else if (outcome?.manual === true && outcome?.post?.status === "approved") {
              manualCount += 1;
            } else {
              failedCount += 1;
            }
          } catch {
            failedCount += 1;
          }
        }
      }
      let displayedPost = post;
      if (publishedPlatforms.length) {
        try {
          displayedPost = await base44.entities.SocialPost.update(post.id, {
            crosspost_platforms: publishedPlatforms,
          });
        } catch {
          // Published destinations remain tracked by their DistributedPost
          // records even if the social feed badge cannot be updated.
        }
      }

      setContent("");
      setMediaUrl("");
      setImprovedMediaUrl("");
      setImageGenerationCount(0);
      setAiGenerated(false);
      setCrossPost([]);
      setSelectedCampaign("");
      const externalSummary = crossPost.length
        ? `${publishedPlatforms.length} published externally; ${manualCount} prepared for manual sharing; ${failedCount} need attention.`
        : (newTier !== (user.banner_tier || "none") ? `You reached ${newTier} tier!` : "+10 social points");
      toast({ title: "Posted to IFund", description: externalSummary,
        ...(failedCount ? { variant: "destructive" } : {}) });
      onPosted?.(displayedPost || post, newScore, newTier);
    } catch {
      toast({ title: "Couldn't post", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {(user?.full_name || "?")[0]?.toUpperCase()}
        </div>
        <textarea
          placeholder="Share your mission with the universe..."
          value={content}
          onChange={(e) => { setContent(e.target.value); setAiGenerated(false); }}
          rows={2}
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 text-sm resize-none focus:outline-none border-none p-1"
        />
      </div>

      {mediaUrl && (
        <div className="relative mb-3 rounded-xl overflow-hidden border border-white/10">
          <img src={mediaUrl} alt="upload" className="w-full max-h-64 object-cover" />
          <button onClick={() => { setMediaUrl(""); setImprovedMediaUrl(""); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {campaigns?.length > 0 && (
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="w-full mb-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        >
          <option value="">No campaign linked</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id} className="bg-slate-900">{c.title}</option>
          ))}
        </select>
      )}

      {connections?.length > 0 && (
        <div className="mb-3">
          <p className="text-slate-400 text-xs mb-2">Publish to:</p>
          <div className="flex items-center gap-2 flex-wrap">
          {publishableConnections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCrossPost(c.platform)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                crossPost.includes(c.platform)
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              {PLATFORM_LABELS[c.platform] || c.platform}
            </button>
          ))}
          {publishableConnections.length === 0 && <span className="text-slate-500 text-xs">No connected platforms have a verified sharing path yet.</span>}
          </div>
          {crossPost.length > 0 && <p className="text-slate-500 text-[11px] mt-2">Selecting Publish authorizes this post to the selected destinations.</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={generatePostImage}
          disabled={imageGenerating || uploading}
          className="rounded-lg">
          {imageGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {imageGenerating ? "Generating…" : "Generate Image"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-slate-400 hover:text-cyan-300">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleAI} disabled={aiLoading} className="text-slate-400 hover:text-violet-300">
          {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        </Button>
        <Button onClick={handlePost} disabled={loading || uploading || imageGenerating || !content.trim()} className="ml-auto bg-gradient-to-r from-cyan-400 to-violet-500 text-white border-none">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="text-sm font-medium">Publish</span>
        </Button>
      </div>
    </div>
  );
}