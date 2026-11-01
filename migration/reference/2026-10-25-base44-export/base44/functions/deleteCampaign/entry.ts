import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await sr.entities.AgentDelegation.deleteMany({ owner_user_id: campaign.created_by_id, campaign_id });
    await sr.entities.AgentActivity.deleteMany({ campaign_id });
    await sr.entities.CampaignUpdate.deleteMany({ campaign_id });
    // Remove all translated copies before archiving or deleting personal campaign text.
    await sr.entities.CampaignTranslation.deleteMany({ campaign_id });
    await sr.entities.DistributedPost.deleteMany({ campaign_id });

    // Preserve financial records rather than silently deleting payment history.
    // Detach campaign-owned external connections so they cannot continue using
    // stale campaign context or automation after the campaign is gone.
    const connections = await sr.entities.PlatformConnection.filter({ created_by_id: campaign.created_by_id, campaign_id });
    for (const connection of connections) {
      await sr.entities.PlatformConnection.update(connection.id, {
        campaign_id: '',
        automation_mode: 'manual',
        agent_access: { ...(connection.agent_access || {}), automation_enabled: false },
      });
    }

    const [donations, withdrawals, operations, holdings] = await Promise.all([
      sr.entities.Donation.filter({ campaign_id }, '-created_date', 1).catch(() => []),
      sr.entities.Withdrawal.filter({ campaign_id }, '-created_date', 1).catch(() => []),
      sr.entities.FinancialOperation.filter({ campaign_id }, '-created_date', 1).catch(() => []),
      sr.entities.HoldingLedgerEntry.filter({ campaign_id }, '-created_date', 1).catch(() => []),
    ]);
    const hasFinancialHistory = donations.length > 0 || withdrawals.length > 0 || operations.length > 0 || holdings.length > 0;
    if (hasFinancialHistory) {
      // Financial references must never point at a deleted campaign id. Remove
      // public/personal campaign content but retain the identity shell required
      // for audit, payout and reconciliation history.
      await sr.entities.Campaign.update(campaign_id, {
        title: 'Archived campaign',
        summary: '',
        story: '',
        status: 'completed',
        cover_image_url: '',
        location: '',
        ai_profile: {},
        story_versions: [],
        outreach_enabled: false,
        outreach_paused: true,
      });
      return Response.json({ deleted: false, archived: true });
    }

    await sr.entities.Campaign.delete(campaign_id);
    return Response.json({ deleted: true, archived: false });
  } catch (error) {
    console.error('deleteCampaign error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to delete this campaign.' }, { status: 500 });
  }
}
