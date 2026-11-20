import {useCallback,useEffect,useState} from "react";
import {authClient} from "@/api/auth";

const FIELDS="id,owner_id,organization_name,website,proposal,state,public_status_message,submitted_at,reviewed_at";
const STATES=["submitted","reviewing","contacted","closed"];
export default function AdminSponsorInquiries(){
 const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [drafts,setDrafts]=useState({});
 const load=useCallback(async()=>{
   setError("");
   const client=authClient();
   const gate=await client.rpc("ifund_current_user_is_verified_super_admin");
   if(gate.error||gate.data!==true){setItems([]);setError("Verified super administrator access is required.");return;}
   const {data,error}=await client.from("ifund_sponsor_inquiries")
     .select(FIELDS).order("submitted_at",{ascending:false}).limit(100);
   if(error||!Array.isArray(data)){setItems([]);setError("Sponsor inquiries could not be loaded.");return;}
   setItems(data);
 },[]);
 useEffect(()=>{load();},[load]);
 async function review(item){
  if(busy)return;
  const next=drafts[item.id]||{state:item.state,message:item.public_status_message||""};
  if(!STATES.includes(next.state)||next.message.length>500)return setError("Choose a valid status and a message under 500 characters.");
  setBusy(item.id);setError("");setNotice("");
  try{
   const client=authClient();
   const gate=await client.rpc("ifund_current_user_is_verified_super_admin");
   if(gate.error||gate.data!==true)throw Error("Super administrator access could not be verified.");
   const {data,error}=await client.from("ifund_sponsor_inquiries")
    .update({state:next.state,public_status_message:next.message})
    .eq("id",item.id).eq("state",item.state)
    .select(FIELDS).single();
   if(error||data?.id!==item.id||data.state!==next.state)
      throw Error("Inquiry changed or the review was not saved. Reload and try again.");
   setNotice("Review state saved. No sponsorship or paid task was activated.");
   await load();
  }catch(e){setError(e?.message||"Review could not be saved.");}
  finally{setBusy("");}
 }
 return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
  <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Sponsor review</p>
   <h1 className="mt-2 text-3xl font-bold">Sponsor inquiries</h1>
   <p className="mt-2 text-sm text-muted-foreground">Review business proposals without granting approval or publishing offers. Sponsor identity, agreements, funding and provider-specific requirements have separate verification gates.</p>
  </header>
  <button type="button" onClick={load} disabled={!!busy} className="min-h-11 rounded-xl border border-border px-4">Reload inquiries</button>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {items.length===0&&!error&&<p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">No submitted sponsor inquiries are available.</p>}
  {items.map(item=>{
   const draft=drafts[item.id]||{state:item.state,message:item.public_status_message||""};
   return <article key={item.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-bold">{item.organization_name}</h2><span className="text-xs uppercase text-muted-foreground">{item.state}</span></div>
    <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{item.website}</a>
    <p className="whitespace-pre-wrap break-words text-sm">{item.proposal}</p>
    <p className="text-xs text-muted-foreground">Submitted {String(item.submitted_at).slice(0,10)}</p>
    <label className="block text-sm font-medium">Review state<select className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-background p-2" value={draft.state}
       onChange={e=>setDrafts(x=>({...x,[item.id]:{...draft,state:e.target.value}}))} disabled={!!busy}>
       {STATES.map(state=><option value={state} key={state}>{state}</option>)}</select></label>
    <label className="block text-sm font-medium">Message visible to applicant<textarea className="mt-1 w-full rounded-xl border border-input bg-background p-3" rows={3} maxLength={500} value={draft.message}
       onChange={e=>setDrafts(x=>({...x,[item.id]:{...draft,message:e.target.value}}))} disabled={!!busy}/></label>
    <button type="button" onClick={()=>review(item)} disabled={!!busy} className="min-h-11 rounded-xl bg-cyan-600 px-4 font-semibold text-white disabled:opacity-50">{busy===item.id?"Saving…":"Save review"}</button>
   </article>;
  })}
 </main>;
}
