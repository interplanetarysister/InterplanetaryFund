import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";

const HANDLE=/^[a-zA-Z0-9_-]{3,32}$/;
export default function Onboarding() {
  const navigate=useNavigate();
  const [searchParams]=useSearchParams();
  const returnTo=safeReturnTo(searchParams.get("returnTo"));
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [handle,setHandle]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try{
        const client=authClient();
        const {data:{user},error:authError}=await client.auth.getUser();
        if(authError||!user)throw Error("You must sign in first.");
        const {data,error:profileError}=await client.from("ifund_profiles").select("display_name,handle").eq("id",user.id).maybeSingle();
        if(profileError)throw profileError;
        if(mounted){
          const suggested=String(user.user_metadata?.preferred_handle||"").trim();
          // A display hint, NOT a permission claim or pre-approved unique handle.
          setName(data?.display_name||"");
          setHandle(data?.handle||(HANDLE.test(suggested)?suggested:""));
        }
      }catch{if(mounted)setError("Your account could not be loaded.");}
      finally{if(mounted)setLoading(false);}
    })();
    return()=>{mounted=false;};
  },[]);
  async function save(){
    if(busy)return;
    setError("");
    if(name.trim().length>80 || !HANDLE.test(handle.trim())){
      setError("Choose a handle of 3–32 letters, numbers, underscores or hyphens. Keep your display name under 80 characters.");
      return;
    }
    setBusy(true);
    try{
      const client=authClient();
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError||!user)throw Error("Sign in to save this profile.");
      const {data:savedProfile,error:writeError}=await client.from("ifund_profiles").update({
        display_name:name.trim()||null,handle:handle.trim()
      }).eq("id",user.id).select("id,display_name,handle").maybeSingle();
      if(writeError?.code==="23505")throw Error("That username is already taken. Choose another handle.");
      if(writeError || savedProfile?.id!==user.id)throw Error("Profile save was not confirmed.");
      setStep(2);
    }catch(cause){setError(cause?.message||"Setup could not be saved.");}
    finally{setBusy(false);}
  }
  if(loading)return <main role="status" className="mx-auto max-w-2xl p-8">Loading account setup…</main>;
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
    <h1 className="font-display text-3xl font-bold">Welcome to Interplanetary Fund</h1>
    <p className="text-muted-foreground">Create your identity, start fundraising, and decide which connections you want to authorize.</p>
    <p className="text-sm text-muted-foreground">Step {step+1} of 6</p>
    {error&&<p role="alert" className="rounded-xl border border-destructive p-3 text-destructive">{error}</p>}
    {step===0&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your IFund journey</h2>
      <p>Build a fundraiser privately, publish your story when ready, explore causes, and manage connected platforms from one account.</p>
      <button type="button" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" onClick={()=>setStep(1)}>Set up my profile</button>
    </section>}
    {step===1&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your identity</h2>
      <label className="block">Display name<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" /></label>
      <label className="block">Public handle<input required value={handle} maxLength={32} onChange={e=>setHandle(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" /></label>
      <p className="text-sm text-muted-foreground">These fields are saved only to your authenticated IFund profile. Delegated AI authority is not granted by completing setup.</p>
      <div className="flex gap-3"><button type="button" onClick={()=>setStep(0)} className="rounded-xl border border-border px-4 py-2">Back</button>
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy?"Saving…":"Save identity"}</button></div>
    </section>}
    {step===2&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Meet your AI team</h2>
      <p>IFund has specialist workspaces for campaign writing, strategy, growth, communications and connection guidance. Each specialist is available only within its verified preview capabilities.</p>
      <Link to="/agents" className="inline-block rounded-xl border border-border px-5 py-3">Explore the AI workspace</Link>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={()=>setStep(2)} className="rounded-xl border border-border px-4 py-2">Back</button>
        <button type="button" onClick={()=>setStep(3)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Continue</button>
      </div>
    </section>}
    {step===3&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Connect your platforms</h2>
      <p>Review available connection methods and their current verification status. Opening the connections page does not connect an account or grant IFund permission.</p>
      <Link to="/connections" className="inline-block rounded-xl border border-border px-5 py-3">Review connections</Link>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={()=>setStep(3)} className="rounded-xl border border-border px-4 py-2">Back</button>
        <button type="button" onClick={()=>setStep(4)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Continue</button>
      </div>
    </section>}
    {step===4&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Automation stays under your control</h2>
      <p>Onboarding does not enable delegated access, scheduled actions, external publishing or provider changes. Each consequential action must have its own current permission and owner approval.</p>
      <p className="text-sm text-muted-foreground">You can review or revoke IFund connection-help permissions from the Connections workspace. No permission is granted by continuing this setup.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={()=>setStep(4)} className="rounded-xl border border-border px-4 py-2">Back</button>
        <button type="button" onClick={()=>setStep(5)} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Continue</button>
      </div>
    </section>}
    {step===5&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your profile is saved</h2>
      <p>Your account identity is ready. You can create a campaign, explore the current agent preview or review connections when you choose.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={()=>setStep(4)} className="rounded-xl border border-border px-4 py-2">Back</button>
        <button type="button" onClick={()=>navigate(returnTo,{replace:true})} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Finish setup</button>
        <Link to="/create" className="rounded-xl border border-border px-5 py-3">Create campaign</Link>
        <Link to="/connections" className="rounded-xl border border-border px-5 py-3">Connections</Link>
      </div>
    </section>}

  </main>;
}
