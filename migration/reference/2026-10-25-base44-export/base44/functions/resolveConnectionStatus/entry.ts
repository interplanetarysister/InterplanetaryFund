import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { staticRecipe, orderedTransports } from '../../shared/platformConnectionRecipes.ts';

// The canonical connection resolver consumed by every IFund connection surface.
//
// It reconciles, per platform per user:
//   authenticated user → ownership mode (APP_USER vs SHARED)
//   → PlatformConnection record (if any) → Base44 connector state
//   → provider identity → granted capabilities → transport health
//   → PlatformConnectionRecipe → AuthorizationGrant/OBO → lifecycle state.
//
// It does NOT duplicate the per-connection provider test (verifyPlatformConnection),
// the SHARED status list (getSharedConnectorStatus), or the credential list
// (listConnections). It composes them into ONE lifecycle answer so the frontend,
// admin diagnostics, and agents all ask the same question and get the same state.
//
// VERIFIED here means a real provider-backed call succeeded in this resolver OR the
// connection already carries provider-verified provenance. Transport-verified means
// the OAuth transport returned a token but no provider capability was exercised.
// Configuration, recipes, saved credentials, or public URLs are NOT sufficient.

const CROWDFUNDING_OBSERVATION_PLATFORMS = new Set([
  'gofundme', 'justgiving', 'kickstarter', 'indiegogo', 'fundrazr', 'givesendgo', 'spotfund', 'custom',
]);

// Provider-backed verification for SHARED connectors. Reuses the same calls the
// dedicated getSharedConnectorStatus function makes, so the resolver and the
// shared-status list never disagree.
async function verifyShared(sr: any, connectorType: string) {
  try {
    const conn = await sr.connectors.getConnection(connectorType);
    if (!conn?.accessToken) return { connected: false, verified: false, identity: null, capabilities: [] };
    if (connectorType === 'slackbot') {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({}),
      });
      const auth = await res.json();
      if (auth.ok) return { connected: true, verified: true, identity: { team: auth.team || null, bot_user_id: auth.user_id || null }, capabilities: ['read_identity', 'post_messages'] };
      return { connected: true, verified: false, identity: null, capabilities: [], last_error: 'Shared connector verification failed.' };
    }
    if (connectorType === 'wix') {
      const res = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${conn.accessToken}` },
      });
      if (!res.ok) return { connected: true, verified: false, identity: null, capabilities: [], last_error: 'Shared connector verification failed.' };
      const body = await res.json().catch(() => ({}));
      return {
        connected: true, verified: true,
        identity: { site: body?.properties?.siteDisplayName || null, currency: body?.properties?.paymentCurrency || null, language: body?.properties?.language || null },
        // Webhooks are platform-managed for the SHARED connector; not yet exercised
        // into a sync pipeline, so 'receive_webhooks' stays out of verified caps.
        capabilities: ['read_site_data', 'manage_content'],
      };
    }
    return { connected: true, verified: false, identity: null, capabilities: [], last_error: 'Live provider verification is unavailable for this shared connector.' };
  } catch (e) {
    return { connected: false, verified: false, identity: null, capabilities: [], last_error: 'Shared connector verification could not complete.' };
  }
}

// Transport-verified check for APP_USER OAuth connectors. Token presence proves
// the OAuth transport; it does NOT prove any specific capability. Deep
// capability testing is verifyPlatformConnection's job — the resolver only reports
// what the transport itself guarantees, so a stale-but-issued token is not misrepresented as
// a working capability.
async function appUserOAuthTransport(sr: any, platform: string) {
  const envName = OAUTH_ENV[platform];
  if (!envName) return { configured: false, transport_ok: false };
  const connectorId = Deno.env.get(envName) || '';
  if (!connectorId) return { configured: false, transport_ok: false };
  try {
    const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId);
    if (!oauth?.accessToken) return { configured: true, transport_ok: false };
    return { configured: true, transport_ok: true, capabilities: oauth?.capabilities || oauth?.scopes || [] };
  } catch {
    return { configured: true, transport_ok: false };
  }
}

function deriveLifecycle(connection: any | null, shared: any, oauth: any, recipe: any, platform: string, unifiedObo: boolean): string {
  // SHARED connectors: lifecycle comes from the provider-backed shared check.
  if (recipe?.shared) {
    if (!shared?.connected) return 'NOT_CONNECTED';
    if (!shared?.verified) return shared?.last_error ? 'DEGRADED' : 'RECONNECT_REQUIRED';
    return 'CONNECTED';
  }
  // Per-user platforms.
  if (!connection) {
    // No PlatformConnection yet. OAuth-capable + connector registered but no token
    // → the user can initiate; not an error state.
    if (recipe?.preferred_transport === 'oauth' && oauth?.configured && !oauth?.transport_ok) return 'AUTHORIZATION_REQUIRED';
    return 'NOT_CONNECTED';
  }
  if (connection.status === 'disconnected') return 'DISCONNECTED';
  if (connection.status === 'error') {
    return oauth?.transport_ok ? 'DEGRADED' : 'RECONNECT_REQUIRED';
  }
  // Connection record present + status connected — refine by transport verification.
  if (recipe?.preferred_transport === 'oauth') {
    if (!oauth?.transport_ok) return 'RECONNECT_REQUIRED';
    return connection.status === 'connected' && connection.verification_status === 'verified'
      ? 'CONNECTED'
      : 'CONNECTING';
  }
  if (recipe?.preferred_transport === 'token') {
    // bluesky/mastodon: provider-verified at save time; stale credentials surface on next verify.
    return connection.verification_status === 'verified' ? 'CONNECTED' : 'AUTHORIZATION_REQUIRED';
  }
  if (recipe?.preferred_transport === 'webhook') {
    // kofi: connected only when a provider webhook has verified the link.
    return (connection.verification_status === 'verified' && connection.external_data_source === 'provider_verified')
      ? 'CONNECTED' : 'CONNECTING';
  }
  if (recipe?.preferred_transport === 'public_browser') {
    if (!connection?.external_url) return 'AUTHORIZATION_REQUIRED';
    return connection.status === 'connected' && connection.verification_status === 'verified'
      ? 'CONNECTED'
      : 'CONNECTING';
  }
  return connection.status === 'connected' ? 'CONNECTED' : 'NOT_CONNECTED';
}

function recoveryHint(lifecycle: string, recipe: any, oauth: any, platform: string): string {
  switch (lifecycle) {
    case 'NOT_CONNECTED':
      if (recipe?.preferred_transport === 'oauth' && !oauth?.configured) return 'Register the workspace connector, then start OAuth.';
      if (recipe?.preferred_transport === 'oauth') return 'Start OAuth to connect this account.';
      if (recipe?.preferred_transport === 'public_browser') return 'Link the external campaign URL. Existing IFund AI authorization applies automatically.';
      if (recipe?.preferred_transport === 'token') return 'Enter the platform connection credentials.';
      if (recipe?.preferred_transport === 'webhook') return 'Follow the webhook setup steps.';
      return 'Connect this platform to begin.';
    case 'AUTHORIZATION_REQUIRED': return 'Finish authorization to complete the connection.';
    case 'RECONNECT_REQUIRED': return 'Reconnect to restore access.';
    case 'DEGRADED': return 'Connection is partially working — verify capabilities.';
    case 'CONNECTING': return 'Waiting for the first verified event from the provider.';
    case 'BLOCKED': return 'An external requirement is blocking this connection.';
    default: return '';
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { platform, connection_id } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    if (!key) return Response.json({ error: 'Platform is required.' }, { status: 400 });

    const operation = CROWDFUNDING_OBSERVATION_PLATFORMS.has(key) ? 'read_metrics' : 'connect';
    const recipe = staticRecipe(key, operation);
    const transports = orderedTransports(recipe);
    const sr = base44.asServiceRole;

    let shared: any = null;
    let oauth: any = null;
    let connection: any | null = null;

    if (recipe?.shared) {
      shared = await verifyShared(sr, recipe.connector_type || key);
    } else {
      oauth = recipe?.preferred_transport === 'oauth' ? await appUserOAuthTransport(sr, key) : null;
      if (connection_id) {
        connection = await base44.entities.PlatformConnection.get(connection_id).catch(() => null);
        if (connection && connection.created_by_id !== user.id) connection = null;
      } else {
        const list = await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }, '-updated_date', 1);
        connection = list[0] || null;
      }
    }

    // OBO authority: active AuthorizationGrants for this user + platform.
    let grants: any[] = [];
    if (!recipe?.shared && connection) {
      try {
        grants = await base44.entities.AuthorizationGrant.filter({ user_id: user.id, platform: key, status: 'active' }, undefined, 50);
      } catch { grants = []; }
    }

    const unifiedObo = hasUnifiedOboConsent(user);
    const lifecycle = deriveLifecycle(connection, shared, oauth, recipe, key, unifiedObo);

    // Capabilities: only what is genuinely verified. Never inferred from config.
    const capabilities_verified: string[] = [];
    if (recipe?.shared && shared?.verified) capabilities_verified.push(...(shared.capabilities || []));
    if (!recipe?.shared) {
      if (oauth?.transport_ok && lifecycle === 'CONNECTED') capabilities_verified.push('oauth_transport_verified');
      if (connection?.verification_status === 'verified' && lifecycle === 'CONNECTED') {
        if (recipe?.preferred_transport === 'token') capabilities_verified.push('provider_verified');
        if (recipe?.preferred_transport === 'webhook' && connection.external_data_source === 'provider_verified') capabilities_verified.push('receive_donation_webhooks');
      }
      if (recipe?.preferred_transport === 'public_browser' && lifecycle === 'CONNECTED' && connection?.external_url) {
        capabilities_verified.push('observe_external_metrics');
      }
    }

    return Response.json({
      platform: key,
      ownership_mode: recipe?.shared ? 'SHARED' : 'APP_USER',
      lifecycle,
      transport: recipe?.preferred_transport || null,
      fallback_transports: (transports || []).filter((t: string) => t !== recipe?.preferred_transport),
      identity: shared?.identity || (connection ? { display_name: connection.display_name || null, external_url: connection.external_url || null } : null),
      capabilities_verified,
      obo: recipe?.shared ? null : {
        authorized: unifiedObo,
        source: unifiedObo ? 'unified_user_authorization' : 'none',
        legacy_grant_count: grants.length,
      },
      last_verified: shared?.verified ? shared?.verified_at : connection?.last_synced || null,
      last_error: shared?.last_error ? 'Shared connector verification needs attention.' : connection?.last_error ? 'This connection needs attention.' : null,
      recovery_hint: recoveryHint(lifecycle, recipe, oauth, key),
      // Sanitized: no tokens, no credentials, no raw provider responses.
    });
  } catch (error) {
    console.error('resolveConnectionStatus error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not resolve this connection.' }, { status: 500 });
  }
}