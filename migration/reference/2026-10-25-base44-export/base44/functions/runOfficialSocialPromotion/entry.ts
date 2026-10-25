import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const CLASSIFIED = new Set(['ifund_facebook_group', 'ifund_instagram', 'ifund_facebook_business']);

function topic(type: string, clock: number) {
  if (type === 'ifund_facebook_business') {
    // Platform discovery and brand introduction always take the lead.
    return clock % 4 === 3
      ? 'Explain one verifiable detail about IFund community participation or campaign sharing, followed by where to learn more.'
      : 'Introduce Interplanetary Fund first and foremost: why the platform exists, who the community serves, its people-first mission, and how the platform aims to make fundraising simpler. Only claim features verified as live.';
  }
  if (type === 'ifund_facebook_group')
    return 'Moderated community conversation prompt: ask supporters what challenges fundraising communities need solved and invite civil, concrete suggestions. Respect group rules. Do not tag or message members without permission.';
  return 'Authentic, distinctive Instagram caption with a human first-person brand voice, one strong visual hook, and an invitation to learn about IFund. Include a concept for an original companion visual; never assume a text-only caption can publish to Instagram.';
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const accounts = await sr.entities.PlatformOwnedAccount.list('-updated_date', 120);
    const approvals = await sr.entities.AdminApproval.filter({ status: 'pending' }, '-requested_at', 150);
    const brief = (await sr.entities.WritingResearchBrief.filter(
      { status: 'verified_sources' }, '-created_date', 1).catch(() => []))?.[0];
    const guidance = String((brief?.guidance || []).slice(0, 5).join('; ')).slice(0, 1300);
    const result = { official_accounts_checked: 0, drafts_prepared: 0,
      awaiting_provider: 0, awaiting_moderation: 0, official_published: 0 };
    for (const account of (accounts || []).filter(a => CLASSIFIED.has(a.account_type))) {
      result.official_accounts_checked++;
      if (account.status !== 'active' || !account.connection_id) {
        if (!(approvals || []).some(a => a.action_type === 'connect_platform_account' &&
          a.target_id === account.id)) {
          await sr.entities.AdminApproval.create({
            action_type: 'connect_platform_account',
            title: `Verify official ${account.display_name || account.platform} access`,
            description: 'Verify the actual official IFund account, its administrator, and supported publishing permissions. No account will be marked connected without provider proof.',
            requested_by_agent: 'outreach', target_type: 'platform_owned_account',
            target_id: account.id, status: 'pending', requested_at: now.toISOString(),
            category: 'account_access', credential_status: 'requested', risk_level: 'medium',
          });
        }
        result.awaiting_provider++;
        continue;
      }
      const conn = await sr.entities.PlatformConnection.get(account.connection_id).catch(() => null);
      const owner = conn?.created_by_id
        ? await sr.entities.User.get(conn.created_by_id).catch(() => null) : null;
      if (!conn || !owner || owner.role !== 'admin' ||
          conn.status !== 'connected' || conn.verification_status !== 'verified' ||
          conn.platform !== account.platform) {
        result.awaiting_provider++;
        continue;
      }
      // This workflow does not use any 12-hour member-campaign throttle.
      // Facebook group writing remains subject to moderation. Instagram
      // requires real media and provider authorization. Neither is claimed
      // to publish via a nonexistent API. Generate an official draft instead.
      const recent = await sr.entities.DistributedPost.filter({
        connection_id: conn.id, origin: 'ifund_official',
      }, '-created_date', 15);
      const incomplete = (recent || []).filter(p => ['draft','pending_approval'].includes(p.status));
      // Moderation queue capacity protects admins from accumulating unreviewed
      // AI drafts. It is NOT a publication limit on these official accounts.
      if (incomplete.length >= 15) {
        result.awaiting_moderation++;
        continue;
      }
      const prompt = `Act as IFund's official social media editorial team.
Write one distinctive, persuasive, human-centered and trustworthy official Interplanetary Fund post. Tone: optimistic, intelligent, welcoming and easy to understand. Understand the intended audience's psychological motivations; employ truthful comparisons, human stories and engaging questions when supported.
Account: ${account.display_name}. Destination: ${account.account_type}.
Editorial priority: ${topic(account.account_type, now.getUTCHours())}.
Current weekly donor psychology/trend guidance: ${guidance || 'Authentic messaging, real community feedback and clarity.'}
No invented statistics, payment claims, unverified launch features, awards, partnerships or superiority claims. Never imply provider authorization or successful posting. Invite readers to https://interplanetaryfund.com. Include an original visual idea for Instagram only.
Return one JSON object with post_text and visual_idea.`;
      const draft = await sr.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: { type: 'object', properties: {
          post_text: { type: 'string' }, visual_idea: { type: 'string' },
        }},
      });
      const text = String(draft?.post_text || '').trim().slice(0, 1800);
      if (!text) continue;
      const post = await sr.entities.DistributedPost.create({
        campaign_id: 'platform-official', campaign_title: 'Interplanetary Fund',
        owner_user_id: owner.id, origin: 'ifund_official',
        connection_id: conn.id, platform: conn.platform, content: text,
        status: 'pending_approval', retry_count: 0,
      });
      await sr.entities.AdminApproval.create({
        action_type: account.account_type === 'ifund_facebook_group'
          ? 'moderate_official_group_post' : 'review_official_social_post',
        title: `Official ${account.display_name} editorial draft`,
        description: account.account_type === 'ifund_instagram'
          ? 'Caption draft. Instagram needs an approved media asset and verified provider publishing permission.'
          : account.account_type === 'ifund_facebook_group'
          ? 'Moderation required before sharing on the IFund-managed Facebook group. A live Groups posting route is not verified.'
          : 'Review platform-first business-page introduction and its real publishing route before approving.',
        requested_by_agent: 'outreach', target_type: 'distributed_post',
        target_id: post.id, payload_summary: [
          text.slice(0,380), account.account_type === 'ifund_instagram'
            ? `Visual direction: ${String(draft.visual_idea || '').slice(0,100)}` : '',
        ].filter(Boolean).join(' | '),
        status: 'pending', risk_level: 'low', requested_at: now.toISOString(),
      });
      result.drafts_prepared++;
      result.awaiting_moderation++;
    }
    return Response.json(result);
  } catch (error) {
    console.error('runOfficialSocialPromotion failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Official IFund promotion could not complete.' }, { status: 500 });
  }
}
