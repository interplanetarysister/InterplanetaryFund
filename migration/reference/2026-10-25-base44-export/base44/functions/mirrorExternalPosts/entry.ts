import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertExternalAgentAction } from '../../shared/integrationRegistry.ts';

// External Feed Mirroring is a service-scoped workflow, so every read/write
// must be authorized from the owner record and the exact owner-bound connection.
// Shared connectors are not fanned out across owners. Unsupported network paths
// fail closed and perform zero external requests.

async function fetchBlueskyPosts(connection) {
  const handle = connection.credentials?.bluesky_handle;
  if (!handle) return { error: 'credentials_required' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=20`,
      { signal: controller.signal },
    );
    if (!res.ok) return { error: 'read_unavailable' };
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.feed)) return { error: 'read_unavailable' };

    const posts = data.feed.map((item) => {
      const post = item?.post || {};
      const uri = String(post.uri || '');
      const rkey = uri.split('/').pop();
      const did = uri.replace('at://', '').split('/')[0];
      return {
        external_post_id: uri,
        external_url: did && rkey ? `https://bsky.app/profile/${did}/post/${rkey}` : '',
        content: String(post.record?.text || '').trim(),
      };
    }).filter((post) => post.external_post_id && post.content);

    return { posts };
  } catch (_) {
    return { error: 'read_unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

function platformReadResult(connection) {
  switch (connection.platform) {
    case 'mastodon':
      // Owner-supplied instance hosts require DNS-pinned, redirect-safe
      // transport before the service may contact them.
      return { error: 'safe_transport_unavailable' };
    case 'discord':
      // The available Discord connector is shared. Until a provider API can
      // bind messages to this exact owner's connection, fan-out is forbidden.
      return { error: 'owner_bound_connector_unavailable' };
    case 'facebook':
    case 'instagram':
    case 'tiktok':
    case 'linkedin':
    case 'x':
    case 'threads':
    case 'youtube':
    case 'pinterest':
    case 'reddit':
      return { error: 'no_read_api' };
    default:
      return null;
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'external_feed_mirroring'))) return Response.json({ skipped: true, flag: 'external_feed_mirroring', reason: 'disabled' });
    const sr = base44.asServiceRole;
    const report = { mirrored: 0, duplicates_skipped: 0, skipped: 0, platforms: {} };

    const connections = await sr.entities.PlatformConnection.filter(
      { kind: 'social', status: 'connected' },
      '-updated_date',
      200,
    );

    for (const connection of connections || []) {
      const platform = String(connection.platform || '').toLowerCase();
      const stat = report.platforms[platform] || { mirrored: 0, duplicates: 0, skipped: 0 };
      const ownerUserId = connection.created_by_id;
      const owner = ownerUserId ? await sr.entities.User.get(ownerUserId).catch(() => null) : null;

      const authorization = owner
        ? await assertExternalAgentAction(sr, {
            ownerUser: owner,
            ownerUserId,
            connection,
            capability: null,
            requireAutomation: true,
          })
        : { ok: false, reason: 'owner unavailable' };

      if (!authorization.ok) {
        stat.skipped += 1;
        stat.status = 'authorization_required';
        report.skipped += 1;
        report.platforms[platform] = stat;
        continue;
      }

      const blocked = platformReadResult(connection);
      if (blocked) {
        stat.skipped += 1;
        stat.status = blocked.error;
        report.skipped += 1;
        report.platforms[platform] = stat;
        continue;
      }

      let result;
      if (platform === 'bluesky') {
        result = await fetchBlueskyPosts(connection);
      } else {
        result = { error: 'no_read_api' };
      }

      if (result.error) {
        stat.skipped += 1;
        stat.status = result.error;
        report.skipped += 1;
        report.platforms[platform] = stat;
        continue;
      }

      // Owner-scoped dedupe prevents one owner's mirrored records from
      // suppressing or being attributed to another owner.
      const existing = await sr.entities.SocialPost.filter(
        { source_platform: platform, author_user_id: ownerUserId },
        '-created_date',
        200,
      ).catch(() => []);
      const seen = new Set((existing || []).map((post) => post.external_post_id).filter(Boolean));

      for (const post of result.posts || []) {
        if (!post.content || !post.external_post_id || seen.has(post.external_post_id)) {
          stat.duplicates += 1;
          continue;
        }
        await sr.entities.SocialPost.create({
          author_user_id: ownerUserId,
          author_name: connection.display_name || connection.credentials?.bluesky_handle || 'External account',
          content: post.content,
          source_platform: platform,
          external_post_id: post.external_post_id,
          external_url: post.external_url || '',
          agent_managed: true,
          ai_generated: false,
          likes_count: 0,
          reposts_count: 0,
          comments_count: 0,
        });
        stat.mirrored += 1;
        report.mirrored += 1;
        seen.add(post.external_post_id);
      }

      report.duplicates_skipped += stat.duplicates;
      report.platforms[platform] = stat;
    }

    return Response.json(report);
  } catch (error) {
    console.error('mirrorExternalPosts error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Feed mirroring hit a problem and could not finish this run.' }, { status: 500 });
  }
}
