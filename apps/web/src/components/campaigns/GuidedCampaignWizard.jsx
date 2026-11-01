import { useState } from "react";

// Choice-based draft coaching. No network call or paid model is implied.
// Future AI calls must use an authenticated, rate-limited server endpoint.
const QUESTIONS = [
  { key: "cause", prompt: "What are you fundraising for?", choices: ["Creative project", "Personal emergency", "Family needs", "Community initiative", "New business"] },
  { key: "beneficiary", prompt: "Who will benefit?", choices: ["My community", "Myself", "My family", "Another person", "A wider cause"] },
  { key: "need", prompt: "What will donations support?", choices: ["Launching a project", "Materials or equipment", "Essential expenses", "Services or support", "Multiple needs"] },
  { key: "tone", prompt: "How should your story sound?", choices: ["Inspiring", "Heartfelt", "Professional", "Hopeful", "Clear and direct"] },
  { key: "assistance", prompt: "How much writing help would you like?", choices: ["Write it for me", "Guide me step by step", "Improve my writing", "Keep it brief", "I'll write it myself"] },
];

export function getWizardQuestion(index, answers) {
  const q = QUESTIONS[index];
  if (!q) return null;
  if (q.key === "need" && answers.cause === "Creative project")
    return { ...q, choices: ["Launching a project", "Making a prototype", "Buying creative supplies", "Producing an event", "Supporting collaborators"] };
  if (q.key === "need" && answers.cause === "Personal emergency")
    return { ...q, choices: ["Immediate essentials", "Housing costs", "Transport", "Recovery expenses", "Multiple urgent needs"] };
  return q;
}

export function draftFromWizard(answers, projectDetails, goal) {
  const details = projectDetails.trim();
  if (!details) return null; // Never invent a cause, outcome or personal events.
  const audience = answers.beneficiary?.toLowerCase() || "people who could benefit";
  const need = answers.need?.toLowerCase() || "this work";
  const amount = Number(goal);
  const funding = Number.isFinite(amount) && amount > 0 ? `Our fundraising goal is $${amount.toLocaleString("en-US")}.` : "";
  return {
    summary: details.replace(/\s+/g, " ").slice(0, 220),
    story: `We're raising support for ${need}, with the aim of helping ${audience}.\n\nHere's what we're working toward: ${details}\n\n${funding} Contributions can help make this work possible. Thank you for considering supporting or sharing our campaign.`,
  };
}

export default function GuidedCampaignWizard({ goal, onApply }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [custom, setCustom] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const question = getWizardQuestion(step, answers);
  const chosen = answers[question.key] || "";
  function choose(value) { setAnswers(previous => ({ ...previous, [question.key]: value })); setCustom(""); setError(""); }
  function next() {
    const value = custom.trim() || chosen;
    if (!value) return;
    const updated = { ...answers, [question.key]: value };
    setAnswers(updated);
    if (step < QUESTIONS.length - 1) { setStep(previous => previous + 1); setCustom(""); setError(""); return; }
    if (!details.trim()) { setError("Please add one sentence describing your real project before generating a draft."); return; }
    const draft = draftFromWizard(updated, details, goal);
    if (draft) onApply(draft);
  }
  return <section aria-label="Five-choice guided campaign assistant" className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">✨ Guided campaign assistant</h3><span className="text-sm text-muted-foreground">Question {step + 1} of {QUESTIONS.length}</span></div>
    <p className="text-sm text-muted-foreground">Choose one of five answers, or type your own. The assistant will prepare an editable starter story without making up personal facts.</p>
    <progress aria-label="Guided campaign progress" value={step + 1} max={QUESTIONS.length} className="w-full" />
    <h4 className="font-semibold">{question.prompt}</h4>
    <div className="grid gap-2">
      {question.choices.map(option => <button key={option} type="button" aria-pressed={chosen === option && !custom} onClick={() => choose(option)} className={`min-h-12 rounded-xl border px-4 py-3 text-left ${chosen === option && !custom ? "border-primary bg-primary/15" : "border-border bg-background"}`}>{option}</button>)}
    </div>
    <label className="block text-sm font-medium">Or your own answer (optional)
      <input value={custom} maxLength={180} onChange={event => { setCustom(event.target.value); setError(""); }} placeholder="Something else…" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3" />
    </label>
    {step === QUESTIONS.length - 1 && <label className="block text-sm font-medium">In your own words, what is your project and why does it matter? (one sentence is enough)
      <textarea required rows={3} maxLength={1500} value={details} onChange={event => { setDetails(event.target.value); setError(""); }} className="mt-2 w-full rounded-xl border border-input bg-background p-3" placeholder="We're creating ... for ... to help ..." />
    </label>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={step === 0} onClick={() => { setStep(previous => previous - 1); setCustom(""); setError(""); }} className="min-h-12 rounded-xl border border-input px-5 disabled:opacity-50">Back</button>
      <button type="button" disabled={!chosen && !custom.trim()} onClick={next} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{step === QUESTIONS.length - 1 ? "Create editable starter story" : "Next question"}</button>
    </div>
    <p className="text-xs text-muted-foreground">Local starter text only; real AI generation will be enabled after server-side authentication, quota and safety tests. Nothing publishes or posts automatically.</p>
  </section>;
}
