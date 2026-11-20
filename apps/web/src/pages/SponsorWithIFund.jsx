import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowUpRight,BriefcaseBusiness,Handshake,ShieldCheck} from "lucide-react";
import {authClient} from "@/api/auth";
import {useAuthSession} from "@/hooks/useAuthSession";

const inputClass="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base";
const SUBMISSION_FIELDS="id,owner_id,organization_name,website,proposal,state,public_status_message,submitted_at,reviewed_at";
export default function SponsorWithIFund(){
 const {user,status}=useAuthSession();
 const [name,setName]=useState(""),[website,setWebsite]=useState(""),[proposal,setProposal]=useState("");
 const [submitting,setSubmitting]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const [applications,setApplications]=useState([]),[loading,setLoading]=useState(false);
 const verified=Boolean(user?.id&&user?.email_confirmed_at&&user?.is_anonymous!==true);
 useEffect(()=>{
  let live=true;setApplications([]);
  if(!verified)return()=>{live=false;};
  setLoading(true);
  authClient().from("ifund_sponsor_inquiries").select(SUBMISSION_FIELDS)
   .eq("owner_id",user.id).order("submitted_at",{ascending:false}).limit(12)
   .then(({data,error})=>{if(live){if(error)setError("Saved sponsor inquiries are temporarily unavailable.");else setApplications(data||[]);}})
   .catch(()=>{if(live)setError("Saved sponsor inquiries could not be loaded.");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[user?.id,verified]);
 async function submit(event){
  event.preventDefault();
  if(!verified||submitting)return;
  setSubmitting(true);setNotice("");setError("");
  try {
   const client=authClient();
   const identity=await client.auth.getUser();
   if(identity.error||identity.data?.user?.id!==user.id||!identity.data?.user?.email_confirmed_at)
    throw Error("Please sign in with a verified email account.");
   const active=await client.rpc("ifund_current_account_is_active");
   if(active.error||active.data!==true)throw Error("An active IFund account is required.");
   const payload={owner_id:user.id,organization_name:name.trim(),website:website.trim(),proposal:proposal.trim()};
   const {data,error}=await client.from("ifund_sponsor_inquiries").insert(payload).select(SUBMISSION_FIELDS).single();
   if(error)throw Error(error.code==="23505"?"You've already submitted an inquiry for this organization.": "The inquiry could not be submitted. Check your details and retry.");
   const current=await client.auth.getUser();
   if(current.error||current.data?.user?.id!==user.id)throw Error("Your account changed. Reopen this page to verify the saved inquiry.");
   if(!data||data.owner_id!==user.id||data.organization_name!==payload.organization_name||data.state!=="submitted")
    throw Error("Your inquiry was submitted but its receipt could not be verified. Reload before resubmitting.");
   setApplications(items=>[data,...items]);setName("");setWebsite("");setProposal("");
   setNotice("Your sponsor inquiry was received. This is not a partnership approval, advertising contract, paid placement, or task activation.");
  }catch(cause){setError(cause?.message||"The inquiry could not be submitted.");}
  finally{setSubmitting(false);}
 }
 return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
  <header className="space-y-4 rounded-3xl border border-cyan-500/20 bg-slate-950 p-7 text-white sm:p-10">
   <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">For businesses and organizations</p>
   <h1 className="font-display text-3xl font-bold sm:text-5xl">Sponsor meaningful progress</h1>
   <p className="max-w-3xl text-base leading-7 text-slate-200">Explore opportunities to reach IFund members through clearly disclosed, useful tasks and supported Missions. We review proposals before any sponsor activity goes live.</p>
   <Link to="/fund-your-mission" className="inline-flex min-h-11 items-center gap-2 font-semibold text-cyan-300">See Fund Your Mission <ArrowUpRight size={17}/></Link>
  </header>
  <section className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
   <div className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8">
    <div className="flex items-center gap-3"><Handshake className="text-cyan-600" size={26}/><h2 className="text-xl font-bold">Introduce your organization</h2></div>
    <p className="text-sm text-muted-foreground">Share what kind of genuine, optional task or partnership you have in mind. No payment details are requested and nothing is posted automatically.</p>
    {status==="loading"?<p role="status">Checking your account…</p>:!verified?
      <div className="space-y-3 rounded-xl border border-border p-4">
       <p className="text-sm">Use a verified IFund account to submit a proposal and track its review. Exploring this page doesn't require an account.</p>
       <Link to="/register?returnTo=%2Fsponsor" className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white">Create an account</Link>
       <Link to="/login?returnTo=%2Fsponsor" className="ml-3 inline-flex min-h-11 items-center underline">Sign in</Link>
      </div>:
      <form className="space-y-4" onSubmit={submit}>
       <label className="block text-sm font-semibold">Organization name
        <input className={inputClass} minLength={2} maxLength={160} required value={name} onChange={e=>setName(e.target.value)} disabled={submitting}/></label>
       <label className="block text-sm font-semibold">Official HTTPS website
        <input className={inputClass} type="url" pattern="https://.*" placeholder="https://example.org" required value={website} onChange={e=>setWebsite(e.target.value)} disabled={submitting}/></label>
       <label className="block text-sm font-semibold">What kind of sponsorship or task would you like to propose?
        <textarea className="mt-2 w-full rounded-xl border border-input bg-background p-4 text-base" rows={5} minLength={30} maxLength={3000} required value={proposal} onChange={e=>setProposal(e.target.value)} disabled={submitting} placeholder="Describe the audience, task, reward approach and how completion could be verified."/></label>
       <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-50" disabled={submitting||!name.trim()||!website.startsWith("https://")||proposal.trim().length<30}>{submitting?"Sending for review…":"Submit sponsor inquiry"}</button>
      </form>}
    {notice&&<p role="status" className="rounded-xl border border-cyan-500/30 p-4 text-sm">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm">{error}</p>}
   </div>
   <aside className="space-y-4 rounded-3xl border border-border bg-card p-6">
    <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-600" size={26}/><h2 className="text-xl font-bold">Responsible sponsorship</h2></div>
    <p className="text-sm leading-6 text-muted-foreground">IFund evaluates sponsor identity, offer terms, eligible regions, fair compensation, prohibited incentives and funding before accepting any paid task.</p>
    <p className="text-sm leading-6 text-muted-foreground">Submitting a proposal does not establish an IFund partnership, authorize using another company's branding, or commit IFund to distribute offers.</p>
    <p className="text-sm leading-6 text-muted-foreground">We do not accept fake engagement, paid positive reviews, misleading testimonials, or tasks requiring a deposit just to unlock payment.</p>
   </aside>
  </section>
  {verified&&<section className="space-y-3" aria-label="Your sponsor inquiries">
    <h2 className="text-xl font-bold">Your saved inquiries</h2>
    {loading?<p role="status">Loading your inquiries…</p>:applications.length?
      <div className="grid gap-3">{applications.map(a=><article key={a.id} className="rounded-2xl border border-border bg-card p-4">
       <div className="flex flex-wrap justify-between gap-2"><strong>{a.organization_name}</strong><span className="text-xs font-semibold uppercase text-muted-foreground">{a.state}</span></div>
       <p className="mt-1 text-xs text-muted-foreground">Submitted {String(a.submitted_at).slice(0,10)}</p>
       {a.public_status_message&&<p className="mt-2 text-sm">{a.public_status_message}</p>}
      </article>)}</div>:<p className="text-sm text-muted-foreground">You have no submitted sponsor inquiries.</p>}
   </section>}
 </main>;
}
