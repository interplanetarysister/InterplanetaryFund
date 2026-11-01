import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Community live activity feed. Reads the ActivityEvent store (admin-only
// under RLS) as the service role and applies server-side privacy filtering
// before returning anything:
//   - Guests (no session) receive ONLY public events.
//   - Signed-in users additionally receive 'followers' events for campaigns
//     they follow.
// Each item is sanitized to display fields only — no internal ids beyond the
// event id, no raw metadata, no private actor user ids.
// Supports cursor pagination via `before` (a created_date ISO string).
// Bootstrap: while the event store is empty (first page, no cursor), recent
// active campaigns are surfaced as synthetic campaign_created events so guests
// never see an empty feed; this stops once real events are emitted.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* guest — public only */ }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 20, 50);
    const before = body.before || null;

    const publicQ = { visibility: 'public', ...(before ? { created_date: { $lt: before } } : {}) };
    const publicEvents = await sr.entities.ActivityEvent.filter(publicQ, '-created_date', limit + 1).catch(() => []);
    let items = (publicEvents || []).filter((e) => e.visibility === 'public');

    if (user) {
      const follows = await sr.entities.FollowedCampaign.filter({ user_id: user.id, archived: false }).catch(() => []);
      const followedIds = new Set(follows.map((f) => f.campaign_id));
      if (followedIds.size) {
        const fQ = { visibility: 'followers', ...(before ? { created_date: { $lt: before } } : {}) };
        const followerEvents = await sr.entities.ActivityEvent.filter(fQ, '-created_date', limit + 1).catch(() => []);
        items = [...items, ...(followerEvents || []).filter((e) => followedIds.has(e.campaign_id))];
      }
    }

    // Bootstrap: empty event store on first page → surface recent public
    // campaigns as synthetic campaign_created events (not persisted).
    if (items.length === 0 && !before) {
      const recent = await sr.entities.Campaign.filter({ status: 'active' }, '-created_date', 20).catch(() => []);
      const synth = (recent || []).map((c) => ({
        id: `seed-${c.id}`,
        type: 'campaign_created',
        actor_user_id: null,
        actor_display_name: null,
        actor_handle: null,
        actor_image_url: null,
        campaign_id: c.id,
        campaign_title: c.title,
        campaign_image_url: c.cover_image_url || null,
        body: `New campaign: ${c.title}`,
        link: `/campaign/${c.id}`,
        created_date: c.created_date,
      }));
      return Response.json({ items: synth, next_cursor: null });
    }

    // Dedupe by id, newest first.
    const seen = new Set();
    items = items
      .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const next_cursor = hasMore && page.length ? page[page.length - 1].created_date : null;

    const safe = page.map((e) => ({
      id: e.id,
      type: e.type,
      actor_display_name: e.actor_display_name || null,
      actor_handle: e.actor_handle || null,
      actor_image_url: e.actor_image_url || null,
      campaign_id: e.campaign_id || null,
      campaign_title: e.campaign_title || null,
      campaign_image_url: e.campaign_image_url || null,
      body: e.body,
      link: e.link || null,
      created_date: e.created_date,
    }));

    return Response.json({ items: safe, next_cursor: next_cursor });
  } catch (error) {
    console.error('getCommunityFeed error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to load the community feed.' }, { status: 500 });
  }
}