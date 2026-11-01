import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
const toHex=(bytes)=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest=async(value)=>toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
export default async function(req){
  if(req.method!=='GET') return Response.json({error:'Method not allowed'},{status:405});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!/^ifund_ag_[a-f0-9]{64}$/.test(token)) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const client=createClientFromRequest(req);
    const hash=await digest(token);
    const matches=await client.asServiceRole.entities.ExternalAgentApiKey.filter({key_hash:hash,status:'active'});
    const key=matches[0];
    if(!key||!['campaigns:read','campaigns:read,content:write'].includes(key.scope)) return Response.json({error:'Unauthorized'},{status:401});
    // Only public, explicitly outreach-enabled campaigns. This endpoint never publishes posts.
    const all=await client.asServiceRole.entities.Campaign.filter({status:'active',outreach_enabled:true},'-created_date',50);
    const campaigns=all.filter(c=>c.status==='active'&&c.outreach_enabled===true&&c.outreach_paused!==true).map(c=>({
      id:c.id,title:c.title,summary:c.summary,story:c.story,cover_image_url:c.cover_image_url,
      url:'https://interplanetaryfund.com/campaign/'+encodeURIComponent(c.id)
    }));
    return Response.json({campaigns,scope:'campaigns:read',publishing_enabled:false},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('externalAgentCampaigns failed',e?.name||'unknown');
    return Response.json({error:'Agent API unavailable'},{status:503});
  }
}