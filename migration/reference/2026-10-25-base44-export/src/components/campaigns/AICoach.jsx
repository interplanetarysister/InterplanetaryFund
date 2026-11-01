import React, { useState } from "react";
import { secureInvokeLLM } from "@/lib/secureLLM";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export default function AICoach({ campaign, updatesCount }) {
  const available = useFeatureEnabled("ai_campaign_assistant");
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  const [previousTips, setPreviousTips] = useState([]);

  const ask = async () => {
    setLoading(true);
    setError("");
    try {
      const nextRound = round + 1;
      const res = await secureInvokeLLM({
        featureKey: "ai_campaign_assistant",
        task: `Act as a dynamic fundraising coach. Give exactly 3 short, specific, actionable tips, each one sentence with a brief reason. Analyze the current campaign state rather than repeating a canned checklist. This is coaching round ${nextRound}. Deliberately choose different useful angles from previous rounds: rotate among story clarity, trust/transparency, campaign presentation, updates, sharing, audience discovery, supporter retention, milestones, calls to action, accessibility, and next-step experimentation. Do not repeat or lightly paraphrase prior tips supplied below unless the campaign state makes one urgently necessary. Never guarantee outcomes and never invent campaign facts.`,
        untrusted: [
          { label: "campaign", value: JSON.stringify({ title: campaign.title, category: campaign.category, summary: campaign.summary || "", goal: campaign.goal_amount, raised: campaign.raised_amount || 0, donors: campaign.donor_count || 0, story_length: campaign.story?.length || 0, updates_posted: updatesCount, has_cover_image: !!campaign.cover_image_url, status: campaign.status }) },
          { label: "previous_coaching", value: JSON.stringify(previousTips.slice(-9)) },
        ],
        response_json_schema: {
          type: "object",
          properties: { tips: { type: "array", items: { type: "string" } } },
        },
      });
      const fresh = res.tips || [];
      setTips(fresh);
      setPreviousTips((old) => [...old, ...fresh].slice(-12));
      setRound(nextRound);
    } catch (e) {
      setError("Couldn't generate tips right now. Please try again.");
    }
    setLoading(false);
  };

  if (!available) return <p className="text-sm text-muted-foreground">AI coaching is not available yet. You can continue managing and publishing your campaign.</p>;

  return (
    <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-2xl p-5 text-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display text-lg text-slate-100">AI Coach</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={ask} disabled={loading} className="text-cyan-400 hover:text-cyan-300 hover:bg-white/5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : tips ? "Fresh tips" : "Get tips"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!tips && !error && <p className="text-xs text-slate-500">Personalized coaching for this campaign, on demand.</p>}
      {tips && (
        <ul className="space-y-2.5">
          {tips.map((t, i) => (
            <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2.5">
              <span className="text-cyan-400 font-display shrink-0">{i + 1}.</span>{t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}