import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';
import { canAutoPublish, canPublishViaConnector, publishThroughConnection } from '../../shared/socialPublish.ts';

// User-initiated first publication for a newly paired connection.
// The Link button is the user's explicit publication instruction; AI/OBO consent
// is not required for this one deterministic post. Provider capability and live
// verification remain mandatory for direct publishing.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connection_id || '').trim();
    if (!connectionId) return Response.json({ error: 'Connection is required.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) return Response.json({ error: 'Connection not found.' }, { status: 404 });
    if (connection.status !== 'connected' || connection.verification_status !== 'verified') {
      return Response.json({ error: 'Finish provider verification before publishing.' }, { status: 409 });
    }
    const campaignId = String(connection.campaign_id || '').trim();
    if (!campaignId) return Response.json({ error: 'Choose an Interplanetary Fund campaign for this connection first.' }, { status: 409 });
    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign || campaign.created_by_id !== user.id) return Response.json({ error: 'Paired campaign not found.' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'Publish the Interplanetary Fund campaign before sending it to connected platforms.' }, { status: 409 });

    if (connection.kind === 'crowdfunding') {
      // Linking a crowdfunding URL is NOT an authorized create-campaign API.
      // Return a clear manual handoff; never record a nonexistent external post.
      return Response.json({
        ok: true,
        direct_published: false,
        external_campaign_created: false,
        manual_required: true,
        manual_setup_required: true,
        status: 'manual_setup_required',
        message: 'Campaign details are available to copy in the campaign distribution panel. Create or update the fundraiser through the provider, then link its official campaign URL. IFund did not create or publish an external fundraiser.',
      });
    }

    const marker = `connection-launch:${connection.id}:${campaign.id}`;
    const existing = await sr.entities.DistributedPost.filter({
      campaign_id: campaign.id,
      connection_id: connection.id,
      source_update_id: marker,
    }).catch(() => []);
    if (existing?.length) {
      const post = existing[0];
      return Response.json({
        ok: true,
        duplicate: true,
        direct_published: post.status === 'published',
        status: post.status,
        post_id: post.id,
        external_post_url: post.external_post_url || '',
      });
    }

    const url = `https://interplanetaryfund.com/campaign/${campaign.id}`;
    const summary = String(campaign.summary || campaign.story || '').trim().replace(/\s+/g, ' ').slice(0, 900);
    const content = [campaign.title, summary, url].filter(Boolean).join('\n\n');
    const capability = await resolveCapabilityForPlatform(sr, connection.platform);
    let ownerOAuth = null;
    if (connection.platform === 'linkedin') {
      const connectorId = Deno.env.get('APP_USER_CONNECTOR_LINKEDIN_ID') || '';
      if (connectorId) ownerOAuth = await sr.connectors.getCurrentAppUserConnection(connectorId).catch(() => null);
    }
    const directVerified =
      capability?.direct_publish_verified === true &&
      capability?.test_status === 'passing' &&
      capability?.implementation_status === 'implemented' &&
      (canAutoPublish(connection) || (canPublishViaConnector(connection.platform) && !!ownerOAuth?.accessToken));

    if (!directVerified) {
      const prepared = await base44.entities.DistributedPost.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        connection_id: connection.id,
        platform: connection.platform,
        source_update_id: marker,
        content,
        hashtags: [],
        status: 'approved',
      });
      return Response.json({
        ok: true,
        direct_published: false,
        manual_required: true,
        status: prepared.status,
        post_id: prepared.id,
      });
    }

    try {
      const published = await publishThroughConnection(connection, content, sr, ownerOAuth);
      const post = await base44.entities.DistributedPost.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        connection_id: connection.id,
        platform: connection.platform,
        source_update_id: marker,
        content,
        hashtags: [],
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_url: published?.url || '',
      });
      await sr.entities.PlatformConnection.update(connection.id, {
        last_synced: new Date().toISOString(),
        history: [...(connection.history || []), {
          at: new Date().toISOString(),
          event: 'paired_campaign_first_published',
          detail: `Published paired campaign "${campaign.title}" after connection verification`,
        }].slice(-30),
      });
      return Response.json({
        ok: true,
        direct_published: true,
        manual_required: false,
        status: 'published',
        post_id: post.id,
        external_post_url: published?.url || '',
      });
    } catch (_) {
      const failed = await base44.entities.DistributedPost.create({
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        connection_id: connection.id,
        platform: connection.platform,
        source_update_id: marker,
        content,
        hashtags: [],
        status: 'failed',
        error: 'Publishing failed.',
        retry_count: 1,
      });
      return Response.json({
        ok: false,
        direct_published: false,
        retry_available: true,
        status: failed.status,
        post_id: failed.id,
        error: 'The account connected, but the first campaign post could not be published.',
      }, { status: 502 });
    }
  } catch (error) {
    console.error('publishLinkedCampaignToConnection failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'The paired campaign could not be published safely.' }, { status: 500 });
  }
}
