import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserCircle, LogOut, ShieldCheck, FolderKanban } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { blockedOrganizerIds, unblockOrganizer } from "@/mobile/organizerBlock";

export default function MobileStoreAccount() {
  const {status,user}=useAuthSession();
  const navigate=useNavigate();
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [blocked,setBlocked]=useState([]);
  const [blockStatus,setBlockStatus]=useState("loading");
  const [verifiedFor,setVerifiedFor]=useState(null);
  const [blockError,setBlockError]=useState("");
  const [blockBusy,setBlockBusy]=useState("");
  const [blockRefresh,setBlockRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    setBlocked([]);setBlockError("");setVerifiedFor(null);
    if(status==="loading"){setBlockStatus("loading");return()=>{active=false;};}
    if(!user?.id||user.is_anonymous){setVerifiedFor("guest");setBlockStatus("ready");return()=>{active=false;};}
    setBlockStatus("loading");
    blockedOrganizerIds().then(ids=>{
      if(active){setBlocked(ids);setVerifiedFor(user.id);setBlockStatus("ready");}
    }).catch(cause=>{
      if(active){setBlockError(cause?.message||"Cannot read organizer blocks.");setBlockStatus("error");}
    });
    return()=>{active=false;};
  },[user?.id,user?.is_anonymous,status,blockRefresh]);

  const blockPreferencesCurrent=verifiedFor===user?.id;
  async function unblock(id){
    if(blockBusy)return;
    setBlockBusy(id);setBlockError("");
    try{
      await unblockOrganizer(id);
      setBlocked(ids=>ids.filter(known=>known!==id));
    }catch(cause){setBlockError(cause?.message||"Unblock could not be verified.");}
    finally{setBlockBusy("");}
  }
  async function signOut(){
    setError("");setBusy(true);
    try{
      const {error:issue}=await authClient().auth.signOut();
      if(issue)throw issue;
      navigate("/");
    }catch(cause){setError(cause.message||"Sign-out failed.");}
    finally{setBusy(false);}
  }
  return <div className="space-y-6">
    <header className="space-y-2"><h1 className="flex items-center gap-3 text-3xl font-bold"><UserCircle aria-hidden="true" className="h-8 w-8 text-emerald-200"/> Your account</h1>
      <p className="text-sm leading-6 text-slate-300">Your account and published campaign records use the same live IFund backend as the website. No second profile is created.</p>
    </header>
    {status==="loading"?<p role="status">Checking your account…</p>:
     !user?<section className="space-y-4 rounded-2xl border border-emerald-300/20 bg-white/5 p-6">
       <h2 className="text-lg font-bold">Sign in to IFund</h2>
       <p className="text-sm text-slate-300">Browsing campaigns and planning a story do not require an account. Sign in to see your own campaign list and submit account requests.</p>
       <div className="flex flex-wrap gap-3"><Link to="/login" className="inline-flex min-h-12 items-center rounded-xl bg-emerald-200 px-5 font-bold text-slate-950">Sign in</Link>
         <Link to="/register" className="inline-flex min-h-12 items-center rounded-xl border border-emerald-300/40 px-5 font-semibold">Create account</Link></div>
     </section>:
     <section className="space-y-4 rounded-2xl border border-emerald-300/20 bg-white/5 p-6">
       <p className="text-xs uppercase tracking-widest text-emerald-300">Signed in</p>
       <h2 className="break-words text-lg font-bold">{user.email||"Your IFund account"}</h2>
       <Link to="/campaigns" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 p-3"><FolderKanban aria-hidden="true" className="h-5 w-5"/> Review your campaigns</Link>
       <Link to="/delete-account" className="flex min-h-12 items-center gap-3 rounded-xl border border-rose-300/30 p-3 text-rose-200"><ShieldCheck aria-hidden="true" className="h-5 w-5"/> Request account and data deletion</Link>
       <section className="space-y-3 rounded-xl border border-white/20 p-4" aria-label="Blocked organizers">
         <h3 className="font-semibold">Blocked organizers</h3>
         <p className="text-sm text-slate-300">Your blocked organizer list is saved securely with your IFund account and applies on your signed-in devices. Organizer IDs are shown here only to you.</p>
         {(blockStatus==="loading"||(!blockPreferencesCurrent&&blockStatus==="ready"))&&<p role="status" className="text-sm">Checking organizer safety preferences…</p>}
         {blockStatus==="error"&&<p role="alert" className="text-sm text-rose-200">{blockError}</p>}
         {blockStatus==="error"&&<button type="button" onClick={()=>setBlockRefresh(n=>n+1)} className="min-h-11 rounded-lg border border-rose-300/40 px-4 text-sm">Retry safety settings</button>}
         {blockStatus==="ready"&&blockPreferencesCurrent&&<>
           <p className="text-sm text-slate-300">{blocked.length} organizers blocked</p>
           {blocked.length===0&&<p className="text-xs text-slate-400">There are no blocked organizers.</p>}
           <ul className="space-y-2">{blocked.map(id=><li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2">
             <span className="break-all text-xs text-slate-300" aria-label="Blocked organizer reference">{id}</span>
             <button type="button" disabled={!!blockBusy} onClick={()=>unblock(id)} className="min-h-11 rounded-lg border border-white/40 px-4 text-sm disabled:opacity-50">{blockBusy===id?"Unblocking…":"Unblock"}</button>
           </li>)}</ul>
           {blockError&&<p role="alert" className="text-sm text-rose-200">{blockError}</p>}
         </>}
       </section>
       <button type="button" onClick={signOut} disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm disabled:opacity-50"><LogOut aria-hidden="true" className="h-5 w-5"/> {busy?"Signing out…":"Sign out"}</button>
       {error&&<p role="alert" className="text-sm text-rose-200">{error}</p>}
     </section>}
    <section className="space-y-3 rounded-2xl border border-white/15 p-5 text-sm">
      <h2 className="font-bold">Your privacy controls</h2>
      <p className="leading-6 text-slate-300">Read how campaign information, personal details and third-party connections are processed, or request access to or deletion of account data.</p>
      <div className="flex flex-wrap gap-4"><Link to="/privacy" className="text-emerald-200 underline">Privacy policy</Link><Link to="/delete-account" className="text-emerald-200 underline">Delete account</Link><Link to="/help" className="text-emerald-200 underline">Contact support</Link></div>
    </section>
  </div>;
}
