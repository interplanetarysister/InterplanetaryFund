/*
 * Interplanetary Fund — AI Campaign Creation Wizard
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Step-by-step campaign creation that uses AI to generate:
 * Title, summary, story, FAQ, social captions, image, press release,
 * donor thank-you, SEO content — all credit-free via Convex.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const STEPS = [
  { key: "what", label: "What happened?", placeholder: "Describe the situation that led to this fundraiser...", type: "textarea", icon: "📝" },
  { key: "why", label: "Why do you need funds?", placeholder: "Explain how the funds will be used...", type: "textarea", icon: "💡" },
  { key: "beneficiary", label: "Who benefits?", placeholder: "Who will receive the support?", type: "text", icon: "👥" },
  { key: "goal", label: "Funding goal ($)", placeholder: "e.g. 5000", type: "number", icon: "💰" },
  { key: "timeline", label: "Timeline", placeholder: "e.g. 30 days, or by end of August", type: "text", icon: "⏰" },
  { key: "category", label: "Category", type: "select", icon: "📂", options: ["Community", "Medical", "Education", "Emergency", "Animals", "Environment", "Technology", "Other"] },
];

export default function AICampaignWizard({ userId, onComplete, onCancel }: {
  userId: string;
  onComplete: (campaignId: string) => void;
  onCancel: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [view, setView] = useState<"wizard" | "preview" | "published">("wizard");

  const generate = useMutation(api.aiCampaignGen.generateCampaignContent);
  const createCampaign = useMutation(api.userCampaigns.createCampaign);
  const generateImageUrl = useMutation(api.aiCampaignGen.generateImageUrl);

  const current = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const canProceed = answers[current.key] !== undefined && answers[current.key] !== "";

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generate({
        what: answers.what || "",
        why: answers.why || "",
        beneficiary: answers.beneficiary || "",
        goal: parseFloat(answers.goal) || 0,
        timeline: answers.timeline || "",
        category: answers.category || "Community",
      });
      setGenerated(result);
      setEditing({
        title: result.title,
        summary: result.summary,
        story: result.story,
        category: answers.category || "Community",
        goalAmount: parseFloat(answers.goal) || 0,
        coverImageUrl: result.imageUrl,
        imagePrompt: result.imagePrompt,
        faq: result.faq,
        socialCaptions: result.socialCaptions,
        pressRelease: result.pressRelease,
        donorThankYou: result.donorThankYou,
        seoContent: result.seoContent,
        tags: result.tags,
      });
      setView("preview");
    } catch (e) {
      alert("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!editing?.imagePrompt) return;
    setGeneratingImage(true);
    try {
      const result = await generateImageUrl({ prompt: editing.imagePrompt, width: 800, height: 600 });
      setEditing({ ...editing, coverImageUrl: result.url });
    } catch (e) {
      alert("Image generation failed. Please try again.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const result = await createCampaign({
        userId,
        title: editing.title,
        summary: editing.summary,
        story: editing.story,
        category: editing.category,
        goalAmount: editing.goalAmount,
        coverImageUrl: editing.coverImageUrl,
        outreachEnabled: true,
        aiFaq: editing.faq,
        aiSocialCaptions: JSON.stringify(editing.socialCaptions),
        aiPressRelease: editing.pressRelease,
        aiDonorThankYou: editing.donorThankYou,
        aiSeoContent: editing.seoContent,
        aiImagePrompt: editing.imagePrompt,
        aiTags: editing.tags,
        aiGenerated: true, publish: true,
      });
      if (result.success) {
        setPublished(result.campaignId);
        setView("published");
      } else {
        alert(result.error || "Failed to publish campaign");
      }
    } catch (e) {
      alert("Failed to publish. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // === PUBLISHED VIEW ===
  if (view === "published" && published) {
    return (
      <div className="space-y-4">
        <div className="card text-center py-8">
          <div className="text-5xl mb-3">🚀</div>
          <h2 className="text-lg font-bold text-iftext">Cleared for Takeoff!</h2>
          <p className="text-sm text-ifmuted mt-2 px-4">
            Your campaign is now live and orbiting. Godspeed, Captain!
          </p>
          <div className="flex gap-2 mt-4 justify-center">
            <button
              onClick={() => onComplete(published)}
              className="btn-primary px-6"
            >
              View Campaign
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm"
            >
              Mission Control
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === PREVIEW VIEW ===
  if (view === "preview" && editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("wizard")} className="text-xs text-ifmuted">&larr; Back to wizard</button>
          <span className="text-sm font-semibold text-iftext">Campaign Preview</span>
          <span className="text-[10px] text-ifcyan ml-auto">AI Generated</span>
        </div>

        {/* Cover Image */}
        <div className="rounded-xl overflow-hidden border border-ifborder">
          {editing.coverImageUrl ? (
            <img src={editing.coverImageUrl} alt="Campaign cover" className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-ifaccent/20 to-ifcyan/10 flex items-center justify-center">
              <span className="text-ifmuted text-xs">No image</span>
            </div>
          )}
          <div className="p-2 flex items-center justify-between bg-ifcard">
            <span className="text-[10px] text-ifmuted">Cyberpunk-Afropunk-Interstellar style</span>
            <button
              onClick={handleRegenerateImage}
              disabled={generatingImage}
              className="text-[10px] text-ifcyan active:text-ifsky"
            >
              {generatingImage ? "Generating..." : "↻ Regenerate image"}
            </button>
          </div>
        </div>

        {/* Editable Title */}
        <div className="card space-y-3">
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Title</label>
            <input
              type="text"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Summary</label>
            <textarea
              value={editing.summary}
              onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
              className="input-field min-h-[40px]"
            />
          </div>
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Story</label>
            <textarea
              value={editing.story}
              onChange={(e) => setEditing({ ...editing, story: e.target.value })}
              className="input-field min-h-[200px] text-xs"
            />
          </div>
        </div>

        {/* FAQ */}
        {editing.faq && (
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-iftext">FAQ (auto-generated)</h3>
            <div className="text-[11px] text-ifmuted whitespace-pre-wrap max-h-32 overflow-y-auto">
              {editing.faq}
            </div>
          </div>
        )}

        {/* Social Captions */}
        {editing.socialCaptions && (
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-iftext">Social Media Captions</h3>
            {editing.socialCaptions.map((s: any, i: number) => (
              <div key={i} className="bg-ifdark rounded-lg p-2">
                <p className="text-[10px] text-ifcyan font-semibold">{s.platform}</p>
                <p className="text-[11px] text-ifmuted mt-0.5">{s.caption}</p>
              </div>
            ))}
          </div>
        )}

        {/* Additional AI Content */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-iftext">Additional AI Content</h3>
          <div>
            <p className="text-[10px] text-ifmuted font-semibold">Press Release</p>
            <div className="text-[11px] text-ifmuted whitespace-pre-wrap max-h-32 overflow-y-auto mt-1 bg-ifdark rounded-lg p-2">
              {editing.pressRelease}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-ifmuted font-semibold">Donor Thank-You Message</p>
            <div className="text-[11px] text-ifmuted whitespace-pre-wrap max-h-32 overflow-y-auto mt-1 bg-ifdark rounded-lg p-2">
              {editing.donorThankYou}
            </div>
          </div>
        </div>

        {/* Goal info */}
        <div className="card">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-ifcyan">${editing.goalAmount?.toLocaleString()}</p>
              <p className="text-[10px] text-ifmuted">Target Orbit</p>
            </div>
            <div>
              <p className="text-lg font-bold text-ifaccent">{editing.category}</p>
              <p className="text-[10px] text-ifmuted">Category</p>
            </div>
          </div>
        </div>

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-ifaccent to-ifcyan text-white text-sm font-bold"
        >
          {saving ? "Launching..." : "🚀 Launch Campaign"}
        </button>
      </div>
    );
  }

  // === WIZARD VIEW ===
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-xs text-ifmuted">&larr; Cancel</button>
        <span className="text-sm font-semibold text-iftext">AI Campaign Wizard</span>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 h-1.5 rounded-full transition-colors ${i <= stepIdx ? "bg-ifaccent" : "bg-ifborder"}`}
          />
        ))}
      </div>

      {/* Current Step */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{current.icon}</span>
          <h3 className="text-sm font-semibold text-iftext">{current.label}</h3>
        </div>
        <p className="text-[11px] text-ifmuted">Step {stepIdx + 1} of {STEPS.length}</p>

        {current.type === "select" ? (
          <div className="grid grid-cols-2 gap-2">
            {current.options?.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers({ ...answers, [current.key]: opt })}
                className={`p-3 rounded-xl text-sm font-medium border transition-colors ${
                  answers[current.key] === opt
                    ? "bg-ifaccent/20 border-ifaccent text-iftext"
                    : "bg-ifcard border-ifborder text-ifmuted"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : current.type === "textarea" ? (
          <textarea
            placeholder={current.placeholder}
            value={answers[current.key] || ""}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
            className="input-field min-h-[120px]"
            autoFocus
          />
        ) : (
          <input
            type={current.type === "number" ? "number" : "text"}
            placeholder={current.placeholder}
            value={answers[current.key] || ""}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
            className="input-field"
            autoFocus
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        {stepIdx > 0 && (
          <button
            onClick={() => setStepIdx(stepIdx - 1)}
            className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm"
          >
            Back
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => setStepIdx(stepIdx + 1)}
            disabled={!canProceed}
            className="btn-primary flex-1"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!canProceed || generating}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-ifaccent to-ifcyan text-white text-sm font-bold"
          >
            {generating ? "Generating with AI..." : "✨ Generate Campaign"}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="text-center text-[10px] text-ifmuted pb-2">
        AI generates title, story, FAQ, social captions, image, and more — all credit-free
      </div>
    </div>
  );
}
