import React from "react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { splitCampaignContent } from "@/lib/campaignEmbed";

function LinkedText({text}){
  const parts=String(text||"").split(/(https?:\/\/[^\s<]+)/g);
  return <div className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-700">{parts.map((part,i)=>
    /^https?:\/\//i.test(part)?<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">{part}</a>:<React.Fragment key={i}>{part}</React.Fragment>)}</div>;
}

export default function CampaignEmbeddedText({ body, campaigns = [] }) {
  const byId = new Map((campaigns||[]).map(c=>[c.id,c]));
  return <div className="space-y-4">
    {splitCampaignContent(body).map((block,index)=>block.type==="text"?
      <LinkedText key={index} text={block.value} />:
      <div key={index} className="max-w-sm">
        {byId.get(block.id) ? <CampaignCard campaign={byId.get(block.id)}/> :
          <p role="status" className="text-slate-600 text-sm">Embedded campaign unavailable.</p>}
      </div>)}
  </div>;
}
