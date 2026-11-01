import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { brandAndUploadGeneratedImage } from "@/lib/ifundImageBranding";

const TOPICS = [
  { id: "universal_donation_button", label: "Universal Donation Button" },
  { id: "cross_platform_sync", label: "Cross-Platform Sync" },
  { id: "ai_campaign_coach", label: "AI Campaign Coach" },
  { id: "treasury_management", label: "Treasury Management" },
  { id: "community_hub", label: "Community Hub" },
  { id: "institution_grants", label: "Institution & Grant Matching" },
  { id: "social_rewards", label: "Social Rewards" },
  { id: "global_globe", label: "Global Activity Globe" },
];

// Admin-only panel for generating AI social content about platform features.
// Calls the generateSocialContent backend function, which creates an official
// Interplanetary Fund post with signature-style AI imagery.
export default function AdminContentPanel({ onGenerated }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generateSocialContent", {
        topic_id: selectedTopic || undefined,
      });
      const draft = res?.data?.draft;
      if (!draft?.generated_image_url || !draft?.content) throw new Error("Unusable generated post");
      // Never publish an unwatermarked provider image. This upload physically
      // embeds the exact Copy-app logo and domain before the post exists.
      const mediaUrl = await brandAndUploadGeneratedImage(base44, draft.generated_image_url);
      const me = await base44.auth.me();
      if (me?.role !== "admin") throw new Error("Admin access required");
      const post = await base44.entities.SocialPost.create({
        author_user_id: me.id,
        author_username: "interplanetaryfund",
        author_name: "Interplanetary Fund",
        author_banner_tier: "platinum",
        content: draft.content,
        media_url: mediaUrl,
        is_top_post: true,
        ai_generated: true,
        image_generated: true,
        crosspost_platforms: [],
      });
      if (!post?.id) throw new Error("Branded post was not saved");
      toast({ title: "Branded AI post generated!", description: `Feature: ${res.data.topic}` });
      onGenerated?.(post);
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Sparkles className="w-4 h-4 text-violet-400" /> AI Content Studio
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">Generate official IF posts about platform features with signature-style AI imagery.</p>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
          >
            <option value="">Random topic</option>
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>
            ))}
          </select>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-gradient-to-r from-violet-500 to-cyan-400 text-white border-none"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate AI Post"}
          </Button>
        </div>
      )}
    </div>
  );
}