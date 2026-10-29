import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";

const HANDLE=/^[a-zA-Z0-9_-]{3,32}$/;
export default function Onboarding() {
  const navigate=useNavigate();
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
    if(name.trim().length>100 || (handle.trim()&&!HANDLE.test(handle.trim()))){
      setError("Use a display name under 100 characters and a handle of 3–32 letters, numbers, underscores or hyphens.");
      return;
    }
    setBusy(true);
    try{
      const client=authClient();
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError||!user)throw Error("Sign in to save this profile.");
      const {error:writeError}=await client.from("ifund_profiles").upsert({
        id:user.id,display_name:name.trim()||null,handle:handle.trim()||null
      },{onConflict:"id"});
      if(writeError?.code==="23505")throw Error("That username is already taken. Choose another handle.");
      if(writeError)throw Error("Profile save was not confirmed.");
      setStep(2);
    }catch(cause){setError(cause?.message||"Setup could not be saved.");}
    finally{setBusy(false);}
  }
  if(loading)return <main role="status" className="mx-auto max-w-2xl p-8">Loading account setup…</main>;
  return <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
    <h1 className="font-display text-3xl font-bold">Welcome to Interplanetary Fund</h1>
    <p className="text-muted-foreground">Create your identity, start fundraising, and decide which connections you want to authorize.</p>
    <p className="text-sm text-muted-foreground">Step {step+1} of 3</p>
    {error&&<p role="alert" className="rounded-xl border border-destructive p-3 text-destructive">{error}</p>}
    {step===0&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your IFund journey</h2>
      <p>Build a fundraiser privately, publish your story when ready, explore causes, and manage connected platforms from one account.</p>
      <button type="button" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" onClick={()=>setStep(1)}>Set up my profile</button>
    </section>}
    {step===1&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your identity</h2>
      <label className="block">Display name<input value={name} maxLength={100} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" /></label>
      <label className="block">Public handle<input value={handle} maxLength={32} onChange={e=>setHandle(e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" /></label>
      <p className="text-sm text-muted-foreground">These fields are saved only to your authenticated IFund profile. Delegated AI authority is not granted by completing setup.</p>
      <div className="flex gap-3"><button type="button" onClick={()=>setStep(0)} className="rounded-xl border border-border px-4 py-2">Back</button>
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy?"Saving…":"Save identity"}</button></div>
    </section>}
    {step===2&&<section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Your profile is saved</h2>
      <p>Connect other platforms only when their provider consent and authorization services are verified. No AI delegation or external posting is activated by this setup.</p>
      <div className="flex flex-wrap gap-3"><Link to="/create" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Create campaign</Link><Link to="/connections" className="rounded-xl border border-border px-5 py-3">Connections</Link><Link to="/dashboard" className="rounded-xl border border-border px-5 py-3">Dashboard</Link></div>
    </section>}
    <Link to="/dashboard" className="inline-block text-sm underline">Skip setup</Link>
  </main>;
}
