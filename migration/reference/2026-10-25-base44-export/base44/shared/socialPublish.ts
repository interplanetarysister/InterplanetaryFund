// Real posting integrations for runtime-safe destinations: Bluesky (app
// password) and LinkedIn (OAuth connector with w_member_social). Mastodon
// remains fail-closed until arbitrary instance hosts can be reached through a
// DNS-pinned, redirect-safe outbound transport.
// Used by publishPost and the sync worker.

// Platforms that can publish through a Base44 OAuth connector (shared mode).
// The connector access token is retrieved server-side at publish time.
const OAUTH_PUBLISH_PLATFORMS = new Set(['linkedin']);

export function canPublishViaConnector(platform) {
  return OAUTH_PUBLISH_PLATFORMS.has(String(platform || '').toLowerCase());
}

export function hasAiPublishingConsent(user) {
  // Canonical IFund-wide OBO is the sole authorization decision for automated
  // publishing. Legacy ai_publishing_consent / ai_connection_consent are
  // mirrored on write only (see setUnifiedOboConsent) and are no longer
  // consulted here.
  return user?.ai_obo_consent?.granted === true;
}

export function canAutoPublish(connection) {
  const c = connection?.credentials || {};
  if (connection?.platform === 'bluesky') return !!(c.bluesky_handle && c.bluesky_app_password);
  if (connection?.platform === 'mastodon') return false;
  return false;
}

export async function publishToBluesky(handle, appPassword, text) {
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!sessionRes.ok) throw new Error(`Bluesky login failed (${sessionRes.status}) — check handle and app password.`);
  const session = await sessionRes.json();

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: { $type: 'app.bsky.feed.post', text: text.slice(0, 300), createdAt: new Date().toISOString() },
    }),
  });
  if (!postRes.ok) throw new Error(`Bluesky post failed (${postRes.status}).`);
  const out = await postRes.json();
  const rkey = (out.uri || '').split('/').pop();
  return { url: rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : `https://bsky.app/profile/${handle}` };
}

export async function publishToMastodon(instance, accessToken, text) {
  // Mastodon instances are owner-supplied arbitrary hosts. Until the Base44
  // runtime provides a DNS-pinned, redirect-safe outbound transport, direct
  // server publishing would create an SSRF boundary. Keep this fail-closed.
  void instance; void accessToken; void text;
  throw new Error('Live Mastodon publishing is unavailable in this runtime.');
}

// Publishes to LinkedIn using the OAuth connector access token. The
// w_member_social scope allows posting on behalf of the authorized member.
export async function publishToLinkedIn(accessToken, text) {
  // Resolve the member URN from the userinfo endpoint.
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) throw new Error(`LinkedIn profile lookup failed (${profileRes.status}).`);
  const profile = await profileRes.json();
  const personId = profile.sub;
  if (!personId) throw new Error('LinkedIn profile ID not found.');

  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.PostContent': {
          shareCommentary: { text: text.slice(0, 3000) },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (!postRes.ok) throw new Error(`LinkedIn post failed (${postRes.status}).`);
  const out = await postRes.json();
  const postId = out.id || '';
  return { url: `https://www.linkedin.com/feed/update/${postId}/` };
}

// Publishes a DistributedPost through its connection. Throws on failure.
// OAuth platforms MUST receive the current signed-in owner's app-user token;
// an administrator/shared connector can never post on behalf of an unrelated
// creator. Scheduled/background workers do not have that owner context.
export async function publishThroughConnection(connection, text, sr, ownerOAuth = null) {
  const c = connection.credentials || {};
  if (connection.platform === 'bluesky') return publishToBluesky(c.bluesky_handle, c.bluesky_app_password, text);
  if (connection.platform === 'mastodon') return publishToMastodon(c.mastodon_instance, c.mastodon_access_token, text);
  if (connection.platform === 'linkedin') {
    if (!ownerOAuth?.accessToken) throw new Error('LinkedIn requires the account owner to authorize publishing.');
    return publishToLinkedIn(ownerOAuth.accessToken, text);
  }
  throw new Error(`Direct publishing is not available for ${connection.platform} yet.`);
}