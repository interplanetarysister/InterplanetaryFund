import { useState } from "react";
import { Link } from "react-router-dom";
import { DEMO_STEPS, SHOWCASE_CAMPAIGNS } from "@/lib/unifiedDemoJourney.mjs";

const linkStyle = "inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10";
const detailStyle = "rounded-xl border border-slate-700 bg-slate-950/70 p-4";

export default function DemoJourney({ onFinanceFilter }) {
  const [currentId, setCurrentId] = useState(SHOWCASE_CAMPAIGNS[0].id);
  const [titleIndex, setTitleIndex] = useState(0);
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [shareDestination, setShareDestination] = useState("Facebook");
  const [copyState, setCopyState] = useState("");
  const current = SHOWCASE_CAMPAIGNS.find(c => c.id === currentId) || SHOWCASE_CAMPAIGNS[0];
  const title = current.titles[titleIndex];
  const summary = current.summaries[summaryIndex];
  const shareText = `[FICTIONAL JUDGE DEMO] ${title}\n\n${summary}\n\nManaged by a campaign manager on Interplanetary Fund.\n\nThis is a demonstration. No campaign was published and no funds have been collected.`;
  async function copyExample() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable in this browser.");
      await navigator.clipboard.writeText(shareText);
      setCopyState("Example copied. Nothing was published.");
    } catch {
      setCopyState("Copy unavailable. Select the sample message above to copy it manually.");
    }
  }
  return <div className="space-y-6">
    <nav aria-label="One continuous demo journey" className="rounded-2xl border border-cyan-400/40 bg-[#080e23] p-4 text-white sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">One demo · six connected steps</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DEMO_STEPS.map((step, i) => <a key={step.id} href={`#${step.id}`} className="flex min-h-20 flex-col justify-center rounded-xl border border-white/15 bg-white/5 p-3 transition hover:border-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
          <span className="text-xs text-cyan-300">STEP {i + 1}</span>
          <strong className="mt-1 text-sm">{step.title}</strong>
          <span className="mt-1 text-xs text-slate-300">{step.detail}</span>
        </a>)}
      </div>
      <p className="mt-4 text-xs text-slate-300">The same page contains the entire public tour. Optional links to actual account, campaign, and AI features open separately. No real payments or publishing occur without deliberate use of the verified service.</p>
    </nav>

    <section id="journey" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5 text-white" aria-label="Explore fictional campaigns">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Step 1 · Discovery</p>
        <h2 className="mt-2 text-xl font-bold">Choose a campaign scenario</h2>
        <p className="mt-2 text-sm text-slate-300">Select an example to see its story, promotional message, and corresponding AG Grid figures throughout this page.</p>
      </div>
      <p role="note" className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-xs font-semibold text-amber-100">FICTIONAL SHOWCASE DATA · These example campaigns are not public donation campaigns and cannot receive real or sandbox funds.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SHOWCASE_CAMPAIGNS.map(c => <button key={c.id} type="button" aria-pressed={currentId===c.id}
          onClick={() => { setCurrentId(c.id); setTitleIndex(0); setSummaryIndex(0); setCopyState(""); onFinanceFilter?.(c.title); }}
          className={`min-h-28 rounded-xl border p-4 text-left transition ${currentId===c.id ? "border-cyan-300 bg-cyan-400/15" : "border-white/20 bg-slate-950/50 hover:border-cyan-400/60"}`}>
          <span className="text-xs font-semibold uppercase text-cyan-300">{c.category}</span>
          <strong className="mt-2 block text-base">{c.title}</strong>
          <span className="mt-2 block text-xs text-slate-300">{c.need}</span>
        </button>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <a href="#ai-workshop" className={linkStyle}>Continue to sample story</a>
        <Link to="/discover" target="_blank" rel="noopener noreferrer" className={linkStyle}>See actual published campaigns</Link>
      </div>
    </section>

    <section id="ai-workshop" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5 text-white" aria-label="Campaign drafting sample">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Step 2 · Campaign writing</p>
        <h2 className="mt-2 text-xl font-bold">Select a title, summary and full story</h2>
        <p className="mt-2 text-sm text-slate-300">This interactive sample illustrates iFund's five-title, two-summary and story workflow. These example options are prewritten, <strong>not an AI inference call</strong>.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className={detailStyle}>
          <legend className="font-semibold">Five sample titles</legend>
          <div className="mt-3 space-y-2">{current.titles.map((v,i)=><label key={i} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-white/5">
            <input type="radio" className="mt-1" name="demo-title" checked={titleIndex===i} onChange={()=>{setTitleIndex(i);setCopyState("");}} />
            <span>{v}</span>
          </label>)}</div>
        </fieldset>
        <fieldset className={detailStyle}>
          <legend className="font-semibold">Two sample descriptions</legend>
          <div className="mt-3 space-y-2">{current.summaries.map((v,i)=><label key={i} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-white/5">
            <input type="radio" className="mt-1" name="demo-summary" checked={summaryIndex===i} onChange={()=>{setSummaryIndex(i);setCopyState("");}} />
            <span>{v}</span>
          </label>)}</div>
          <div className="mt-5 rounded-lg border border-cyan-300/20 p-3 text-sm">
            <strong>Selected campaign preview</strong>
            <p className="mt-2 font-semibold text-cyan-200">{title}</p>
            <p className="mt-1 text-slate-300">{summary}</p>
          </div>
        </fieldset>
      </div>
      <div className={detailStyle}>
        <h3 className="font-semibold">One full example story, presented in editable sections in the real editor</h3>
        {current.sections.map((paragraph,i)=><p key={i} className="mt-3 text-sm leading-6 text-slate-300"><span className="mr-2 text-xs font-bold text-cyan-300">SECTION {i+1}</span>{paragraph}</p>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/create" target="_blank" rel="noopener noreferrer" className={linkStyle}>Try actual AI campaign creator</Link>
        <Link to="/agents" target="_blank" rel="noopener noreferrer" className={linkStyle}>Open authenticated Story Agent</Link>
        <a href="#promote" className={linkStyle}>Continue to sharing</a>
      </div>
      <p className="text-xs text-slate-400">Live AI generation depends on the connected service and account access. Fictional sample wording cannot be submitted as evidence of a successful AI call.</p>
    </section>

    <section id="promote" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5 text-white" aria-label="Campaign social distribution example">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Step 3 · Promotion & social connections</p>
        <h2 className="mt-2 text-xl font-bold">Preview a cross-platform campaign post</h2>
        <p className="mt-2 text-sm text-slate-300">Choose a destination, then review or copy a post that follows the selected fictional scenario. This preview does not connect or publish to any third-party account.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Example social destination">
        {["Facebook","Instagram","Bluesky","Email"].map(destination=><button type="button" key={destination} aria-pressed={shareDestination===destination}
          onClick={()=>{setShareDestination(destination);setCopyState("");}}
          className={`min-h-11 rounded-xl border px-4 text-sm ${shareDestination===destination?"border-cyan-300 bg-cyan-400/15":"border-white/20"}`}>{destination}</button>)}
      </div>
      <div className={detailStyle}>
        <p className="text-xs font-bold text-cyan-200">{shareDestination} · NOT PUBLISHED · Sample only</p>
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-200">{shareText}</pre>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copyExample} className={linkStyle}>Copy fictional sample post</button>
        <Link to="/connections" target="_blank" rel="noopener noreferrer" className={linkStyle}>View real account connections</Link>
        <Link to="/social" target="_blank" rel="noopener noreferrer" className={linkStyle}>Explore iFund Social</Link>
        <a href="#sandbox-checkout" className={linkStyle}>Continue to PayPal test</a>
      </div>
      {copyState&&<p role="status" className="text-xs text-cyan-200">{copyState}</p>}
      <p className="text-xs text-slate-400">Connection and authorization status varies by platform. A preview is never evidence that an external social post was actually published.</p>
    </section>
  </div>;
}
