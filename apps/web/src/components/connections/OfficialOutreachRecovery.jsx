import {useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {authClient} from "@/api/auth";
import {OFFICIAL_OUTREACH_COPY,fetchOfficialOutreachCandidates,reviewOfficialOutreachCandidate} from "@/lib/officialOutreach.mjs";
import { socialComposeTargets } from "@/lib/socialComposeTargets.mjs";
import {CheckCircle2,ClipboardCopy,ExternalLink,RefreshCw,ShieldAlert} from "lucide-react";
const MODES=[["unverified","Unverified lead"],["needs_login","Needs account login"],["provider_verification_required","Needs provider approval"],["unsupported","Unavailable / unsupported"]];
const LABEL={historical_active:"Historically marked active",historical_pending:"Historically pending"};
const ORIGIN="https://github.com/interplanetarysister/interplanetaryfund1/blob/main/src/components/PlatformAccountsSheet.tsx";
export default function OfficialOutreachRecovery(){
 const [rows,setRows]=useState([]);
 const [state,setState]=useState("loading");
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [notes,setNotes]=useState({});
 const [statuses,setStatuses]=useState({});
 const mounted=useRef(false),lock=useRef(false);
 const refresh=useCallback(async()=>{
  setState("loading");setError("");
  try{
   const list=await fetchOfficialOutreachCandidates(authClient());
   if(!mounted.current)return;
   setRows(list);
   setStatuses(Object.fromEntries(list.map(r=>[r.provider,r.review_status])));
   setNotes(Object.fromEntries(list.map(r=>[r.provider,r.verification_notes||""])));
   setState("ready");
  }catch(e){if(mounted.current){setError(e.message||"Private recovery inventory unavailable.");setState("error");}}
 },[]);
 useEffect(()=>{mounted.current=true;refresh();return()=>{mounted.current=false}},[refresh]);
 async function save(row){
  if(lock.current)return;
  lock.current=true;setBusy(row.provider);setNotice("");setError("");
  try{
   const saved=await reviewOfficialOutreachCandidate(authClient(),{
     provider:row.provider,status:statuses[row.provider],notes:notes[row.provider]||""
   });
   if(!mounted.current)return;
   setRows(all=>all.map(r=>r.provider===saved.provider?saved:r));
   setNotice("Recovery review saved for "+row.display_name+". No provider publishing permission was granted.");
  }catch(e){if(mounted.current)setError(e.message||"Review failed.");}
  finally{lock.current=false;if(mounted.current)setBusy("");}
 }
 async function copyText(value,label){
  try{await navigator.clipboard.writeText(value);setNotice(label+" copied. Review the destination and its posting rules before sharing.");setError("");}
  catch{setError("Clipboard unavailable. Select the text and copy it manually.");}
 }
 return <section aria-label="Official account recovery" className="space-y-5 rounded-2xl border border-cyan-400/25 bg-card p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
     <div className="max-w-2xl space-y-2">
       <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-300">NEXUS · ECHO · PULSE</p>
       <h2 className="text-xl font-bold">Official outreach account recovery</h2>
       <p className="text-sm text-muted-foreground">Historical account leads recovered from the legacy repository. A listed profile, login email or old “active” label does not verify ownership or authorize an agent to publish. Only fresh provider authorization and approved posting rights do.</p>
     </div>
     <button type="button" onClick={refresh} disabled={state==="loading"||Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16}/>Refresh</button>
   </div>
   {error&&<p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-red-600">{error}</p>}
   {notice&&<p role="status" className="rounded-lg border border-cyan-500/30 p-3 text-sm">{notice}</p>}
   <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
     <p className="flex items-center gap-2 font-semibold"><ShieldAlert aria-hidden="true" size={18}/>No automated posting permission yet</p>
     <p className="mt-1 text-muted-foreground">These entries are recovery leads. No passwords or access tokens are stored here. Published posts require a real authorized account, the applicable permissions and review of the outgoing message. Do not create duplicate profiles or send mass unsolicited messages.</p>
   </div>
   {state==="loading"&&<p role="status">Loading private account leads…</p>}
   {state==="ready"&&<div className="grid gap-3 md:grid-cols-2">
     {rows.map(row=><article key={row.provider} className="space-y-3 rounded-xl border border-border bg-background/70 p-4">
       <div className="flex flex-wrap items-start justify-between gap-2">
         <div><h3 className="font-bold">{row.display_name} <span className="font-normal text-muted-foreground">· {row.provider}</span></h3><p className="text-xs text-muted-foreground">{row.historical_handle}</p></div>
         <span className="rounded-full border border-border px-2 py-1 text-xs">{LABEL[row.legacy_claim]}</span>
       </div>
       <dl className="space-y-1 text-xs">
         <div><dt className="inline font-semibold">Historical login email: </dt><dd className="inline break-all">{row.historical_login_email}</dd></div>
         <div><dt className="inline font-semibold">Verified official account grants: </dt><dd className="inline">{row.verified_provider_connections}</dd></div>
       </dl>
       <div className="flex flex-wrap gap-4 text-xs">
        {row.historical_url&&<a href={row.historical_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline">Inspect historical link <ExternalLink size={13}/></a>}
        <a href={ORIGIN} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Legacy source</a>
        {row.provider!=="whatsapp"&&<Link to={"/connections?platform="+encodeURIComponent(row.provider)} className="inline-flex min-h-11 items-center font-semibold text-primary underline">Open iFund connection flow</Link>}
       </div>
       <label className="block text-xs font-semibold" htmlFor={"outreach-review-"+row.provider}>Review stage</label>
       <select id={"outreach-review-"+row.provider} className="min-h-11 w-full rounded-xl border bg-background px-3 text-sm" value={statuses[row.provider]||"unverified"} onChange={e=>setStatuses(v=>({...v,[row.provider]:e.target.value}))}>
         {MODES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
       </select>
       <label className="block text-xs font-semibold" htmlFor={"outreach-notes-"+row.provider}>Verification notes (no passwords or tokens)</label>
       <textarea id={"outreach-notes-"+row.provider} rows={2} maxLength={700} value={notes[row.provider]||""} onChange={e=>setNotes(v=>({...v,[row.provider]:e.target.value}))} className="w-full rounded-xl border bg-background p-3 text-sm" placeholder="Describe the next provider approval or login step."/>
       <button type="button" disabled={Boolean(busy)||(!statuses[row.provider])} onClick={()=>save(row)} className="min-h-11 rounded-xl border border-cyan-500/50 px-4 text-sm font-semibold disabled:opacity-50">{busy===row.provider?"Saving…":"Save review, no publishing grant"}</button>
     </article>)}
   </div>}
   {state==="ready"&&rows.length===0&&<p className="text-sm text-muted-foreground">No historical account leads available.</p>}
   <div className="space-y-3">
     <h3 className="text-lg font-bold">Official description and outreach copy</h3>
     <p className="text-sm text-muted-foreground">Reviewed language for sharing iFund’s actual purpose. ECHO prepares educational posts, PULSE coordinates appropriate outreach, and NEXUS tracks review. These templates are not claims of live integrations, guaranteed donations or confirmed partnerships.</p>
     {Object.entries(OFFICIAL_OUTREACH_COPY).map(([key,body])=><article key={key} className="space-y-3 rounded-xl border border-border p-4">
       <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold capitalize">{key==="short"?"Short introduction":key==="about"?"What iFund does":"Partner / funder introduction"}</h4>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold" onClick={()=>copyText(body,key+" introduction")}><ClipboardCopy size={16}/>Copy for review</button>
       </div>
       <p className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
       {key==="short"&&<div className="flex flex-wrap gap-3">
         {socialComposeTargets(body).map(target=><a key={target.id} href={target.href}
           rel="noopener noreferrer" target="_blank"
           className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-primary">
           {target.label}<ExternalLink size={14}/>
         </a>)}
       </div>}
     </article>)}
   </div>
   <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 aria-hidden="true" size={16}/>Source inventory and drafting are available without granting external platform credentials.</div>
 </section>;
}
