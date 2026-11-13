import { useState } from "react";
import { Link } from "react-router-dom";
import { campaignShareUrl, shareTargets } from "@/lib/campaignShare";

const LINK = "inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-primary hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function CampaignShareConnections({ campaigns = [] }) {
 const publicCampaigns = campaigns.filter(c => c?.status==="active" && campaignShareUrl(c.id));
 const [selectedId, setSelectedId] = useState("");
 const [message,setMessage] = useState("");
 const campaign=publicCampaigns.find(c=>c.id===selectedId)||publicCampaigns[0];
 const url=campaign ? campaignShareUrl(campaign.id) : "";
 async function copy() {
  if (!url) return;
  setMessage("");
  try {
   await navigator.clipboard.writeText(url);
   setMessage("Public campaign link copied.");
  } catch {
   setMessage("Select the link shown below to copy it.");
   document.getElementById("connection-campaign-link")?.focus();
   document.getElementById("connection-campaign-link")?.select();
  }
 }
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Share your published campaign">
   <h2 className="text-xl font-semibold">Share a campaign</h2>
   <p className="text-sm text-muted-foreground">Choose a published iFund campaign. Each option opens a draft or share screen for you to review. Nothing is posted automatically.</p>
   {!publicCampaigns.length ? <p className="text-sm text-muted-foreground">Publish a campaign first, then return here to share it. <Link className="text-primary underline" to="/campaigns">Manage campaigns</Link></p> :
    <>
      <label className="block space-y-2 text-sm font-medium">My published campaign
       <select className="min-h-11 w-full max-w-lg rounded-xl border border-input bg-background px-3" value={campaign?.id||""}
        onChange={event=>{setSelectedId(event.target.value);setMessage("");}}>
        {publicCampaigns.map(c=><option key={c.id} value={c.id}>{c.title||"Untitled campaign"}</option>)}
       </select>
      </label>
      <div className="flex flex-wrap gap-2">
       <Link className={LINK} to={"/social?shareCampaign="+encodeURIComponent(campaign.id)+"&kind=update"}>Draft a Social Feed update</Link>
       {shareTargets(campaign,url).map(item=><a key={item.id} className={LINK} href={item.href} target={item.id==="email"?undefined:"_blank"} rel="noopener noreferrer">{item.label}</a>)}
       <button className={LINK} type="button" onClick={copy}>Copy campaign link</button>
      </div>
      <input id="connection-campaign-link" className="w-full rounded-lg border border-input bg-background p-2 text-xs" readOnly value={url} aria-label="Public campaign link" onFocus={event=>event.target.select()}/>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </>}
  </section>;
}
