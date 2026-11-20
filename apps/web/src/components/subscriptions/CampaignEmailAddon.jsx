import {useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {AtSign,CheckCircle2,ShieldCheck,Loader2} from "lucide-react";
import {authClient} from "@/api/auth";
import {readEmailAddon,selectEmailAddon,linkCampaignEmail,readEmailAddonCheckoutReadiness,IFUND_EMAIL_DOMAIN} from "@/lib/campaignEmailAddon.mjs";
import {listOwnerCampaigns} from "@/api/ownerCampaigns";

// Requests a reserved address only. The backend independently checks a real
// active paid plan and separate provider-verified addon payment and routing.
export default function CampaignEmailAddon(){
 const [phase,setPhase]=useState("loading");
 const [status,setStatus]=useState(null);
 const [handle,setHandle]=useState("");
 const [optIn,setOptIn]=useState(false);
 const [campaigns,setCampaigns]=useState([]);
 const [linkedCampaign,setLinkedCampaign]=useState("");
 const [linkBusy,setLinkBusy]=useState(false);
 const [campaignError,setCampaignError]=useState("");
 const [checkoutStatus,setCheckoutStatus]=useState(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const generation=useRef(0);
 const alive=useRef(true);
 const refresh=useCallback(async()=>{
   const generationNumber=++generation.current;
   setPhase("loading");setError("");
   try{
     const result=await readEmailAddon(authClient());
     if(!alive.current||generationNumber!==generation.current)return;
     setStatus(result);setHandle(result.requested_handle||"");
     setOptIn(result.opted_in);setLinkedCampaign(result.linked_campaign_id||"");setPhase("ready");
     readEmailAddonCheckoutReadiness(authClient()).then(ready=>{
       if(alive.current&&generationNumber===generation.current)setCheckoutStatus(ready);
     }).catch(()=>{if(alive.current&&generationNumber===generation.current)setCheckoutStatus(null);});
     setCampaignError("");
     if(result.eligible && result.opted_in){
       listOwnerCampaigns(authClient()).then(rows=>{
         if(alive.current&&generationNumber===generation.current)setCampaigns(rows);
       }).catch(()=>{if(alive.current&&generationNumber===generation.current)
         setCampaignError("Your campaigns could not be loaded. Refresh before linking an address.");});
     } else setCampaigns([]);
   }catch(e){
     if(alive.current&&generationNumber===generation.current){
       setPhase("unavailable");setError(e?.message||"Email add-on status unavailable.");
     }
   }
 },[]);
 useEffect(()=>{alive.current=true;refresh().catch(()=>{});return()=>{
   alive.current=false;generation.current++;
 };},[refresh]);
 async function save(event){
   event.preventDefault();
   if(busy||phase!=="ready")return;
   setBusy(true);setError("");setNotice("");
   try{
     const latest=await selectEmailAddon(authClient(),{optIn,handle});
     if(!alive.current)return;
     setStatus(latest);setOptIn(latest.opted_in);
     setHandle(latest.requested_handle||"");
     setLinkedCampaign(latest.linked_campaign_id||"");
     if(latest.opted_in){
       listOwnerCampaigns(authClient()).then(rows=>{if(alive.current)setCampaigns(rows);})
         .catch(()=>{if(alive.current)setCampaignError("Could not load your owned campaigns.");});
     }else setCampaigns([]);
     setNotice(!latest.opted_in
       ?"Email add-on disabled. Your reserved address cannot receive campaign messages."
       :latest.active
         ?"Your provider-verified campaign email identity is active."
         :"Your address preference is reserved. Email delivery is NOT active. The separately billed $1/month add-on and address routing must be verified before use.");
   }catch(e){if(alive.current)setError(e?.message||"Email add-on selection was not saved.");}
   finally{if(alive.current)setBusy(false);}
 }
 async function connectCampaign(event){
   event.preventDefault();
   if(busy||linkBusy||!status?.opted_in)return;
   setLinkBusy(true);setError("");setNotice("");
   try{
     const updated=await linkCampaignEmail(authClient(),{campaignId:linkedCampaign||null});
     if(!alive.current)return;
     setStatus(updated);setLinkedCampaign(updated.linked_campaign_id||"");
     setNotice(updated.linked_campaign_id
       ?"Campaign connection saved and confirmed. Incoming mail will be associated with your selected campaign only after paid mailbox activation."
       :"Campaign link cleared. Your email add-on selection remains unchanged.");
   }catch(cause){if(alive.current)setError(cause?.message||"Campaign connection could not be saved.");}
   finally{if(alive.current)setLinkBusy(false);}
 }
 const eligible=status?.eligible===true;
 const active=status?.active===true && status?.can_receive_email===true;
 const basic=status?.paid_tier==="basic";
 const saved=status?.opted_in===true;
 return <section aria-label="Campaign email add-on" className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-card p-5 sm:p-7">
   <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full border border-cyan-400/20 shadow-[0_0_0_35px_rgba(53,213,219,0.04),0_0_0_70px_rgba(131,98,225,0.04)]"/>
   <div className="relative space-y-4">
     <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="flex items-start gap-3">
         <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10"><AtSign aria-hidden="true" className="size-6 text-cyan-500"/></div>
         <div><h2 className="text-xl font-bold">Your iFund campaign email</h2>
           <p className="mt-1 max-w-xl text-sm text-muted-foreground">Request a unique @interplanetaryfund.com address to associate with your campaign connections and account inbox. This is an optional paid-plan feature, not a separate iFund login.</p></div>
       </div>
       <span className="rounded-full border border-border px-3 py-1.5 text-xs font-bold">{active?"Active":saved?"Awaiting activation":"Optional"}</span>
     </div>
     <div className="rounded-xl border border-border bg-background/70 p-4">
       <p className="font-semibold">Basic subscriber add-on <span className="text-xl text-cyan-600">+$1/month</span></p>
       <p className="mt-1 text-xs text-muted-foreground">Requires an existing, provider-verified paid iFund subscription and your explicit opt-in. Basic customers are billed for the email option separately; selecting it never counts as payment.</p>
     </div>
     {phase==="loading"&&<p role="status" className="text-sm">Checking verified paid subscription…</p>}
     {phase==="unavailable"&&<div role="alert" className="space-y-2 text-sm"><p>Unable to verify the email add-on. No address has been activated.</p>
       <button type="button" onClick={()=>refresh()} className="min-h-11 rounded-xl border px-4 font-semibold">Retry</button></div>}
     {phase==="ready"&&<>
       {!eligible&&<p role="status" className="text-sm text-amber-600">A verified, active paid subscription is required. Trial access, temporary day passes and admin privileges do not qualify. <Link className="underline" to="/subscriptions">Review subscriptions</Link>.</p>}
       {eligible&&<form onSubmit={save} className="space-y-4">
         <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/60 p-4">
           <input type="checkbox" className="mt-1 size-5 accent-cyan-600" checked={optIn}
             onChange={e=>{setOptIn(e.target.checked);setNotice("");}} disabled={busy}/>
           <span><strong className="block">Add an iFund campaign email address</strong>
             <span className="mt-1 block text-sm text-muted-foreground">{basic?"Additional $1 per month, with separate recurring PayPal approval required.":"Email pricing or inclusion for this plan is not configured yet."} Deselecting suspends the feature without canceling a separate provider subscription.</span></span>
         </label>
         {optIn&&<div className="space-y-2">
           <label htmlFor="ifund-email-name" className="block text-sm font-semibold">Choose your personal address</label>
           <div className="flex min-h-12 flex-wrap items-center gap-1 rounded-xl border border-input bg-background px-3">
             <input id="ifund-email-name" value={handle} onChange={e=>setHandle(e.target.value)} disabled={busy}
               minLength={3} maxLength={24} pattern="[a-z][a-z0-9]*([.-][a-z0-9]+)*" required
               autoComplete="off" placeholder="campaignname" aria-describedby="ifund-email-name-help"
               className="min-w-32 flex-1 bg-transparent py-3 text-sm outline-none"/>
             <span className="break-all text-sm text-muted-foreground">@{IFUND_EMAIL_DOMAIN}</span>
           </div>
           <p id="ifund-email-name-help" className="text-xs text-muted-foreground">3–24 characters. Lowercase letters, numbers, dots or hyphens. Names are unique and reserved for one account; official addresses cannot be claimed.</p>
         </div>}
         <div className="flex flex-wrap items-center gap-3">
           <button type="submit" disabled={busy||(optIn&&handle.trim().length<3)||
             (saved===optIn&&(!optIn||handle===status.requested_handle))}
             className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
             {busy?<span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin"/>Verifying…</span>
               :optIn?"Save email add-on selection":"Turn off email add-on"}
           </button>
           {saved&&status.requested_address&&<span className="break-all text-sm font-medium">{status.requested_address}</span>}
         </div>
       </form>}
       {saved&&basic&&<div className="rounded-xl border border-cyan-500/25 bg-background/70 p-4 text-sm" aria-label="Recurring email billing readiness">
         <p className="font-semibold">Separate PayPal email subscription · $1/month</p>
         {checkoutStatus===null
           ?<p role="status" className="mt-2 text-amber-600">PayPal plan verification is unavailable. Checkout is disabled; no payment has been made.</p>
           :checkoutStatus.checkout_ready
             ?<p role="status" className="mt-2">The recurring payment plan is verified. Checkout activation and payment confirmation are processed separately; your mailbox remains inactive until a paid receipt and verified routing are recorded.</p>
             :<p role="status" className="mt-2 text-amber-600">The separate recurring PayPal checkout is not yet available. Your address is reserved only; selecting this add-on does not charge you or enable mail delivery.</p>}
         <p className="mt-2 text-xs text-muted-foreground">No one-time payment link or approval redirect counts as a recurring add-on payment.</p>
       </div>}
       {saved&&eligible&&<form onSubmit={connectCampaign} className="space-y-3 rounded-xl border border-cyan-500/25 bg-background/70 p-4">
         <div><h3 className="font-semibold">Connect your address to a campaign</h3>
           <p className="mt-1 text-xs text-muted-foreground">Choose one of your own campaigns. This labels future incoming messages in your private iFund Inbox. Linking does not activate delivery or publish anything.</p></div>
         {campaignError&&<p role="alert" className="text-sm text-destructive">{campaignError}</p>}
         <label htmlFor="ifund-email-campaign" className="block text-sm font-semibold">Campaign</label>
         <select id="ifund-email-campaign" value={linkedCampaign} onChange={e=>{setLinkedCampaign(e.target.value);setNotice("");}}
           disabled={busy||linkBusy||!!campaignError}
           className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
           <option value="">No specific campaign (account inbox only)</option>
           {campaigns.map(item=><option value={item.id} key={item.id}>{item.title||"Untitled campaign"}</option>)}
         </select>
         <button type="submit" disabled={busy||linkBusy||!!campaignError||linkedCampaign===(status.linked_campaign_id||"")}
           className="min-h-11 rounded-xl border border-cyan-500/40 px-4 text-sm font-semibold disabled:opacity-50">
           {linkBusy?"Verifying campaign…":"Save campaign connection"}
         </button>
         {campaigns.length===0&&!campaignError&&<p className="text-xs text-muted-foreground">No saved campaigns found. <Link className="underline" to="/create">Create a campaign</Link> first to associate it with this email.</p>}
       </form>}
       {saved&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm" role="status">
         {active?<span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-4"/>Verified active email identity.</span>
           :<><strong>Reserved, not active.</strong> {status.state==="awaiting_verified_addon_payment"
             ?"A separate PayPal recurring charge of $1/month has not been verified. The address cannot receive messages."
             :status.state==="awaiting_email_routing_verification"
               ?"The add-on payment is verified, but inbound email routing has not been verified."
               :"This plan's add-on billing or inclusion still requires configuration."}</>}
       </div>}
     </>}
     {notice&&<p role="status" className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-3 text-sm">{notice}</p>}
     {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-600">{error}</p>}
     <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0"/>This option cannot activate a mailbox, send email, publish to connected accounts or charge PayPal until separate provider-backed billing and receiver provisioning succeed.</p>
   </div>
 </section>;
}
