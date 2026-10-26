import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Network, ShieldCheck, Clock, BadgeCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const money=(amount,currency="USD")=>new Intl.NumberFormat(undefined,{style:"currency",currency:currency||"USD"}).format(Number(amount||0));

// Observation freshness: communicate whether a balance is provider-verified or
// owner-reported, and when it was last observed. Stale owner-reported figures
// must never be presented as freshly verified withdrawable funds.
const ObservationLabel=({source})=>{
  const providerVerified=source.data_source==='provider_verified';
  const stale=source.observation_stale===true;
  if(!source.observed_at){
    return <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/>Balance not yet checked by a provider</p>;
  }
  const age=formatDistanceToNow(new Date(source.observed_at),{addSuffix:true});
  if(providerVerified&&!stale){
    return <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5"><BadgeCheck className="w-3 h-3"/>Provider-verified · {age}</p>;
  }
  if(providerVerified&&stale){
    return <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/>Provider-verified but stale · {age}</p>;
  }
  return <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/>Owner-reported · {age}{stale?' · refresh recommended':''}</p>;
};

export default function CollectAndWithdrawDialog({ campaign, open, onOpenChange }) {
  const [preparing,setPreparing]=useState(false);
  const [authorizing,setAuthorizing]=useState(false);
  const [prepared,setPrepared]=useState(null);
  const [error,setError]=useState("");
  const prepare=async()=>{
    setPreparing(true); setError("");
    try {
      const {data}=await base44.functions.invoke("prepareCollectAndWithdraw",campaign?.id?{campaign_id:campaign.id}:{});
      if(!data?.ok) throw new Error("prepare rejected");
      setPrepared(data);
    } catch { setError("Connected-platform balances could not be prepared safely. Refresh the connections that need attention and try again."); }
    finally { setPreparing(false); }
  };
  const authorize=async()=>{
    setAuthorizing(true); setError("");
    try {
      const {data}=await base44.functions.invoke("authorizeCollectAndWithdraw",{authorization_id:prepared.authorization_id,confirm:true});
      if(!data?.ok) throw new Error("authorization rejected");
      const execution=await base44.functions.invoke("executeCollectAndWithdraw",{authorization_id:prepared.authorization_id});
      if(!execution.data?.ok) throw new Error("execution planning rejected");
      setPrepared((p)=>({...p,authorized:true,status:execution.data.status,sources:execution.data.sources||p.sources}));
    } catch { setError("The collection authorization could not be recorded. No external transfer was started."); }
    finally { setAuthorizing(false); }
  };
  const ready=(prepared?.sources||[]).filter(s=>s.status==="ready_for_authorization");
  const attention=(prepared?.sources||[]).filter(s=>s.status!=="ready_for_authorization");
  return <Dialog open={open} onOpenChange={(v)=>{onOpenChange(v);if(!v){setPrepared(null);setError("");}}}>
    <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-xl flex items-center gap-2"><Network className="w-5 h-5"/>Collect & Withdraw</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Bring supported external fundraiser balances into one withdrawal flow for <strong>{campaign?.title || "all of your campaigns"}</strong>.</p>
      {!prepared && <Button onClick={prepare} disabled={preparing} className="w-full rounded-xl">{preparing?<Loader2 className="w-4 h-4 animate-spin"/>:"Check connected funds"}</Button>}
      {prepared && <div className="space-y-3">
        {(prepared.sources||[]).length===0 && <div className="rounded-xl border p-4 text-sm text-muted-foreground">No connected fundraising sources are linked to this campaign yet.</div>}
        {(prepared.sources||[]).map(s=><div key={s.connection_id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
          <div><p className="font-medium capitalize">{s.platform}</p><p className="text-sm">{money(s.amount,s.currency)}</p><ObservationLabel source={s}/>{s.note&&<p className="text-xs text-muted-foreground mt-1">{s.note}</p>}</div>
          <Badge variant="outline">{s.status==="ready_for_authorization"?"Ready":"Action required"}</Badge>
        </div>)}
        {ready.length>0&&!prepared.authorized&&<div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 space-y-2">
          <p className="text-sm flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5"/>{prepared.confirmation}</p>
          <p className="text-xs text-muted-foreground">This authorization applies only to the listed sources in this collection operation. Provider verification or user-controlled security steps may still be required.</p>
          <Button onClick={authorize} disabled={authorizing} className="w-full rounded-xl">{authorizing?<Loader2 className="w-4 h-4 animate-spin"/>:"Allow collection from listed platforms"}</Button>
        </div>}
        {prepared.authorized&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">Authorization recorded and supported collection routing started. IFund will not count external money as collected until settlement is independently verified. Sources requiring provider action remain paused.</div>}
        {attention.length>0&&<p className="text-xs text-muted-foreground">{attention.length} source{attention.length===1?"":"s"} currently require provider or user action and will not be represented as collected.</p>}
      </div>}
      {error&&<p className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}