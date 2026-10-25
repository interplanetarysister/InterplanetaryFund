import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { resolveDonationDestination } from '../../shared/distributionDestination.js';

export default async function(req){
 try{
  const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });const user=await base44.auth.me();if(!user)return Response.json({error:'Authentication required'},{status:401});
  const b=await req.json().catch(()=>({}));const campaignId=String(b?.campaign_id||'').trim(),connectionId=String(b?.connection_id||'').trim(),content=String(b?.content||'').trim();
  const mediaUrl=String(b?.media_url||'').trim();
  if(mediaUrl){try{const url=new URL(mediaUrl);if(url.protocol!=='https:'||url.username||url.password||mediaUrl.length>2048)throw new Error('invalid');}catch{return Response.json({error:'Invalid image URL'},{status:400});}}
  if(!campaignId||!connectionId||!content||content.length>10000)return Response.json({error:'Invalid post request'},{status:400});
  const [campaigns,connections]=await Promise.all([base44.asServiceRole.entities.Campaign.filter({id:campaignId}),base44.asServiceRole.entities.PlatformConnection.filter({id:connectionId})]);
  const campaign=campaigns?.[0],connection=connections?.[0];if(!campaign||!connection)return Response.json({error:'Campaign or connection not found'},{status:404});
  // A draft belongs to the signed-in campaign owner and their own account.
  // Being an IFund administrator never grants posting authority over another user's account.
  if(campaign.created_by_id!==user.id)return Response.json({error:'Not authorized for campaign'},{status:403});
  if(connection.created_by_id!==user.id)return Response.json({error:'Not authorized for connection'},{status:403});
  if(connection.campaign_id&&connection.campaign_id!==campaignId)return Response.json({error:'Connection does not belong to this campaign'},{status:409});
  // Saving a draft does not send anything to the provider. Always allow an
  // owner to prepare copyable content, even when direct publishing is unsupported.
  if(connection.status!=='connected' || connection.verification_status!=='verified')
    return Response.json({error:'Verify this destination connection before preparing a post.'},{status:409});
  let destination;
  try { destination = await resolveDonationDestination(base44.asServiceRole, user.id, campaign.id, String(b?.donation_destination_connection_id || '')); }
  catch (error) { return Response.json({ error: error.message }, { status: 409 }); }
  const ifundLink = `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaignId)}`;
  const corrected = destination.kind === 'external'
    ? content.split(ifundLink + '?donate=true').join(destination.url).split(ifundLink).join(destination.url)
    : content;
  const finalContent = corrected.includes(destination.url) ? corrected : `${corrected}\n\nSupport this campaign: ${destination.url}`;
  // Stable per-batch identity prevents a timeout or repeated submit from
  // silently generating a second DistributedPost for the same destination.
  // It is not a provider-auth token and grants no additional permissions.
  const batchId = String(b?.bulk_batch_id || '').trim();
  if (batchId && (!/^[a-zA-Z0-9_-]{8,100}$/.test(batchId) || batchId.length > 100))
    return Response.json({error:'Invalid bulk batch reference.'},{status:400});
  const sourceUpdateId = batchId ? ['bulk',user.id,batchId,campaign.id,connection.id].join(':') : '';
  if (sourceUpdateId) {
    const prior = await base44.asServiceRole.entities.DistributedPost.filter({
      created_by_id:user.id,campaign_id:campaignId,connection_id:connectionId,source_update_id:sourceUpdateId,
    },'-created_date',1);
    if (prior?.[0]) return Response.json({ok:true,duplicate:true,post:prior[0]});
  }
  const post=await base44.entities.DistributedPost.create({
    campaign_id:campaignId,campaign_title:campaign.title,connection_id:connectionId,
    platform:connection.platform,content:finalContent,media_url:mediaUrl,
    donation_destination_url:destination.url,donation_destination_platform:destination.platform,
    ...(sourceUpdateId?{source_update_id:sourceUpdateId}:{}),
    status:'pending_approval',
  });
  return Response.json({ok:true,duplicate:false,post});
 }catch(error){console.error('createDistributedPost failed:',error?.name||'UnknownError');return Response.json({error:'Distributed post could not be created safely.'},{status:500});}
}
