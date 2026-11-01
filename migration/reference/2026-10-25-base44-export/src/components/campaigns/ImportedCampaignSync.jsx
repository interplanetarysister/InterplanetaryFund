import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

export default function ImportedCampaignSync({ campaign, onSynced }) {
  const [record,setRecord]=useState(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{let live=true;(async()=>{
    const rows=await base44.entities.ExternalCampaignImport.filter({campaign_id:campaign.id},"-updated_date",1).catch(()=>[]);
    if(live) setRecord(rows?.[0]||null);
  })();return()=>{live=false}},[campaign.id]);
  if(!record) return null;
  const refresh=async()=>{
    setBusy(true); setMessage("");
    try{
      const synced=await base44.functions.invoke("syncImportedCampaign",{import_id:record.id,request_id:crypto.randomUUID()});
      if(!synced.data?.ok) throw new Error("sync");
      const locked=synced.data.locally_locked_fields?.length||0;
      setMessage(locked ? "Updated from "+record.platform+". "+locked+" locally edited field"+(locked===1?" was":"s were")+" preserved." : "Updated from "+record.platform+".");
      onSynced?.();
    }catch{
      setMessage("The external campaign could not be refreshed. Your IFund campaign was left unchanged.");
    }finally{setBusy(false)}
  };
  return <div className="bg-white rounded-2xl border border-stone-200/70 p-4 shadow-sm">
    <p className="font-semibold text-stone-900">Imported from <span className="capitalize">{record.platform}</span></p>
    <p className="text-xs text-stone-500 mt-1">Only refreshes when you press the button. Fields you changed in IFund stay unchanged.</p>
    <Button variant="outline" onClick={refresh} disabled={busy} className="w-full rounded-xl mt-3">
      {busy?<Loader2 className="w-4 h-4 mr-2 animate-spin"/>:<RefreshCw className="w-4 h-4 mr-2"/>}Refresh imported campaign
    </Button>
    {message&&<p className="text-xs text-stone-600 mt-2">{message}</p>}
  </div>;
}