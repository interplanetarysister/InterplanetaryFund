import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Lightbulb, SlidersHorizontal } from "lucide-react";

// The campaign's permanent AI profile. Every question is optional so the
// creator can skip now and edit later. These answers are reused by every AI
// feature (story generator, outreach agent, recommendations) to represent
// the campaign consistently and truthfully.
const TONES = ["Warm", "Emotional", "Hopeful", "Professional", "Urgent", "Factual", "Conversational"];
const PLATFORMS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Twitter/X", "Email", "Other"];

export const emptyAiProfile = {
  primary_goal: "",
  who_helping: "",
  ideal_donors: "",
  donor_discovery_mode: "ai_research",
  donor_discovery_notes: "",
  tone: "",
  never_change: "",
  always_emphasize: "",
  platforms: [],
  interested_orgs: "",
  avoid_words: "",
  priority: "",
  long_term_outcome: "",
};

export default function AIInstructionsStep({ value, onChange }) {
  const v = { ...emptyAiProfile, ...(value || {}) };
  // Fold older separate audience answers into one editable answer without loss.
  const supporterNotes = [...new Set([
    v.donor_discovery_notes, v.ideal_donors, v.interested_orgs,
  ].map((text) => String(text || "").trim()).filter(Boolean))].join("\n");
  const set = (k, val) => onChange({
    ...v,
    donor_discovery_notes: supporterNotes,
    ideal_donors: "",
    interested_orgs: "",
    [k]: val,
  });
  const togglePlatform = (p) =>
    set("platforms", v.platforms.includes(p) ? v.platforms.filter((x) => x !== p) : [...v.platforms, p]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="quest-icon"><Sparkles className="w-5 h-5" /></span>
        <div><h2 className="text-xl font-bold text-white">Give AI the signal</h2><p className="text-sm text-slate-300">A couple clues help. Everything here is optional.</p></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="What are we making possible?">
          <Input className="quest-input" value={v.primary_goal} onChange={(e) => set("primary_goal", e.target.value)} placeholder="A short goal, in your words…" />
        </Field>
        <Field label="Who or what is this for?">
          <Input className="quest-input" value={v.who_helping} onChange={(e) => set("who_helping", e.target.value)} placeholder="A person, project, community…" />
        </Field>
        <Field label="What vibe feels right?">
          <Select value={v.tone} onValueChange={(val) => set("tone", val)}>
            <SelectTrigger className="quest-input"><SelectValue placeholder="Let AI choose" /></SelectTrigger>
            <SelectContent>
              {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

      </div>

      <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 space-y-3">
        <div className="flex gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-cyan-50">AI can find your crowd</p>
            <p className="text-xs text-slate-300 mt-1">You do not need to guess who might care. The agents can explore likely supporters from the campaign itself.</p>
          </div>
        </div>
        <Field label="Who might want to support this campaign? (optional)">
          <Textarea className="quest-input" rows={2} value={supporterNotes} onChange={(e) => set("donor_discovery_notes", e.target.value)} placeholder="People, groups, organizations, or ideas — or leave this to AI" />
        </Field>
      </div>

      <details className="rounded-2xl border border-violet-400/25 bg-violet-500/10 overflow-hidden group"><summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-semibold text-violet-100"><span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-cyan-300" /> More AI controls <span className="font-normal text-slate-400">(optional)</span></span><span className="text-cyan-300 group-open:rotate-45 transition-transform">+</span></summary><div className="p-4 space-y-4 border-t border-white/10"><Field label="What facts must stay exact?">
        <Textarea className="quest-input" rows={2} value={v.never_change} onChange={(e) => set("never_change", e.target.value)} placeholder="Facts the AI must keep exactly as stated" />
      </Field>
      <Field label="What information should always be emphasized?">
        <Textarea className="quest-input" rows={2} value={v.always_emphasize} onChange={(e) => set("always_emphasize", e.target.value)} placeholder="Anything that should always shine through" />
      </Field>
      <Field label="Are there words or topics that should be avoided?">
        <Textarea className="quest-input" rows={2} value={v.avoid_words} onChange={(e) => set("avoid_words", e.target.value)} placeholder="Anything the AI should avoid" />
      </Field>
      <Field label="What long-term outcome are you hoping this campaign achieves?">
        <Textarea className="quest-input" rows={2} value={v.long_term_outcome} onChange={(e) => set("long_term_outcome", e.target.value)} placeholder="What does a great ending look like?" />
      </Field>

      <Field label="Where might you share it?">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = v.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-stone-600 hover:border-slate-300"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field></div></details>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="quest-label">{label}</Label>
      {children}
    </div>
  );
}