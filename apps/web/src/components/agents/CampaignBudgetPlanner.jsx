import { useMemo,useState } from "react";
import { planCampaignBudget } from "@/lib/budgetPlanning.mjs";

const usd=cents=>Number.isSafeInteger(cents)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100):"Unavailable";
/** No saved budget, no API call and no assumption of PayPal clearing. */
export default function CampaignBudgetPlanner() {
  const [items,setItems]=useState([{id:"a",label:"Primary expenses",amount:""},{id:"b",label:"Other verified costs",amount:""}]);
  const plan=useMemo(()=>planCampaignBudget(items),[items]);
  function change(id,key,value){setItems(list=>list.map(row=>row.id===id?{...row,[key]:value}:row))}
  return <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label="POLARIS campaign budget planner">
    <h2 className="text-lg font-semibold">POLARIS · Campaign budget planner</h2>
    <p className="text-sm text-muted-foreground">Estimate expenses and a target that accounts for iFund's 7% fee at owner withdrawal. No payment is made, and this does not verify donor or processor fees.</p>
    {items.map((row,index)=><div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
      <label className="text-sm">Expense {index+1}
        <input value={row.label} maxLength={100} onChange={e=>change(row.id,"label",e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"/>
      </label>
      <label className="text-sm">USD amount
        <input type="text" inputMode="decimal" value={row.amount} placeholder="0.00"
          onChange={e=>change(row.id,"amount",e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"/>
      </label>
      <button type="button" disabled={items.length<=1} onClick={()=>setItems(rows=>rows.filter(x=>x.id!==row.id))}
        className="self-end min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40">Remove</button>
    </div>)}
    <button type="button" disabled={items.length>=20} onClick={()=>setItems(rows=>[...rows,{id:String(Date.now())+":"+rows.length,label:"",amount:""}])}
      className="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">Add expense</button>
    {plan.ready ? <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4">
      <div><dt className="text-xs text-muted-foreground">Total documented needs</dt><dd className="text-xl font-semibold">{usd(plan.targetCents)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Suggested gross target</dt><dd className="text-xl font-semibold">{usd(plan.suggestedGrossCents)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Estimated iFund fee</dt><dd className="font-semibold">{usd(plan.platformFeeEstimateCents)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Calculation only</dt><dd className="text-sm">Not an available balance</dd></div>
      <p className="col-span-2 text-xs text-muted-foreground">{plan.disclaimer}</p>
    </dl> : <p role="status" className="text-sm text-amber-700">{plan.error}</p>}
    <p className="text-xs text-muted-foreground">Keep receipts and confirm the actual provider terms. You must review and enter the chosen goal in your own campaign editor.</p>
  </section>;
}
