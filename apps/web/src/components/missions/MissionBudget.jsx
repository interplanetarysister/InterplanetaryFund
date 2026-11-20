import {useEffect,useRef,useState} from "react";
import {Plus,Trash2,Wallet} from "lucide-react";
import {authClient} from "@/api/auth";
import {addMissionCost,listMissionCosts,removeMissionCost} from "@/api/missions";

const usd=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
const format=(minor)=>usd.format(Number(minor)/100);
const classes="min-w-0 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500";
export default function MissionBudget({missionId,ownerId}){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [label,setLabel]=useState("");
 const [amount,setAmount]=useState("");
 const [busy,setBusy]=useState(false);
 const live=useRef(0),saving=useRef(false);
 useEffect(()=>{
  let current=true;const generation=++live.current;
  setLoading(true);setItems([]);setError("");setNotice("");
  if(!ownerId){setLoading(false);return()=>{current=false;};}
  listMissionCosts(authClient(),missionId).then(rows=>{
   if(current&&generation===live.current){setItems(rows);}
  }).catch(e=>{if(current&&generation===live.current)setError(e.message||"Could not load estimates.");})
   .finally(()=>{if(current&&generation===live.current)setLoading(false);});
  return()=>{current=false;live.current++;};
 },[missionId,ownerId]);
 const total=items.reduce((sum,x)=>sum+Number(x.estimated_minor||0),0);
 async function save(e){
  e.preventDefault();
  if(saving.current||!label.trim()||!amount.trim())return;
  const generation=live.current;
  saving.current=true;setBusy(true);setError("");setNotice("");
  try{
   const row=await addMissionCost(authClient(),missionId,{label,amount});
   if(generation!==live.current)return;
   setItems(prev=>[...prev,row]);setLabel("");setAmount("");
   setNotice("Private estimate added. This is not an invoice or a fundraising goal.");
  }catch(e){if(generation===live.current)setError(e.message||"Estimate could not be added.");}
  finally{saving.current=false;if(generation===live.current)setBusy(false);}
 }
 async function remove(row){
  if(saving.current)return;
  const generation=live.current;
  saving.current=true;setBusy(true);setError("");setNotice("");
  try{
   await removeMissionCost(authClient(),missionId,row.id);
   if(generation!==live.current)return;
   setItems(prev=>prev.filter(x=>x.id!==row.id));
   setNotice("Estimate removed.");
  }catch(e){if(generation===live.current)setError(e.message||"Estimate could not be removed.");}
  finally{saving.current=false;if(generation===live.current)setBusy(false);}
 }
 return <section aria-label="Private Mission estimates" className="space-y-4 rounded-2xl border border-border bg-card p-5">
  <div className="flex items-center justify-between gap-3">
   <h2 className="flex items-center gap-2 text-lg font-semibold"><Wallet size={18}/>Your estimated costs</h2>
   {!loading&&<strong className="text-lg tabular-nums">{format(total)}</strong>}
  </div>
  <p className="text-sm text-muted-foreground">Plan what your Mission might cost. These amounts are your estimates, not verified expenses, donations, available assistance, or a recommended fundraising goal. You can pursue your Mission without raising money.</p>
  {loading&&<p role="status" className="text-sm text-muted-foreground">Loading private estimates…</p>}
  {error&&<p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-red-600">{error}</p>}
  {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
  {!loading&&<>
   {items.length===0&&<p className="text-sm text-muted-foreground">No estimated costs yet. Add one if your goal has a known expense.</p>}
   <ul className="divide-y divide-border">{items.map(row=><li key={row.id} className="flex items-center gap-3 py-3 text-sm">
    <span className="min-w-0 flex-1 break-words">{row.label}</span>
    <span className="tabular-nums font-semibold">{format(row.estimated_minor)}</span>
    <button type="button" disabled={busy} onClick={()=>remove(row)}
     aria-label={"Remove estimate: "+row.label} title="Remove estimate"
     className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
     <Trash2 size={16} aria-hidden="true"/>
    </button>
   </li>)}</ul>
   <form onSubmit={save} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end">
    <label className="space-y-1 text-xs font-semibold">What might cost money?
     <input value={label} maxLength={200} onChange={e=>setLabel(e.target.value)}
      placeholder="e.g. Materials" className={classes}/></label>
    <label className="space-y-1 text-xs font-semibold">Estimate (USD)
     <input value={amount} inputMode="decimal" maxLength={13}
      onChange={e=>setAmount(e.target.value)} placeholder="0.00"
      aria-describedby="whatif-budget-caution" className={classes}/></label>
    <button type="submit" disabled={busy||!label.trim()||!amount.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus size={17}/>Add estimate</button>
   </form>
   <p id="whatif-budget-caution" className="text-xs text-muted-foreground">Planning only. No payment or fundraising action is triggered by this estimate.</p>
  </>}
 </section>;
}