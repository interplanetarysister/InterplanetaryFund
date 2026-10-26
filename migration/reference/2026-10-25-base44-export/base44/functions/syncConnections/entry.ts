import { isFeatureEnabled } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canAutoPublish, hasAiPublishingConsent, publishThroughConnection } from '../../shared/socialPublish.ts';
import { platformMayPublish, chooseNextMember, canEnterMemberQueue } from '../../shared/socialPublishingPolicy.ts';
import { readEntityPages } from '../../shared/readEntityPages.ts';
import { assertExternalAgentAction, assertPlatformAccess } from '../../shared/integrationRegistry.ts';
import { OAUTH_ENV, verifyManualConnection, isLinkBasedPlatform, verifyPublicCampaignConnection } from '../../shared/connectionVerification.ts';
import { resolveCapabilityForPlatform } from '../../shared/providerCapabilities.ts';
import { completeVerifiedManagedWork } from '../../shared/managedQueue.ts';
import { verifiedConnectionCapabilities } from '../../shared/verifiedConnectionCapabilities.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

// Hourly synchronization worker (invoked by the "Connection Sync Engine"
// workflow, no user context — service-scoped like runOutreachAgent):
// 1. Publishes authorized paid-member agent posts, max one per platform
//    per rolling 12h, in first-paid / round-robin queue order.
// 2. Unconfirmed provider writes go to manual review without auto retries.
// 3. Checks provider connection health where service-context checks are safe.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const now = new Date();
    const report = { published: 0, awaiting_approval: 0, retried: 0, failed: 0, verified: 0, needs_attention: 0, delegations_completed: 0, health_deferred: 0 };
    // Centralized access gate: auto-publish only when social publishing is
    // healthy at the registry level. When disabled, due posts fall back to
    // pending_approval (the existing non-auto path) instead of auto-posting.
    const access = await assertPlatformAccess(sr, 'social_publish');

    // --- Paid member automatic publishing; platform-global rolling 12h ---
    // Only trusted auto-post permits produced by IFund's own scheduler may
    // publish here. No public client-supplied DistributedPost fields can
    // authorize an automated external action.
    const publishingEnabled = await isFeatureEnabled(base44, 'cross_platform_publishing');
    const stagedBatch = await readEntityPages(sr, 'DistributedPost',
      { status: 'scheduled' }, 'scheduled_for', 200, 3000);
    const staged = stagedBatch.rows;
    const [queuedBatch, inProgressBatch, completedBatch, reviewBatch] = await Promise.all([
      readEntityPages(sr, 'ScheduledAutoPostPermit', { status: 'queued' }, 'created_date', 200, 3000),
      readEntityPages(sr, 'ScheduledAutoPostPermit', { status: 'publishing' }, '-publishing_at', 200, 600),
      readEntityPages(sr, 'ScheduledAutoPostPermit', { status: 'published' }, '-published_at', 200, 600),
      readEntityPages(sr, 'ScheduledAutoPostPermit', { status: 'review' }, '-publishing_at', 200, 600),
    ]);
    const existingPermits = [
      ...queuedBatch.rows, ...inProgressBatch.rows,
      ...completedBatch.rows, ...reviewBatch.rows,
    ];
    report.queue_scan_truncated = stagedBatch.truncated || queuedBatch.truncated;
    const permitByPost = new Map((existingPermits || []).map(p => [p.post_id, p]));
    // Legacy scheduler records without a server-only permit cannot run
    // automatically; preserve their copy for the owner to review.
    for (const post of staged || []) {
      if (!permitByPost.has(post.id)) {
        await sr.entities.DistributedPost.update(post.id, {
          status: 'pending_approval',
          error: 'Scheduling requires verified IFund posting authorization. Review this post before publishing.',
        }).catch(() => {});
        report.awaiting_approval++;
      }
    }
    // A provider request may have succeeded just before the worker stopped.
    // Never auto-retry that ambiguous write: put it in review and reserve the
    // platform for the full twelve-hour window from the attempted send.
    for (const permit of inProgressBatch.rows) {
      const started = Date.parse(String(permit.publishing_at || ''));
      if (!Number.isFinite(started) || now.getTime() - started < 30 * 60 * 1000) continue;
      await sr.entities.ScheduledAutoPostPermit.update(permit.id, {
        status: 'review', last_error: 'Provider result unknown after worker interruption.',
      });
      await sr.entities.DistributedPost.update(permit.post_id, {
        status: 'failed', error: 'Check the provider for an existing post before retrying.',
      }).catch(() => {});
      reviewBatch.rows.push({ ...permit, status: 'review' });
    }
    if (publishingEnabled && access.ok) {
      const published = await sr.entities.DistributedPost.filter({ status: 'published' }, '-published_at', 500);
      const publishedPermits = completedBatch.rows;
      const activeInFlight = inProgressBatch.rows.filter(p => !reviewBatch.rows.some(r => r.id === p.id));
      const uncertainPlatforms = new Set(reviewBatch.rows.filter(p => {
        const started = Date.parse(String(p.publishing_at || ''));
        return Number.isFinite(started) &&
          now.getTime() - started < 12 * 60 * 60 * 1000;
      }).map(p => p.platform));
      const inflight = new Set(activeInFlight.map(p => p.platform));
      const dueByPlatform = new Map();
      for (const permit of (existingPermits || [])) {
        if (permit.status !== 'queued' ||
            !platformMayPublish(published, permit.platform, now.getTime()) ||
            inflight.has(permit.platform) || uncertainPlatforms.has(permit.platform)) continue;
        const post = (staged || []).find(p => p.id === permit.post_id);
        if (!post || !post.scheduled_for || Date.parse(post.scheduled_for) > now.getTime()) continue;
        if (!dueByPlatform.has(permit.platform)) dueByPlatform.set(permit.platform, []);
        dueByPlatform.get(permit.platform).push(permit);
      }
      for (const [platform, candidates] of dueByPlatform) {
        // Fresh platform-scoped preflight: do not trust a truncated global
        // history list when subscriber volume becomes very large.
        const latestOnPlatform = await sr.entities.DistributedPost.filter(
          { status: 'published', platform }, '-published_at', 50);
        if (!platformMayPublish(latestOnPlatform, platform, now.getTime())) continue;
        const conflictingWrites = await sr.entities.ScheduledAutoPostPermit.filter(
          { status: 'publishing', platform }, '-publishing_at', 30);
        if ((conflictingWrites || []).some(p => {
          const at = Date.parse(String(p.publishing_at || ''));
          return !Number.isFinite(at) || now.getTime() - at < 12 * 60 * 60 * 1000;
        })) continue;
        const permit = chooseNextMember(candidates,
          publishedPermits.filter(p => p.platform === platform), now.getTime());
        if (!permit) continue;
        const post = (staged || []).find(p => p.id === permit.post_id);
        if (!post || post.origin !== 'agent_autopilot' ||
            post.owner_user_id !== permit.owner_user_id ||
            post.campaign_id !== permit.campaign_id ||
            post.connection_id !== permit.connection_id ||
            post.platform !== permit.platform) {
          await sr.entities.ScheduledAutoPostPermit.update(permit.id, { status: 'review',
            last_error: 'Post does not match trusted scheduler authorization.' });
          continue;
        }
        const [campaign, connection, owner] = await Promise.all([
          sr.entities.Campaign.get(permit.campaign_id).catch(() => null),
          sr.entities.PlatformConnection.get(permit.connection_id).catch(() => null),
          sr.entities.User.get(permit.owner_user_id).catch(() => null),
        ]);
        const ownerMatch = campaign?.created_by_id === permit.owner_user_id &&
          connection?.created_by_id === permit.owner_user_id &&
          (!connection?.campaign_id || connection.campaign_id === campaign.id);
        const gate = ownerMatch && canEnterMemberQueue(owner, campaign) &&
          hasAiPublishingConsent(owner) && connection.automation_mode === 'auto' &&
          connection.status === 'connected' && connection.verification_status === 'verified';
        const capability = connection
          ? await resolveCapabilityForPlatform(sr, connection.platform) : null;
        const executable = !!capability?.direct_publish_verified &&
          capability?.implementation_status === 'implemented' &&
          capability?.test_status === 'passing' &&
          !!connection && canAutoPublish(connection);
        const authorization = gate
          ? await assertExternalAgentAction(sr, {
            ownerUser: owner, ownerUserId: owner.id, campaign, connection,
            capability: 'create_post', requireAutomation: true,
          }) : { ok: false, reason: 'subscription, ownership or connection unavailable' };
        if (!gate || !executable || !authorization.ok) {
          await sr.entities.DistributedPost.update(post.id, {
            status: 'pending_approval',
            error: 'Automatic publishing unavailable. Verify subscription, connection, and permission.',
          });
          await sr.entities.ScheduledAutoPostPermit.update(permit.id, {
            status: 'review', last_error: 'A verified automatic publishing path is unavailable.',
          });
          report.awaiting_approval++;
          continue;
        }
        // Fail closed on ambiguous provider outcomes. Never auto retry an
        // uncertain external write and potentially post it twice.
        await sr.entities.ScheduledAutoPostPermit.update(permit.id, {
          status: 'publishing', publishing_at: now.toISOString(),
        });
        await sr.entities.DistributedPost.update(post.id, {
          status: 'publishing', publishing_started_at: now.toISOString(),
        });
        try {
          const words = [post.content, ...(post.hashtags || [])].join(' ').trim();
          const { url } = await publishThroughConnection(connection, words, sr);
          const publishedAt = new Date().toISOString();
          await sr.entities.DistributedPost.update(post.id, {
            status: 'published', published_at: publishedAt,
            external_post_url: url, error: '',
          });
          await sr.entities.ScheduledAutoPostPermit.update(permit.id, {
            status: 'published', published_at: publishedAt, last_error: '',
          });
          report.published++;
          published.push({ ...post, status: 'published', published_at: publishedAt });
        } catch (error) {
          console.error('syncConnections auto publish needs review:', error?.name || 'UnknownError');
          await sr.entities.DistributedPost.update(post.id, {
            status: 'failed',
            error: 'Provider publish result is unconfirmed. Review before retrying.',
          }).catch(() => {});
          await sr.entities.ScheduledAutoPostPermit.update(permit.id, {
            status: 'review', last_error: 'Provider response requires review before retrying.',
          }).catch(() => {});
          await sr.entities.Notification.create({
            user_id: permit.owner_user_id, title: 'Scheduled post needs review',
            body: 'Publishing could not be confirmed. Please check the platform before trying again.',
            type: 'system', link: `/campaign/${permit.campaign_id}`,
          }).catch(() => {});
          report.failed++;
        }
      }
    }

    // --- Connection health: actively verify every connection we can prove. ---
    // A green dot is refreshed by a provider check, not by the passage of time.
    const connections = await sr.entities.PlatformConnection.filter({}, '-updated_date', 200);
    let probes = 0;
    for (const c of connections) {
      // Per-user OAuth is never tested in a scheduled service context.
      if (OAUTH_ENV[c.platform] || c.platform === 'kofi' ||
          !(c.platform === 'bluesky' || isLinkBasedPlatform(c.platform))) {
        report.health_deferred++;
        continue;
      }
      const lastEvent = (c.history || []).filter((item) =>
        item.event === 'health_check' || item.event === 'health_check_failed').at(-1);
      const lastAttempt = Date.parse(lastEvent?.at || c.last_synced || '');
      if ((Number.isFinite(lastAttempt) && now.getTime() - lastAttempt < 6 * 60 * 60 * 1000) ||
          probes >= 12) {
        report.health_deferred++;
        continue;
      }
      probes++;
      try {
        if (['bluesky'].includes(c.platform)) {
          await verifyManualConnection(c);
        } else if (isLinkBasedPlatform(c.platform)) {
          await verifyPublicCampaignConnection(c);
        } else {
          // Ko-fi is verified by signed provider webhook events; custom/unknown
          // connections remain unverified until a real supported check exists.
          continue;
        }
        const owner = await sr.entities.User.get(c.created_by_id).catch(() => null);
        const version = String(owner?.ai_obo_consent?.permission_version || '');
        const delegated = !!owner && hasUnifiedOboConsent(owner) && !!version &&
          c.obo_consent?.granted === true &&
          c.obo_consent?.opted_out !== true &&
          c.obo_consent?.permission_version === version;
        const verifiedCaps = c.platform === 'bluesky'
          ? verifiedConnectionCapabilities(c)
          : (c.obo_consent?.provider_capabilities || []);
        const agentCaps = delegated ? restrictedAgentScope(c.obo_consent?.requested_capabilities, verifiedCaps) : [];
        const checked = await sr.entities.PlatformConnection.update(c.id, {
          status: 'connected', verification_status: 'verified', last_synced: now.toISOString(), last_error: '',
          obo_consent: {
            ...(c.obo_consent || {}),
            provider_capabilities: verifiedCaps,
            granted_capabilities: agentCaps,
          },
          agent_access: {
            ...(c.agent_access || {}),
            shared_with_agents: delegated,
            automation_enabled: delegated && c.automation_mode === 'auto' &&
              agentCaps.includes('create_post'),
          },
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check', detail: 'Scheduled provider verification succeeded' }].slice(-30),
        });
        report.verified++;
        report.delegations_completed += await completeVerifiedManagedWork(sr, checked, now.toISOString()).catch((error) => {
          console.error('Managed work reconciliation could not finish:', error?.name || 'UnknownError');
          return 0;
        });
      } catch (e) {
        console.error('syncConnections provider verification failed:', e?.name || 'UnknownError');
        const reason = String(e?.message || '');
        const reauth = reason === 'Provider authorization needs to be renewed.' || reason === 'Provider sign-in is not configured yet.';
        const message = reauth ? 'Provider authorization needs attention.' : 'Live provider verification could not be completed.';
        await sr.entities.PlatformConnection.update(c.id, {
          status: 'error', verification_status: 'unverified', last_error: message,
          capability_status: c.capability_status || 'unknown',
          agent_access: { ...(c.agent_access || {}), automation_enabled: false },
          history: [...(c.history || []), { at: now.toISOString(), event: 'health_check_failed', detail: message }].slice(-30),
        });
        report.needs_attention++;
      }
    }

    return Response.json(report);
  } catch (error) {
    console.error('syncConnections error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Synchronization encountered a problem and could not finish.' }, { status: 500 });
  }
}