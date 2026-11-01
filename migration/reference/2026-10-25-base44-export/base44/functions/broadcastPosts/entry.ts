import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, canPublishViaConnector, hasAiPublishingConsent, publishThroughConnection } from '../../shared/socialPublish.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { assertExternalAgentAction, assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';

// Broadcasts every pending/approved/failed DistributedPost for a campaign in
// one call — the owner's "publish everything I approved" action. Direct-
// publishes where the platform supports it (Bluesky, LinkedIn); marks the rest
// "approved" with manual=true so the owner can copy-post to crowdfunding pages
// and social sites without a publishing API. Never auto-posts without consent.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'cross_platform_publishing'))) return featureUnavailable('Cross-platform publishing');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'Missing campaign_id' }, { status: 400 });

    const campaign = await base44.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id) {
      return Response.json({ error: 'Only the campaign owner can broadcast.' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const consentOwner = user;
    const aiConsentGranted = hasAiPublishingConsent(consentOwner);
    const hasSubscription = hasSubscriptionLevel(user, 2);
    if (!aiConsentGranted) {
      return Response.json({ error: 'AI OBO authorization is not active.' }, { status: 403 });
    }
    if (!hasSubscription) {
      return Response.json({ error: 'An active outreach subscription is required to broadcast to all platforms. Upgrade to auto-publish, or publish posts individually.' }, { status: 403 });
    }
    const access = await assertPlatformAccess(sr, 'social_publish');
    if (!access.ok) {
      return Response.json({ error: `Social publishing is currently disabled: ${access.reason}` }, { status: 403 });
    }
    const posts = await base44.entities.DistributedPost.filter({ campaign_id }, '-created_date', 100);
    const pending = posts.filter((p) =>
      ['pending_approval', 'draft', 'approved', 'failed'].includes(p.status)
    );

    const results = { published: 0, manual: 0, failed: 0, total: pending.length, posts: [] };
    // This request is authenticated as the campaign owner. Resolve only that
    // app user's LinkedIn connector; never use IFund's shared/admin identity.
    let ownerLinkedInOAuth = null;
    const linkedinConnectorId = Deno.env.get('APP_USER_CONNECTOR_LINKEDIN_ID') || '';
    if (linkedinConnectorId) {
      ownerLinkedInOAuth = await sr.connectors.getCurrentAppUserConnection(linkedinConnectorId).catch(() => null);
    }

    for (const post of pending) {
      const connection = await base44.entities.PlatformConnection.get(post.connection_id).catch(() => null);
      if (!connection) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed', error: 'Connection no longer exists',
        });
        results.failed++;
        results.posts.push(updated);
        continue;
      }
      const ownerChainMatches = !!post.created_by_id &&
        !!connection.created_by_id &&
        post.created_by_id === campaign.created_by_id &&
        connection.created_by_id === campaign.created_by_id &&
        (!connection.campaign_id || connection.campaign_id === campaign.id);
      if (!ownerChainMatches) {
        results.failed++;
        results.posts.push({ id: post.id, status: 'blocked', error: 'Post, campaign, and connection ownership do not match.' });
        continue;
      }

      const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
      const capability = await resolveCapabilityForPlatform(sr, connection.platform);
      const directPublishVerified = capability?.direct_publish_verified === true && capability?.test_status === 'passing' && capability?.implementation_status === 'implemented';
      const implementedAdapterReady = ['bluesky', 'linkedin'].includes(connection.platform) &&
        connection.status === 'connected' && connection.verification_status === 'verified' &&
        capability?.test_status !== 'failed' && capability?.implementation_status !== 'disabled';
      if (!directPublishVerified && !implementedAdapterReady) {
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'approved' });
        results.manual++;
        results.posts.push(updated);
        continue;
      }

      const obo = await assertExternalAgentAction(sr, {
        ownerUser: consentOwner,
        ownerUserId: campaign.created_by_id,
        campaign,
        connection,
        capability: 'create_post',
        requireAutomation: false,
      });
      const canCredentialPublish = canAutoPublish(connection);
      const canConnectorPublish = canPublishViaConnector(connection.platform);
      const ownerOAuth = connection.platform === 'linkedin' ? ownerLinkedInOAuth : null;
      if ((!canCredentialPublish && !(canConnectorPublish && ownerOAuth?.accessToken)) || !aiConsentGranted || !obo.ok) {
        const updated = await base44.entities.DistributedPost.update(post.id, { status: 'approved' });
        results.manual++;
        results.posts.push(updated);
        continue;
      }

      try {
        const { url } = await publishThroughConnection(connection, text, sr, ownerOAuth);
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'published',
          published_at: new Date().toISOString(),
          external_post_url: url,
          error: '',
        });
        await base44.entities.PlatformConnection.update(connection.id, {
          status: 'connected',
          verification_status: 'verified',
          last_synced: new Date().toISOString(),
          history: [...(connection.history || []), {
            at: new Date().toISOString(),
            event: 'published',
            detail: `Broadcast post for "${post.campaign_title}"`,
          }].slice(-30),
        });
        results.published++;
        results.posts.push(updated);
      } catch (pubError) {
        const updated = await base44.entities.DistributedPost.update(post.id, {
          status: 'failed',
          error: 'Publishing failed.',
          retry_count: (post.retry_count || 0) + 1,
        });
        results.failed++;
        results.posts.push(updated);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('broadcastPosts error:', error.message);
    return Response.json({ error: 'Unable to broadcast your posts. Please try again.' }, { status: 500 });
  }
}