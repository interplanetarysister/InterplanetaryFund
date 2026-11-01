import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const toHex = bytes => [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const digest = async value => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const reject = (error,status) => Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
const valid = (value,max) => typeof value === 'string' && value.trim().length>0 && value.length<=max;

export default async function(req) {
  if(req.method!=='POST') return reject('Method not allowed',405);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!/^ifund_ag_[a-f0-9]{64}$/.test(token)) return reject('Unauthorized',401);
  try {
    const client=createClientFromRequest(req);
    const matches=await client.asServiceRole.entities.ExternalAgentApiKey.filter({key_hash:await digest(token),status:'active'});
    const key=matches[0];
    if(!key || key.scope!=='campaigns:read,content:write') return reject('Write permission required',403);
    const body=await req.json().catch(()=>null);
    if(!body || !valid(body.campaign_id,128) || !['create_update','edit_summary'].includes(body.action)) return reject('Invalid request',400);
    const campaigns=await client.asServiceRole.entities.Campaign.filter({id:body.campaign_id});
    const campaign=campaigns.find(c=>c.id===body.campaign_id);
    if(!campaign || campaign.status!=='active' || campaign.outreach_enabled!==true || campaign.outreach_paused===true) return reject('Campaign unavailable',404);
    // Agent keys are not a substitute for the campaign creator's consent.
    // Grant must be attached to the campaign's actual owner and this exact API key.
    const owner=String(campaign.created_by_id||'');
    if(!owner) return reject('Creator authorization missing',403);
    const grants=await client.asServiceRole.entities.AuthorizationGrant.filter({
      user_id:owner,agent_name:key.id,platform:'ifund',scope:'campaign_content_write',status:'active'
    });
    const now=Date.now();
    if(!grants.some(g=>!g.expires_at || Date.parse(g.expires_at)>now)) return reject('Creator has not authorized this agent',403);
    if(body.action==='create_update'){
      if(!valid(body.content,5000) || (body.title!=null && (typeof body.title!=='string'||body.title.length>160))) return reject('Invalid update text',400);
      const data={campaign_id:campaign.id,content:body.content.trim(),title:String(body.title||'').trim(),media_type:'none'};
      const created=await client.asServiceRole.entities.CampaignUpdate.create(data);
      return Response.json({ok:true,action:'create_update',campaign_id:campaign.id,update_id:created.id},{status:201,headers:{'Cache-Control':'no-store'}});
    }
    if(!valid(body.summary,1000)) return reject('Invalid summary',400);
    await client.asServiceRole.entities.Campaign.update(campaign.id,{summary:body.summary.trim()});
    return Response.json({ok:true,action:'edit_summary',campaign_id:campaign.id},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('externalAgentContentWrite error',e?.name||'unknown');
    return reject('Content write API unavailable',503);
  }
}
