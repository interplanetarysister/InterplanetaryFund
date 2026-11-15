import { useState } from "react";
import { Leaf, RotateCcw } from "lucide-react";
const factors = [
  { id:"title",name:"Clear campaign title",weight:15,detail:"Explain the need in specific, accessible words." },
  { id:"summary",name:"Short summary",weight:15,detail:"Summarize the purpose and who benefits." },
  { id:"story",name:"Supporting story",weight:20,detail:"Describe circumstances in your own words with relevant context." },
  { id:"media",name:"Image permissions",weight:15,detail:"Choose accurate, consented and properly licensed images." },
  { id:"purpose",name:"Use of funds",weight:20,detail:"Explain what contributions would pay for, with realistic estimates." },
  { id:"sharing",name:"Sharing plan",weight:15,detail:"Plan respectful, consent-based outreach. Never promise success." },
];
export default function MobileReadiness() {
  const [done,setDone]=useState({});
  const score=factors.reduce((sum,f)=>sum+(done[f.id]?f.weight:0),0);
  return <div className="space-y-6">
    <header className="space-y-2"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-emerald-300"><Leaf aria-hidden="true" className="h-5 w-5"/> Campaign planning</p>
      <h1 className="text-3xl font-bold">Build a stronger story</h1>
      <p className="text-sm leading-6 text-slate-300">A practical checklist for preparing a campaign. Nothing entered here is sent to IFund or stored as a campaign.</p></header>
    <section className="rounded-2xl border border-emerald-300/30 bg-emerald-900/15 p-6" aria-label="Checklist completion">
      <div className="flex items-end justify-between"><span className="text-sm font-semibold text-slate-200">Planning completeness</span><strong className="text-4xl text-emerald-200" aria-live="polite">{score}%</strong></div>
      <progress aria-label="Campaign planning checklist completed" max="100" value={score} className="mt-4 h-3 w-full accent-emerald-300"/>
      <p className="mt-3 text-xs leading-5 text-slate-300">This is a weighted completion checklist, <strong>not</strong> a prediction of fundraising outcomes, campaign quality, likelihood of donations, or financial return.</p>
    </section>
    <fieldset className="space-y-3"><legend className="mb-3 text-lg font-bold">Your preparation steps</legend>
      {factors.map(f=><label key={f.id} className="flex min-h-20 cursor-pointer gap-4 rounded-xl border border-white/15 bg-white/5 p-4">
        <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-emerald-400" checked={!!done[f.id]} onChange={e=>setDone(p=>({...p,[f.id]:e.target.checked}))}/>
        <span className="flex-1"><strong className="block text-sm">{f.name} <span className="text-emerald-300">({f.weight}%)</span></strong><span className="mt-1 block text-xs leading-5 text-slate-300">{f.detail}</span></span>
      </label>)}
    </fieldset>
    <button type="button" onClick={()=>setDone({})} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300/40 px-4 py-2 text-sm font-semibold"><RotateCcw aria-hidden="true" className="h-4 w-4"/> Reset checklist</button>
    <p className="text-xs leading-6 text-slate-400">There is no automatic campaign publishing, payment collection, or background posting in this planning tool.</p>
  </div>;
}
