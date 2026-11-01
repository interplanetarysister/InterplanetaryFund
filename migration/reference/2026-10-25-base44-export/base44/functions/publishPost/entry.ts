import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, canPublishViaConnector, hasAiPublishingConsent, publishThroughConnection } from '../../shared/socialPublish.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { assertExternalAgentAction, assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';

// Publishes an approved DistributedPost. Where the platform supports direct
// posting with the owner's credentials (Bluesky, Mastodon), it publishes for
// real; otherwise it returns manual=true so the UI hands the owner the
// finished content to post themselves — never pretending an API exists.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'cross_platform_publishing'))) return featureUnavailable('Cross-platform publishing');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { post_id, user_publish_authorized = false } = await req.json();
    if (!post_id) return Response.json({ error: 'Missing post_id' }, { status: 400 });

    const post = await base44.entities.DistributedPost.get(post_id).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    const sr = base44.asServiceRole;
    const campaign = post.campaign_id
      ? await sr.entities.Campaign.get(post.campaign_id).catch(() => null)
      : null;
    const connection = await sr.entities.PlatformConnection.get(post.connection_id).catch(() => null);
    if (!campaign || !connection) return Response.json({ error: 'Campaign or connection no longer exists' }, { status: 404 });
    const ownerChainMatches = !!post.created_by_id &&
      !!campaign.created_by_id &&
      !!connection.created_by_id &&
      post.created_by_id === campaign.created_by_id &&
      connection.created_by_id === campaign.created_by_id &&
      (!connection.campaign_id || connection.campaign_id === campaign.id) &&
      user.id === campaign.created_by_id;
    if (!ownerChainMatches) {
      return Response.json({ error: 'Publishing blocked because post, campaign, connection, and caller ownership do not match.' }, { status: 403 });
    }
    // Idempotency: never re-publish a post that already went live.
    if (post.status === 'published') {
      return Response.json({ manual: false, post });
    }

    const text = [post.content, ...(post.hashtags || [])].join(' ').trim();
    // Text-only provider adapters must never silently discard the user-selected image.
    if (post.media_url) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Image requires verified media publishing for ${connection.platform}`, status: 'success' });
      return Response.json({ manual: true, media_url: post.media_url, post: updated, profile_url: connection.external_url || '', reason: 'This destination does not yet have a verified image-upload adapter. Share the selected image and caption manually.' });
    }

    const consentOwner = user;
    // A deliberate human Publish click authorizes this exact post/destination.
    // Background/agent publishing still requires standing AI OBO consent.
    const hasPerPostHumanAuthorization = user_publish_authorized === true;
    if (!hasPerPostHumanAuthorization && !hasAiPublishingConsent(consentOwner)) {
      return Response.json({ error: 'Publishing authorization is not active.' }, { status: 403 });
    }
    const capability = await resolveCapabilityForPlatform(sr, connection.platform);
    const directPublishVerified = capability?.direct_publish_verified === true && capability?.test_status === 'passing' && capability?.implementation_status === 'implemented';
    // These two provider-backed adapters are actually implemented in socialPublish.
    // The capability table currently has no social rows; do not let its absence
    // block an owner-approved live attempt on a separately verified connection.
    // Only a successful provider write will ever mark the post as published.
    const implementedAdapterReady = ['bluesky', 'linkedin'].includes(connection.platform) &&
      connection.status === 'connected' && connection.verification_status === 'verified' &&
      capability?.test_status !== 'failed' && capability?.implementation_status !== 'disabled';
    const manualShareVerified = capability?.manual_share_verified === true;
    if (!directPublishVerified && !implementedAdapterReady) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Direct publish is not IFund-verified for ${connection.platform}`, status: 'success' });
      return Response.json({ manual: true, verified_manual: manualShareVerified, manual_share_method: capability?.manual_share_method || '', post: updated, profile_url: connection.external_url || '', reason: manualShareVerified ? 'Use the verified manual sharing method for this platform.' : 'IFund has not verified publishing for this platform yet.' });
    }
    // A signed-in owner explicitly clicking Publish may post to a verified
    // destination without buying the background outreach automation tier.
    // Background/agent publishing still requires the corresponding subscription.
    if (!hasPerPostHumanAuthorization && !hasSubscriptionLevel(user, 2)) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Manual post (no active subscription) for ${connection.platform}`, status: 'success' });
      return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '', reason: 'An active outreach subscription is required to auto-publish. You can post this manually.' });
    }
    const actionAuthorization = hasPerPostHumanAuthorization
      ? {
        ok: connection.status === 'connected' && connection.verification_status === 'verified',
        reason: 'The destination connection must be verified before publishing.',
      }
      : await assertExternalAgentAction(sr, {
        ownerUser: consentOwner,
        ownerUserId: campaign.created_by_id,
        campaign,
        connection,
        capability: 'create_post',
        requireAutomation: connection.automation_mode === 'auto',
      });
    // Credential-based publishing (Bluesky, Mastodon) or OAuth connector
    // publishing (LinkedIn). If neither is available, fall back to manual.
    const canCredentialPublish = canAutoPublish(connection);
    const canConnectorPublish = canPublishViaConnector(connection.platform);
    // The caller is signed in and owns the post/campaign/connection above.
    // Resolve their app-user OAuth connection, never IFund's shared LinkedIn
    // admin connector. When missing, leave a manual draft rather than posting
    // from the wrong identity or exhausting automatic retries.
    let ownerOAuth = null;
    if (canConnectorPublish && connection.platform === 'linkedin') {
      const connectorId = Deno.env.get('APP_USER_CONNECTOR_LINKEDIN_ID') || '';
      if (connectorId) {
        ownerOAuth = await sr.connectors.getCurrentAppUserConnection(connectorId).catch(() => null);
      }
    }
    if ((!canCredentialPublish && !(canConnectorPublish && ownerOAuth?.accessToken)) || !actionAuthorization.ok) {
      const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
      await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Manual post for ${connection.platform}`, status: 'success' });
      return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '' });
    }

    try {
      // Preserve the platform-wide safety switch even for explicit owner clicks.
      const access = await assertPlatformAccess(sr, 'social_publish');
      const obo = actionAuthorization;
      if (!access.ok || !obo.ok) {
        const updated = await base44.entities.DistributedPost.update(post_id, { status: 'approved' });
        const reason = !access.ok ? access.reason : obo.reason;
        await logAudit(base44, { action: 'post_approved_manual', target_type: 'distributed_post', target_id: post_id, detail: `Auto-publish blocked: ${reason}`, status: 'failure' });
        return Response.json({ manual: true, post: updated, profile_url: connection.external_url || '', reason });
      }
      const { url } = await publishThroughConnection(connection, text, sr, ownerOAuth);
      const updated = await base44.entities.DistributedPost.update(post_id, {
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_url: url,
        error: '',
      });
      await base44.entities.PlatformConnection.update(connection.id, {
        status: 'connected',
        verification_status: 'verified',
        last_synced: new Date().toISOString(),
        history: [...(connection.history || []), { at: new Date().toISOString(), event: 'published', detail: `Published post for "${post.campaign_title}"` }].slice(-30),
      });
      await logAudit(base44, { action: 'post_published', target_type: 'distributed_post', target_id: post_id, detail: `Published to ${connection.platform}`, status: 'success' });
      return Response.json({ manual: false, post: updated });
    } catch (pubError) {
      console.error('publishPost publish error:', pubError?.name || 'PublishError');
      await base44.entities.DistributedPost.update(post_id, {
        status: 'failed',
        error: 'Publishing failed.',
        retry_count: (post.retry_count || 0) + 1,
      });
      await logAudit(base44, { action: 'post_publish_failed', target_type: 'distributed_post', target_id: post_id, detail: `Publish to ${connection.platform} failed`, status: 'failure' });
      return Response.json({ error: 'Publishing failed. Try again or post manually on the platform.' }, { status: 502 });
    }
  } catch (error) {
    console.error('publishPost error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to publish this post. Please try again.' }, { status: 500 });
  }
}