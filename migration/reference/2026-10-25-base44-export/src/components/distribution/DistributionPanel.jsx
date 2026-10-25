import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Megaphone, Sparkles, Rocket, CheckCircle2, Clipboard } from "lucide-react";
import { Link } from "react-router-dom";
import DistributedPostCard from "./DistributedPostCard";
const JustGivingStagingPilot = React.lazy(() => import("./JustGivingStagingPilot"));
import { platformName } from "@/components/connections/platformCatalog";
import { isUsableConnection } from "@/lib/connectionHealth";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";

const directReady = (c, capabilityMap) => {
  const capability = capabilityMap[c.platform] || null;
  const verifiedDirect = capability?.direct_publish_verified === true && capability?.test_status === "passing" && capability?.implementation_status === "implemented";
  const runtimeCandidate = ["bluesky", "linkedin"].includes(c.platform) &&
    c.status === "connected" && c.verification_status === "verified" &&
    capability?.test_status !== "failed" && capability?.implementation_status !== "disabled";
  if (!verifiedDirect && !runtimeCandidate) return false;
  return ["bluesky", "linkedin"].includes(c.platform);
};
const aiReady = (c, aiAuthorized) => aiAuthorized && isUsableConnection(c) && c.automation_mode !== "manual";
const approvedReady = (c, capabilityMap) => isUsableConnection(c) && directReady(c, capabilityMap);

function DestinationGroup({ title, hint, icon: Icon, connections, selected, setSelected }) {
  if (!connections.length) return null;
  return <div className="rounded-xl border border-stone-200 p-3">
    <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-primary"/><p className="text-sm font-semibold text-stone-800">{title}</p></div>
    <p className="text-xs text-stone-500 mt-1 mb-2">{hint}</p>
    <div className="flex flex-wrap gap-2">{connections.map(c => <label key={c.id} className="flex items-center gap-2 text-sm rounded-lg border border-stone-200 px-3 py-2 text-stone-700">
      <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v)=>setSelected(prev=>v?[...new Set([...prev,c.id])]:prev.filter(x=>x!==c.id))}/>{platformName(c.platform)}
    </label>)}</div>
  </div>;
}

export default function DistributionPanel({ campaign }) {
  const aiEnabled = useFeatureEnabled("ai_campaign_assistant");
  const publishEnabled = useFeatureEnabled("cross_platform_publishing");
  const [connections,setConnections]=useState(null), [posts,setPosts]=useState([]), [selected,setSelected]=useState([]), [aiAuthorized,setAiAuthorized]=useState(false), [capabilityMap,setCapabilityMap]=useState({});
  const [generating,setGenerating]=useState(false), [broadcasting,setBroadcasting]=useState(false), [error,setError]=useState("");
  const [manualText,setManualText]=useState(""), [creating,setCreating]=useState(false), [donationTarget,setDonationTarget]=useState(campaign.distribution_donation_connection_id||"ifund"), [savingDestination,setSavingDestination]=useState(false), [isAdmin,setIsAdmin]=useState(false);
  const {toast}=useToast();
  useEffect(()=>{(async()=>{try{const [r,p,me,capRes]=await Promise.all([base44.functions.invoke("listConnections",{}),base44.entities.DistributedPost.filter({campaign_id:campaign.id},"-created_date",30),base44.auth.me(),base44.functions.invoke("listFundraisingProviderCapabilities",{})]);const authorized=me?.ai_obo_consent?.granted===true;setIsAdmin(me?.role==="admin"||me?.role==="super_admin");const allConnections=Array.isArray(r?.data?.connections)?r.data.connections:[];const cs=allConnections.filter(c=>!c.campaign_id||c.campaign_id===campaign.id);const providers=Array.isArray(capRes?.data?.providers)?capRes.data.providers:[];const caps=Object.fromEntries(providers.map(cap=>[String(cap.platform||"").toLowerCase(),cap]));setAiAuthorized(authorized);setCapabilityMap(caps);setConnections(cs);setSelected(cs.filter(c=>isUsableConnection(c) && c.kind!=="app").map(c=>c.id));setPosts(Array.isArray(p)?p:[])}catch(e){console.error("Distribution load failed:",e?.name||"UnknownError");setConnections([]);setPosts([]);setCapabilityMap({})}})()},[campaign.id]);
  if(!connections)return null;
  const pending=posts.filter(p=>["pending_approval","draft","approved","failed"].includes(p.status));
  const destinations=connections.filter(c=>c.kind!=="app");
  const linkedFundraisers=destinations.filter(c=>c.kind==="crowdfunding"&&c.campaign_id===campaign.id&&isUsableConnection(c)&&/^https:\/\//i.test(c.external_url||""));
  const chosenFundraiser=linkedFundraisers.find(c=>c.id===donationTarget);
  const invalidSavedDestination=donationTarget!=="ifund"&&!chosenFundraiser;
  const donationLink=chosenFundraiser?.external_url||`https://interplanetaryfund.com/campaign/${encodeURIComponent(campaign.id)}?donate=true`;
  const ai=destinations.filter(c=>aiReady(c,aiAuthorized)), approved=destinations.filter(c=>!aiReady(c,aiAuthorized)&&approvedReady(c,capabilityMap)), copy=destinations.filter(c=>!aiReady(c,aiAuthorized)&&!approvedReady(c,capabilityMap));
  const chooseDonationDestination=async id=>{
    const previous=donationTarget;
    setDonationTarget(id);setSavingDestination(true);setError("");
    try {
      const {data}=await base44.functions.invoke("updateCampaignSettings",{campaign_id:campaign.id,patch:{distribution_donation_connection_id:id==="ifund"?"":id}});
      if(data?.ok!==true) throw new Error(data?.error||"Destination could not be saved.");
      toast({title:"Campaign destination saved",description:id==="ifund"?"New promotion links use IFund checkout.":"New promotion links use the selected external fundraiser."});
    }catch(e){setDonationTarget(previous);console.error("Donation destination save failed:",e?.name||"DestinationSaveError");setError("The donation destination could not be saved.");}
    finally{setSavingDestination(false);}
  };
  const copyCampaignStarter=async()=>{
    const text=[`Campaign: ${campaign.title||""}`,`Summary: ${campaign.summary||""}`,`Goal: ${campaign.goal_amount??""} ${campaign.currency||"USD"}`,`Story:\n${campaign.story||""}`].join("\n\n");
    try{await navigator.clipboard.writeText(text);toast({title:"Campaign details copied",description:"Paste into the official provider form. IFund has not created the external campaign."});}
    catch{setError("Copying was blocked. You can copy the title, summary, and story from your IFund campaign editor.");}
  };
  const createDrafts=async()=>{
    const targets=connections.filter(c=>selected.includes(c.id)&&isUsableConnection(c)&&c.kind!=="app");
    if(invalidSavedDestination||savingDestination){setError("Repair or change the saved donation destination before preparing posts.");return;}
    if(!manualText.trim()||!targets.length){setError("Write a message and select at least one verified destination.");return;}
    setCreating(true);setError("");
    const content=manualText.trim();
    try{
      const responses=await Promise.allSettled(targets.map(c=>base44.functions.invoke("createDistributedPost",{campaign_id:campaign.id,connection_id:c.id,content,donation_destination_connection_id:chosenFundraiser?.id||""})));
      const created=responses.flatMap(r=>r.status==="fulfilled"&&r.value?.data?.ok&&r.value.data.post?[r.value.data.post]:[]);
      setPosts(prev=>[...created,...prev]);
      if(created.length)setManualText("");
      if(created.length!==targets.length)setError(`${created.length} of ${targets.length} drafts saved. Verify connections that could not be used.`);
      else toast({title:"Posts ready for review",description:`${created.length} destination drafts created. Review each before publishing.`});
    }catch{setError("Could not create those drafts. Please try again.");}
    finally{setCreating(false);}
  };
  const generate=async()=>{if(invalidSavedDestination||savingDestination){setError("Repair or change the saved donation destination before preparing posts.");return;}setGenerating(true);setError("");try{const {data}=await base44.functions.invoke("generateDistributionContent",{campaign_id:campaign.id,connection_ids:selected,donation_destination_connection_id:chosenFundraiser?.id||""});if(data?.error)setError("The distribution action could not be completed safely. Please try again.");else if(!Array.isArray(data?.posts)||!data.posts.length)setError("No drafts were created. Check that your selected connections are verified.");else{setPosts(prev=>[...data.posts,...prev]);toast({title:data.used_template?"Post templates ready":"AI posts ready",description:data.used_template?"The AI service was unavailable, so editable campaign-based drafts were created without AI. Review before publishing.":"Review your new drafts before publishing."});}}catch(e){console.error("Distribution generation failed:",e?.name||"UnknownError");setError("Couldn't prepare the posts. Please try again.")}setGenerating(false)};
  const broadcast=async()=>{setBroadcasting(true);setError("");try{const {data}=await base44.functions.invoke("broadcastPosts",{campaign_id:campaign.id});if(data?.error)setError("The distribution action could not be completed safely. Please try again.");else{const m=new Map(posts.map(p=>[p.id,p]));for(const u of(data.posts||[]))m.set(u.id,u);setPosts([...m.values()].sort((a,b)=>new Date(b.created_date)-new Date(a.created_date)));toast({title:"Posts prepared",description:`${data.published} sent · ${data.manual} ready for you to copy and post${data.failed?` · ${data.failed} need attention`:""}.`,
        actionContext:{campaignId:campaign.id,action:"cross-platform distribution"},actionLabel:"Review posts"})}}catch(e){console.error("Distribution broadcast failed:",e?.name||"UnknownError");setError("Couldn't send the posts. Please try again.")}setBroadcasting(false)};
  return <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
    <h3 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1"><Megaphone className="w-5 h-5 text-primary"/>Broadcast your campaign</h3>
    <p className="text-sm text-stone-600 mb-4">Create campaign updates for your connected accounts. Automatic social posting only works for destinations with verified write access. Creating a fundraiser on another crowdfunding website currently requires that provider’s official setup flow.</p>
    <section aria-label="External fundraiser publishing status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">External crowdfunding: manual creation required</p>
      <p className="mt-1">IFund can prepare your campaign information, but a linked URL or imported totals do not grant permission to create a campaign on another provider. Complete the provider’s own creation and identity checks, then link its campaign to IFund.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyCampaignStarter} className="min-h-10"><Clipboard className="w-4 h-4"/> Copy campaign details</Button>
        <a href="https://www.justgiving.com/" target="_blank" rel="noopener noreferrer" className="text-amber-950 underline self-center text-xs">JustGiving (eligible charity fundraisers)</a>
        <a href="https://www.gofundme.com/" target="_blank" rel="noopener noreferrer" className="text-amber-950 underline self-center text-xs">GoFundMe</a>
        <a href="https://www.kickstarter.com/" target="_blank" rel="noopener noreferrer" className="text-amber-950 underline self-center text-xs">Kickstarter</a>
      </div>
      <p className="mt-2 text-xs">JustGiving documents a fundraising-page API, but IFund does not yet have a tested, authorized account-write integration. No external campaign has been created by this action.</p>
    </section>
    {isAdmin && <React.Suspense fallback={<p className="text-sm text-stone-600">Loading administrator pilot…</p>}><JustGivingStagingPilot campaign={campaign}/></React.Suspense>}
    {!connections.length?<p className="text-sm text-stone-500">No platforms connected yet. <Link to="/connections" className="text-primary hover:underline">Connect your accounts</Link>.</p>:<div className="space-y-3">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
        <label htmlFor="ifund-donation-destination" className="block text-sm font-semibold text-sky-950">Where should supporters donate? (saved for future promotions)</label>
        <select id="ifund-donation-destination" disabled={savingDestination} value={chosenFundraiser?.id||"ifund"} onChange={e=>chooseDonationDestination(e.target.value)} className="min-h-11 w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-slate-900">
          <option value="ifund">IFund — donate on this campaign</option>
          {linkedFundraisers.map(c=><option key={c.id} value={c.id}>{platformName(c.platform)} — linked external campaign</option>)}
        </select>
        <p className="text-xs text-sky-950 break-all">Selected destination: <a href={donationLink} target="_blank" rel="noopener noreferrer" className="underline">{donationLink}</a></p>
        {invalidSavedDestination&&<div role="alert" className="rounded-md border border-red-300 bg-white p-2 text-sm text-red-800">Your saved external fundraiser is no longer a verified campaign connection. New promotions are paused until you reconnect it or choose IFund. <Button type="button" size="sm" variant="outline" disabled={savingDestination} onClick={()=>chooseDonationDestination("ifund")}>Use IFund instead</Button></div>}
        <p className="text-xs text-sky-950">External donations are processed and held by the external platform. IFund does not collect its 3% fee on those transactions or claim the funds are withdrawable here. Selecting a URL does not verify an external payment.</p>
      </div>
      <DestinationGroup title="AI can prepare these" hint="AI can write a version suited to each of these accounts. You stay in control according to your posting choice." icon={Sparkles} connections={ai} selected={selected} setSelected={setSelected}/>
      <DestinationGroup title="You approve, then we can send" hint="These accounts can receive a post after you approve it. AI won't take over the wording unless you choose it." icon={CheckCircle2} connections={approved} selected={selected} setSelected={setSelected}/>
      <DestinationGroup title="Ready to copy and paste" hint="We'll prepare the post here, but this destination needs you to paste it into the other site." icon={Clipboard} connections={copy} selected={selected} setSelected={setSelected}/>
      <div className="rounded-xl border border-stone-200 p-3 space-y-2">
        <label htmlFor="ifund-distribution-message" className="block text-sm font-semibold text-stone-900">Write your post</label>
        <Textarea id="ifund-distribution-message" rows={4} maxLength={9000} placeholder="Share a verified campaign update, then choose Draft posts." value={manualText} onChange={e=>setManualText(e.target.value)} className="text-stone-900" />
        <p className="text-xs text-stone-600">The selected donation link is included automatically. Drafts do not publish or create outside campaigns. Destinations without verified direct publishing offer copy-and-open.</p>
        <Button type="button" onClick={createDrafts} disabled={creating||savingDestination||invalidSavedDestination||!manualText.trim()||!selected.length} className="rounded-xl min-h-11">{creating?<Loader2 className="w-4 h-4 animate-spin"/>:<Megaphone className="w-4 h-4"/>} Draft posts for selected accounts</Button>
      </div>
      <div className="flex flex-wrap gap-3 pt-1"><Button onClick={generate} disabled={!aiEnabled||!aiAuthorized||generating||savingDestination||invalidSavedDestination||!selected.length} className="rounded-xl">{generating?<Loader2 className="w-4 h-4 animate-spin"/>:<Sparkles className="w-4 h-4"/>} Fill posts with AI</Button>{pending.length>0&&<Button onClick={broadcast} disabled={!publishEnabled||broadcasting} variant="outline" className="rounded-xl">{broadcasting?<Loader2 className="w-4 h-4 animate-spin"/>:<Rocket className="w-4 h-4"/>} Auto-send approved posts ({pending.length})</Button>}</div>
      {error&&<p className="text-sm text-red-600">{error}</p>}
    </div>}
    {!!posts.length&&<div className="space-y-3 mt-4">{posts.map(p=><DistributedPostCard key={p.id} post={p} onChanged={u=>setPosts(prev=>prev.map(x=>x.id===u.id?u:x))} onRemoved={id=>setPosts(prev=>prev.filter(x=>x.id!==id))}/>)}</div>}
  </div>;
}