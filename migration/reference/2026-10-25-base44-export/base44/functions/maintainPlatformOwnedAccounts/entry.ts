import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const KNOWN = ['facebook','instagram','threads','x','linkedin','tiktok','pinterest','reddit','youtube','discord','bluesky','mastodon'];
const PROFILE = 'Interplanetary Fund helps people build, manage, share, and grow fundraising campaigns across the places their communities already gather.';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const accounts = await sr.entities.PlatformOwnedAccount.list('-updated_date', 200);
    const approvals = await sr.entities.AdminApproval.filter({ status: 'pending' }, '-requested_at', 200);
    const now = new Date();
    const week = 7 * 24 * 60 * 60 * 1000;
    const report = { checked: 0, approvals_created: 0, weekly_posts_staged: 0 };

    for (const platform of KNOWN) {
      let account = accounts.find(a => a.platform === platform && a.status !== 'retired');
      if (!account) {
        const existing = approvals.find(a => a.action_type === 'create_platform_account' && a.target_id === platform);
        if (!existing) {
          await sr.entities.AdminApproval.create({
            action_type: 'create_platform_account',
            title: `Create official ${platform} account`,
            description: `Outreach found that Interplanetary Fund does not have a recorded official ${platform} presence. Approve setup so the account can be created through the provider's normal signup and verification process.`,
            requested_by_agent: 'outreach',
            target_type: 'platform_owned_account',
            target_id: platform,
            payload_summary: `Suggested profile description: ${PROFILE}`,
            category: 'account_access',
            credential_status: 'requested',
            status: 'pending',
            requested_at: now.toISOString(),
            risk_level: 'medium',
          });
          report.approvals_created++;
        }
        continue;
      }
      report.checked++;
      await sr.entities.PlatformOwnedAccount.update(account.id, { last_checked_at: now.toISOString() });
      if (account.status !== 'active') continue;
      const due = !account.last_posted_at || now.getTime() - new Date(account.last_posted_at).getTime() >= week;
      if (!due) continue;
      if (!account.connection_id) {
        const existing = approvals.find(a => a.action_type === 'connect_platform_account' && a.target_id === account.id);
        if (!existing) {
          await sr.entities.AdminApproval.create({
            action_type: 'connect_platform_account',
            title: `Finish connecting ${account.display_name || platform}`,
            description: 'This official account needs a working connection before Interplanetary Fund can keep it active and post weekly updates.',
            requested_by_agent: 'outreach', target_type: 'platform_owned_account', target_id: account.id,
            category: 'account_access', credential_status: 'requested',
            status: 'pending', requested_at: now.toISOString(), risk_level: 'medium',
          });
          report.approvals_created++;
        }
        continue;
      }
      const connection = await sr.entities.PlatformConnection.get(account.connection_id).catch(()=>null);
      if (!connection || connection.status !== 'connected' || connection.verification_status !== 'verified') continue;
      const existingPost = (await sr.entities.DistributedPost.filter({ connection_id: connection.id }, '-created_date', 20))
        .find(p => p.campaign_id === 'platform-official' && ['draft','pending_approval','scheduled','published'].includes(p.status) && now.getTime()-new Date(p.created_date).getTime()<week);
      if (existingPost) continue;
      const res = await sr.integrations.Core.InvokeLLM({
        prompt: `Write one truthful weekly update for the official Interplanetary Fund ${platform} account. Keep it concise and welcoming. Explain the mission: help people create, manage, share, and grow fundraising campaigns across platforms. Do not invent launches, user counts, donation totals, partnerships, or capabilities. Plain text only.`,
        response_json_schema: { type:'object', properties:{ post_text:{type:'string'} } },
      });
      const text=(res.post_text||'').trim();
      if (!text) continue;
      await sr.entities.DistributedPost.create({
        campaign_id:'platform-official', campaign_title:'Interplanetary Fund', connection_id:connection.id,
        platform, content:text, status:'pending_approval', retry_count:0,
      });
      await sr.entities.AdminApproval.create({
        action_type:'publish_platform_weekly_update', title:`Weekly ${platform} update ready`,
        description:'Outreach prepared this week’s official Interplanetary Fund post. Approve it from the admin queue before publishing.',
        requested_by_agent:'outreach', target_type:'distributed_post', target_id:connection.id,
        payload_summary:text.slice(0,500), status:'pending', requested_at:now.toISOString(), risk_level:'low',
      });
      report.weekly_posts_staged++;
    }
    return Response.json(report);
  } catch (error) {
    console.error('maintainPlatformOwnedAccounts error:', error.message);
    return Response.json({error:'Platform account maintenance could not finish this run.'},{status:500});
  }
}
