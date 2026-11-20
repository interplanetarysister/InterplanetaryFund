import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../api/auth.js";
import { listExternalFundingHub, linkExternalFundraiser, setExternalReportedAmount, removeExternalFundingSource } from "../api/externalFundingHub.js";
import { identifyExternalFundraiser, suggestedFundraiserTitle, FUNDRAISER_PROVIDERS, groupReportedTotals } from "../lib/externalFundingHub.mjs";

const formatAmount = (n,currency) => new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(n)/100);
export default function ExternalFundingHub() {
  const [hub,setHub]=useState({groups:[],sources:[]}),[loading,setLoading]=useState(true);
  const [link,setLink]=useState(""),[group,setGroup]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
  const [editing,setEditing]=useState(null),[amount,setAmount]=useState(""),[currency,setCurrency]=useState("USD");
  async function reload(){const x=await listExternalFundingHub(authClient());setHub(x);setLoading(false);}
  useEffect(()=>{let mounted=true;listExternalFundingHub(authClient()).then(x=>{if(mounted){setHub(x);setLoading(false);}}).catch(()=>{if(mounted){setStatus("The hub is unavailable. Try again.");setLoading(false);}});return ()=>{mounted=false;};},[]);
  async function add(e){e.preventDefault();setBusy(true);setStatus("");
    try {const found=identifyExternalFundraiser(link),client=authClient();
      const result=await linkExternalFundraiser(client,{groupId:group||null,platform:found.platform,url:found.url,title:suggestedFundraiserTitle(link)});
      setLink("");setGroup("");await reload();setStatus(result.alreadyLinked?"This fundraiser is already in your IFund hub.":"Your fundraiser is in your hub.");
    }catch(e){setStatus(e.message||"Could not add that fundraiser.");}finally{setBusy(false);}
  }
  async function update(source){setBusy(true);setStatus("");try{
    await setExternalReportedAmount(authClient(),source,amount,currency);
    await reload();setEditing(null);setStatus("Your reported total was saved.");
  }catch(e){setStatus(e.message||"Could not save your total.");}finally{setBusy(false);}}
  async function remove(source){setBusy(true);setStatus("");try{
    await removeExternalFundingSource(authClient(),source);await reload();setStatus("Link removed.");
  }catch(e){setStatus(e.message||"Could not remove the link.");}finally{setBusy(false);}}
  const totals=groupReportedTotals(hub.sources);
  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Your fundraising universe</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">All your fundraisers. One beautiful place.</h1>
      <p className="max-w-2xl text-muted-foreground">Already fundraising somewhere else? Paste its link. IFund will organize it here while donations continue on the original website.</p>
    </header>
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-8">
      <form onSubmit={add} className="space-y-3">
        <label htmlFor="external-link" className="font-semibold">Paste your fundraiser link</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="external-link" type="url" required value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…" className="min-h-12 min-w-0 flex-1 rounded-xl border border-input bg-background px-4" />
          <button disabled={busy||!link.trim()} type="submit" className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">Add to IFund</button>
        </div>
        {hub.groups.length>0&&<details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Another link for a fundraiser you're already tracking?</summary>
          <select aria-label="Group with an existing fundraiser" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" value={group} onChange={e=>setGroup(e.target.value)}>
            <option value="">No, start a new fundraiser</option>
            {hub.groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </details>}
      </form>
      {status&&<p role="status" className="mt-3 text-sm">{status}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Supports GoFundMe, Givebutter and FundRazr links. Adding a URL does not connect your host account or automatically retrieve donations.</p>
    </section>
    {loading?<p role="status">Loading your fundraising hub…</p>:<>
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card to-primary/10 p-6" aria-label="Reported fundraising totals">
        <h2 className="text-sm font-semibold text-muted-foreground">Your reported fundraising total</h2>
        {Object.entries(totals).length?<div className="mt-3 flex flex-wrap gap-4">{Object.entries(totals).map(([c,n])=><p className="text-3xl font-bold tabular-nums" key={c}>{formatAmount(n,c)}</p>)}</div>:<p className="mt-3 text-xl font-semibold">Add a fundraiser to begin</p>}
        <p className="mt-3 text-xs text-muted-foreground">Figures entered by you, not verified by external hosts. Different currencies stay separate. These are not IFund payment receipts or withdrawable funds.</p>
      </section>
      {hub.groups.filter(g=>hub.sources.some(s=>s.group_id===g.id)).map(g=><section key={g.id} className="rounded-2xl border border-border bg-card p-5" aria-label={"Fundraiser "+g.title}>
        <h2 className="text-xl font-bold">{g.title}</h2>
        <div className="mt-4 space-y-3">{hub.sources.filter(s=>s.group_id===g.id).map(s=><div key={s.id} className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div>
            <p className="font-semibold">{FUNDRAISER_PROVIDERS[s.platform]?.label||s.platform}</p>
            <a href={s.campaign_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Open fundraiser</a>
            <p className="mt-2 text-lg font-semibold">{s.amount_cents==null?"Total not entered":formatAmount(s.amount_cents,s.currency)}</p>
            <p className="text-xs text-muted-foreground">Owner-reported, not provider-verified</p>
          </div><div className="flex gap-2">
            <button disabled={busy} onClick={()=>{setEditing(s.id);setAmount(s.amount_cents==null?"":(Number(s.amount_cents)/100).toFixed(2));setCurrency(s.currency);}} className="min-h-11 rounded-lg border px-3 text-sm">Update total</button>
            <button disabled={busy} onClick={()=>remove(s)} aria-label={"Remove "+s.platform+" link"} className="min-h-11 rounded-lg border px-3 text-sm">Remove</button>
          </div></div>
          {editing===s.id&&<form onSubmit={e=>{e.preventDefault();update(s);}} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-background p-3">
            <label className="flex-1 text-sm">Amount displayed on that site<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3"/></label>
            <label className="text-sm">Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-1 min-h-11 rounded-lg border bg-card px-2">{["USD","CAD","GBP","EUR","AUD"].map(c=><option key={c}>{c}</option>)}</select></label>
            <button disabled={busy} type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground">Save</button>
            <button type="button" onClick={()=>setEditing(null)} className="min-h-11 rounded-lg border px-3">Cancel</button>
          </form>}
        </div>)}</div>
      </section>)}
      <p className="text-sm"><Link to="/connections" className="text-primary underline">Connect your social accounts</Link> to prepare sharing. Authorized publishing follows each host's requirements and your saved IFund preferences.</p>
    </>}
  </main>;
}
