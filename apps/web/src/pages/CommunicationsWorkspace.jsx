import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import EchoSavedTemplates from "@/components/agents/EchoSavedTemplates";
import EchoApprovedMessaging from "@/components/agents/EchoApprovedMessaging";

const TEMPLATES = {
  share: "I'm sharing a campaign that's important to me. Please read the details and consider sharing it with someone who may want to help.",
  update: "Here's an update on our fundraiser. Thank you for following our progress. Please visit the campaign to see the latest verified information.",
  thanks: "Thank you for supporting our fundraiser. Your generosity and encouragement matter to our community.",
  volunteer: "We're looking for volunteers who may be able to help with this campaign. Please check the campaign details and contact us through an approved channel.",
};
export default function CommunicationsWorkspace() {
  const [state,setState]=useState({phase:"loading",campaigns:[],error:""});
  const [campaignId,setCampaignId]=useState("");
  const [type,setType]=useState("share");
  const [message,setMessage]=useState("");
  const [status,setStatus]=useState("");
  useEffect(()=>{
    let active=true, revision=0, observedId=null;
    const client=authClient();
    async function load(){
      const ticket=++revision;
      try{
        const {data:{user},error:authError}=await client.auth.getUser();
        if(!active||ticket!==revision)return;
        if(authError||!user)throw new Error("Verified account required.");
        observedId=user.id;
        const {data,error}=await client.from("ifund_campaigns")
          .select("id,title,summary,status").eq("owner_id",user.id).order("updated_at",{ascending:false}).limit(50);
        if(!active||ticket!==revision)return;
        if(error||!Array.isArray(data))throw new Error("Your campaigns could not be loaded.");
        const fresh=await client.auth.getUser();
        if(!active||ticket!==revision)return;
        if(fresh.error||fresh.data?.user?.id!==user.id)throw new Error("Your session changed.");
        setState({phase:"ready",campaigns:data,error:""});
      }catch(e){
        if(active&&ticket===revision)setState({phase:"error",campaigns:[],error:e.message||"Unavailable"});
      }
    }
    const {data:subscriber}=client.auth.onAuthStateChange((event,session)=>{
      const next=session?.user?.id||null;
      if(!active||next===observedId)return;
      observedId=next;
      ++revision;
      setCampaignId("");
      setMessage("");
      setStatus("");
      setState({phase:"loading",campaigns:[],error:""});
      queueMicrotask(()=>{if(active)load()});
    });
    load();
    return ()=>{active=false;++revision;subscriber?.subscription?.unsubscribe()};
  },[]);
  function prepare(){
    const item=state.campaigns.find(c=>c.id===campaignId);
    if(!item){setStatus("Select one of your campaigns.");return}
    const safeTitle=String(item.title||"This fundraiser").trim().slice(0,180);
    // Draft and unverified campaign URLs must not be represented as publicly accessible.
    const url=item.status==="active"?"\n\nhttps://interplanetaryfund.com/campaign/"+encodeURIComponent(item.id):"";
    setMessage(safeTitle+"\n\n"+TEMPLATES[type]+url);
    setStatus("Prepared locally. Edit and approve every word before sharing; no communication was sent.");
  }
  async function copy(){
    if(!message.trim()){setStatus("Prepare a message first.");return}
    try{
      await navigator.clipboard.writeText(message);
      setStatus("Copied for your manual review and sharing. Nothing was posted or emailed by iFund.");
    }catch{
      setStatus("Automatic copy is unavailable. Select the text above to copy it manually.");
    }
  }
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
    <header>
      <h1 className="text-3xl font-bold">ECHO · Communications workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">Prepare a free, editable campaign message using one of your own campaigns. This tool does not call an AI model or send email, direct messages, or social posts.</p>
    </header>
    {state.phase==="loading"&&<p role="status">Loading your campaigns…</p>}
    {state.phase==="error"&&<p role="alert" className="rounded-xl border border-red-500/50 p-4">{state.error}</p>}
    {state.phase==="ready"&&<section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <label className="block text-sm font-semibold">Your campaign
        <select className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background p-2"
          value={campaignId} onChange={e=>{setCampaignId(e.target.value);setStatus("");}}>
          <option value="">Select campaign</option>
          {state.campaigns.map(c=><option key={c.id} value={c.id}>{c.title||"Untitled campaign"} ({c.status||"draft"})</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">Message purpose
        <select className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background p-2"
          value={type} onChange={e=>setType(e.target.value)}>
          <option value="share">Share invitation</option><option value="update">Progress reminder</option>
          <option value="thanks">Thank-you note</option><option value="volunteer">Volunteer invitation</option>
        </select>
      </label>
      <button type="button" onClick={prepare} disabled={!campaignId}
        className="min-h-11 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Prepare local draft</button>
      <label className="block text-sm font-semibold">Review and edit
        <textarea className="mt-2 min-h-48 w-full rounded-lg border border-border bg-background p-3" maxLength={4000}
          value={message} onChange={e=>setMessage(e.target.value)} />
      </label>
      <EchoSavedTemplates message={message} onApply={setMessage}/>
      <EchoApprovedMessaging campaignId={campaignId}
        campaignStatus={state.campaigns.find(item=>item.id===campaignId)?.status||""}
        message={message}/>
      <button type="button" onClick={copy} disabled={!message.trim()}
        className="min-h-11 rounded-lg border border-border px-4 py-2 font-semibold disabled:opacity-50">Copy for manual sharing</button>
      {status&&<p role="status" className="text-sm text-muted-foreground">{status}</p>}
      <p className="text-xs text-muted-foreground">A template is not a verified fact. Only share an active public campaign, avoid unapproved contact lists, and confirm you have permission to message each recipient.</p>
      <Link className="text-sm underline" to="/preferences">Review your own optional outreach preferences</Link>
    </section>}
  </main>;
}
