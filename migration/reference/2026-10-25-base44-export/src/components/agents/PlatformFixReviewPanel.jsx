import React, {useState} from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, RefreshCcw } from "lucide-react";
import BuilderExecutionControls from "@/components/agents/BuilderExecutionControls";

const fields=[
  ["analysis","Investigation and likely cause"],
  ["systemic_scope","Every shared feature or screen affected"],
  ["repair_plan","Platform-wide implementation plan"],
  ["verification_plan","Regression and live verification"],
  ["rollback_plan","Rollback and recovery plan"],
];
const editable=(incident)=>Object.fromEntries(fields.map(([key])=>[key,incident[key]||""]));
export default function PlatformFixReviewPanel(){
  const [records,setRecords]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState("");
  const [editing,setEditing]=useState({});
  const [readiness,setReadiness]=useState(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const load=async()=>{
    setBusy("load");setError("");
    try{
      const [response, capabilities] = await Promise.all([
        base44.functions.invoke("managePlatformIncidents",{mode:"list"}),
        base44.functions.invoke("manageApprovedBuilderExecution",{mode:"readiness"}).catch(()=>null),
      ]);
      if(!response.data?.ok)throw new Error("Not available");
      setReadiness(capabilities?.data?.ok ? capabilities.data : null);
      setRecords(response.data.incidents||[]);setLoaded(true);
      setEditing(Object.fromEntries((response.data.incidents||[]).map(x=>[x.id,editable(x)])));
    }catch{setError("Could not read the platform fix inbox. Confirm your super-admin access.");}
    finally{setBusy("");}
  };
  const act=async(incident,mode)=>{
    setBusy(incident.id);setError("");setMessage("");
    try{
      const input={mode,incident_id:incident.id,...(mode==="save_plan"?editing[incident.id]:{})};
      const response=await base44.functions.invoke("managePlatformIncidents",input);
      if(!response.data?.ok)throw new Error(response.data?.error||"Request was not confirmed");
      if(response.data.incident){
        setRecords(rows=>rows.map(row=>row.id===incident.id?response.data.incident:row));
      }else if(mode==="approve"){
        setRecords(rows=>rows.map(row=>row.id===incident.id?{
          ...row,status:response.data.dispatched?"builder_dispatched":"approved_queued",
          builder_execution_state:response.data.execution_state || "queued",
          builder_task_id:response.data.task_id
        }:row));
        setMessage(response.data.dispatched?
          "Approved plan submitted to the real Base44 builder; inspect source changes and tests before release.":
          "Approved plan queued, but the builder is not enabled or the request was rejected. No source change was confirmed.");
      }
    }catch{setError("The requested action was not confirmed. Refresh before retrying.");}
    finally{setBusy("");}
  };
  const active=records.filter(r=>r.status!=="verified_fixed"&&r.status!=="rejected");
  return <section className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3" aria-label="Platform-wide fix approvals">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="flex items-center gap-2 text-foreground"><ClipboardCheck className="w-4 h-4"/>Platform errors and fix plans</strong>
      <button type="button" disabled={!!busy} onClick={load}
        className="inline-flex gap-2 min-h-11 items-center rounded-lg border border-border text-foreground px-3 text-sm">
        <RefreshCcw className="h-4 w-4"/>{loaded?"Refresh":"Review issues"}
      </button>
    </div>
    <p className="text-sm text-muted-foreground">
      Grouped errors from across IFund. Review the evidence, write one reusable repair plan, then approve it for builder assignment.
    </p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {message&&<p role="status" className="text-sm text-foreground">{message}</p>}
    {loaded&&!active.length&&<p className="text-sm text-muted-foreground">No unresolved platform incidents found.</p>}
    {active.map(item=><details key={item.id} className="rounded-xl border border-border bg-background p-3">
      <summary className="cursor-pointer text-foreground font-medium">
        {item.route_pattern||"Unknown route"} · {item.error_kind} · {item.status}
        <span className="block text-xs font-normal text-muted-foreground mt-1">{item.occurrences||1} grouped observations · last seen {item.last_seen_at||"unknown"}</span>
      </summary>
      <div className="pt-3 space-y-3">
        <p className="text-sm text-muted-foreground">{item.error_summary||"Frontend failure"}</p>
        {fields.map(([key,label])=><label key={key} className="block space-y-1 text-sm text-foreground">
          <span className="font-medium">{label}</span>
          <textarea rows={key==="repair_plan"?4:2}
            disabled={!!item.builder_task_id||!!busy}
            value={editing[item.id]?.[key]??item[key]??""}
            onChange={e=>setEditing(prev=>({...prev,[item.id]:{...prev[item.id],[key]:e.target.value}}))}
            className="w-full resize-y rounded-lg border border-border bg-background p-3 text-foreground"/>
        </label>)}
        {item.builder_task_id&&<BuilderExecutionControls incident={item} readiness={readiness} onRefresh={load}/>}
        {item.builder_task_id&&<p className="text-sm text-muted-foreground">
          Builder task {item.builder_task_id}. {item.status==="builder_dispatched"?"Sent to builder.":"Queued for builder."}
          {" "}A verified source change, tests, and deployment are still required.
        </p>}
        {!item.builder_task_id&&fields.some(([key])=>(editing[item.id]?.[key]??"")!==(item[key]??""))&&<p className="text-xs text-muted-foreground">Save the latest changes before approval.</p>}
        {!item.builder_task_id&&<div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={()=>act(item,"save_plan")}
            className="min-h-11 rounded-lg border border-border px-3 text-foreground text-sm">Save reviewed plan</button>
          <button type="button" disabled={!!busy||item.status!=="plan_ready"||fields.some(([key])=>(editing[item.id]?.[key]??"")!==(item[key]??""))} onClick={()=>act(item,"approve")}
            className="min-h-11 rounded-lg bg-blue-700 text-white px-3 text-sm disabled:opacity-50">Approve and dispatch</button>
          <button type="button" disabled={!!busy} onClick={()=>act(item,"reject")}
            className="min-h-11 rounded-lg border border-border text-foreground px-3 text-sm">Reject</button>
        </div>}
      </div>
    </details>)}
  </section>;
}
