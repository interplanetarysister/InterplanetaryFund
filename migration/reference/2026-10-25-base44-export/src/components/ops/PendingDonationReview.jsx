import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

export default function PendingDonationReview() {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const all=await base44.entities.Donation.filter({payment_verified:false},"-created_date",200);setRows(Array.isArray(all)?all:[]);}catch(_){setError("Pending donations could not be loaded.");}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const verify=async(row)=>{
    if(!window.confirm(`Verify that $${Number(row.amount||0).toLocaleString()} was independently confirmed as received? This will apply it to the campaign ledger.`)) return;
    setBusy(row.id);setError("");
    try{
      const {data}=await base44.functions.invoke("requestWithdrawal",{action:"clear",donation_id:row.id});
      if(data?.ok!==true||data?.cleared!==true) throw new Error("not cleared");
      setRows(current=>current.filter(item=>item.id!==row.id));
    }catch(_){setError("The donation could not be verified safely. No campaign balance was changed.");}
    finally{setBusy("");}
  };
  if(loading)return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-cyan-300"/></div>;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-100">Pending donation recovery</h2><p className="text-xs text-slate-400">Manual reports remain outside campaign totals until an administrator independently confirms receipt.</p></div><button type="button" onClick={load} className="min-h-10 px-3 rounded-xl border border-white/10 text-slate-300 flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Refresh</button></div>
    {error&&<p role="status" className="text-sm text-rose-300">{error}</p>}
    {rows.length===0?<p className="text-sm text-slate-300 py-8 text-center">No unverified donations are waiting for review.</p>:rows.map(row=><div key={row.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><div className="min-w-0"><p className="font-medium text-slate-100">{row.campaign_title||"Campaign"} · ${Number(row.amount||0).toLocaleString()}</p><p className="text-xs text-slate-400">{row.donor_name||"Anonymous"} · {row.payment_method||"manual"} · reported {row.created_date?new Date(row.created_date).toLocaleString():"date unavailable"}</p></div><button type="button" disabled={busy===row.id} onClick={()=>verify(row)} className="min-h-10 shrink-0 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 disabled:opacity-70 flex items-center gap-2">{busy===row.id?<Loader2 className="w-4 h-4 animate-spin"/>:<ShieldCheck className="w-4 h-4"/>}Verify received</button></div>)}
  </div>;
}
