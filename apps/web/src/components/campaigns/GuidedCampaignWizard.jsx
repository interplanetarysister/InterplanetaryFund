import { useEffect, useRef, useState } from "react";
import { buildCoverPrompt } from "@/lib/coverPrompt";
import { requestCampaignDraft } from "@/lib/campaignDraftApi";

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
  const [stage, setStage] = useState("questions");
  const [requesting, setRequesting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState(0);
  const [selectedSummary, setSelectedSummary] = useState(0);
  const [copy, setCopy] = useState(null);
  const [storyEdited, setStoryEdited] = useState(false);
  const inFlight = useRef(false);
  const requestVersion = useRef(0);
  useEffect(() => () => { requestVersion.current += 1; }, []);
  const question = getWizardQuestion(step, answers);
  const chosen = answers[question.key] || "";
  function choose(value) { setAnswers(previous => ({ ...previous, [question.key]: value })); setCustom(""); setError(""); }
  async function next() {
    if (inFlight.current) return;
    const value = custom.trim() || chosen;
    if (!value) return;
    const updated = { ...answers, [question.key]: value };
    setAnswers(updated);
    if (step < QUESTIONS.length - 1) {
      setStep(previous => previous + 1);
      setCustom("");
      setError("");
      return;
    }
    if (!details.trim()) {
      setError("Please add one sentence describing your real project before generating a draft.");
      return;
    }
    if (!draftFromWizard(updated, details, goal)) return;
    inFlight.current = true;
    const requestId = ++requestVersion.current;
    setRequesting(true);
    setError("");
    try {
      const result = await requestCampaignDraft({ answers: updated, details, goal, variation: 0 });
      if (requestId !== requestVersion.current) return;
      setCopy({ titles: result.titles, summaries: result.summaries, story: result.story });
      setStoryEdited(false);
      setGeneration(0);
      setSelectedTitle(0);
      setSelectedSummary(0);
      setStage("copy");
    } catch (e) {
      if (requestId === requestVersion.current) setError(e?.message || "Campaign preview unavailable.");
    } finally {
      inFlight.current = false;
      if (requestId === requestVersion.current) setRequesting(false);
    }
  }
  async function regenerate() {
    if (inFlight.current || !copy) return;
    const variation = (generation + 1) % 5;
    inFlight.current = true;
    const requestId = ++requestVersion.current;
    setRequesting(true);
    setError("");
    try {
      const result = await requestCampaignDraft({ answers, details, goal, variation });
      if (requestId !== requestVersion.current) return;
      setGeneration(variation);
      setCopy(previous => ({
        titles: result.titles,
        summaries: result.summaries,
        // Regeneration must not erase edits to the existing story.
        story: storyEdited ? previous.story : result.story,
      }));
      setSelectedTitle(0);
      setSelectedSummary(0);
    } catch (e) {
      if (requestId === requestVersion.current) setError(e?.message || "Alternative preview unavailable.");
    } finally {
      inFlight.current = false;
      if (requestId === requestVersion.current) setRequesting(false);
    }
  }
  const imagePrompt = copy ? buildCoverPrompt({title:copy.titles[selectedTitle],category:categoryFor(answers.cause),story:copy.story,regenCount:generation}) : "";
  return <section aria-label="Five-choice guided campaign assistant" className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-6">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">✨ Guided campaign assistant</h3><span className="text-sm text-muted-foreground">{stage === "questions" ? `Question ${step+1} of ${QUESTIONS.length}` : "Review generated content"}</span></div>
    <p className="text-sm text-muted-foreground">Five easy choices per question. Then review five title ideas, two short descriptions, one story and a signature cover-art direction.</p>
    {stage === "questions" ? <>
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
      <button type="button" disabled={requesting || (!chosen && !custom.trim())} onClick={next} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{step === QUESTIONS.length - 1 ? "Create editable starter story" : "Next question"}</button>
    </div>
    </> : <div className="space-y-5">
      <p className="text-sm text-muted-foreground">These are authenticated backend-generated factual starter suggestions, not model-generated writing or image files. Live model inference and image rendering remain unavailable.</p>
      {requesting && <p role="status" className="text-sm">Preparing alternative suggestions…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <fieldset className="space-y-2"><legend className="font-semibold">Choose a title — 5 options</legend>
        {copy.titles.map((item,i)=><button key={i} type="button" onClick={()=>setSelectedTitle(i)} aria-pressed={selectedTitle===i} className={`block w-full min-h-12 rounded-xl border p-3 text-left ${selectedTitle===i?"border-primary bg-primary/15":"border-border"}`}>{i+1}. {item}</button>)}
      </fieldset>
      <fieldset className="space-y-2"><legend className="font-semibold">Choose a short description — 2 options</legend>
        {copy.summaries.map((item,i)=><button key={i} type="button" onClick={()=>setSelectedSummary(i)} aria-pressed={selectedSummary===i} className={`block w-full min-h-12 rounded-xl border p-3 text-left ${selectedSummary===i?"border-primary bg-primary/15":"border-border"}`}>{i+1}. {item}</button>)}
      </fieldset>
      <div className="space-y-2"><h4 className="font-semibold">One editable story</h4><textarea aria-label="Your campaign story" value={copy.story} onChange={e=>{ setStoryEdited(true); setCopy(prev=>({...prev,story:e.target.value})); }} maxLength={15000} rows={8} className="w-full rounded-xl border border-input bg-background p-3" /></div>
      <div className="space-y-2"><h4 className="font-semibold">Interplanetary Fund image concept</h4><p className="text-sm text-muted-foreground">The original signature interstellar/cyberpunk/space-comic image prompt is prepared from your campaign context. Image rendering is not connected, and no image is represented as generated.</p><details><summary className="cursor-pointer text-sm underline">See image prompt</summary><textarea readOnly aria-label="Campaign-grounded cover image prompt" value={imagePrompt} rows={5} className="mt-2 w-full rounded-xl border bg-background p-3 text-xs" /></details></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>setStage("questions")} disabled={requesting} className="min-h-12 rounded-xl border px-4 disabled:opacity-50">Edit answers</button>
        <button type="button" onClick={regenerate} disabled={requesting} className="min-h-12 rounded-xl border px-4">Try another set</button>
        <button type="button" onClick={()=>onApply({title:copy.titles[selectedTitle],summary:copy.summaries[selectedSummary],story:copy.story,imagePrompt})} disabled={requesting} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Use selected campaign content</button>
      </div>
    </div>}
    <p className="text-xs text-muted-foreground">Nothing publishes or posts automatically. Always review factual claims and images before sharing.</p>
  </section>;
}

function categoryFor(cause) {
  return cause === "Creative project" ? "creative" : cause === "Personal emergency" ? "emergency" : cause === "New business" ? "business" : "community";
}

// These are deterministic offline previews, deliberately not labeled as AI generations.
// Live AI must replace this with a server-validated contract (5 unique titles,
// 2 unique summaries, exactly 1 story, and an image request grounded in the same brief).
export function buildChoices(answers, details, goal, variation=0) {
  const clean = value => String(value||"").trim().replace(/\s+/g," ");
  const subject=clean(details);
  if (!subject) throw new Error("Campaign-specific factual details are required");
  const who=clean(answers.beneficiary||"the campaign's intended beneficiaries").toLowerCase();
  const purpose=clean(answers.need||"this project").toLowerCase();
  const main=purpose.charAt(0).toUpperCase()+purpose.slice(1);
  const titles=[
    `Help Make ${main} Possible`,`Together for ${who}`,`Support ${main} for ${who}`,
    `Bring Our ${clean(answers.cause)||"Campaign"} to Life`,`Take the Next Step: ${main}`
  ];
  const shift=variation%titles.length;
  const ordered=titles.slice(shift).concat(titles.slice(0,shift));
  const summaries=[`Support ${purpose} benefiting ${who}. ${subject}`,`${subject} Help us move this effort forward through community support.`].map(s=>s.slice(0,600));
  const initial=draftFromWizard(answers,subject,goal);
  return {titles:ordered,summaries:variation%2?summaries.reverse():summaries,story:initial.story};
}
