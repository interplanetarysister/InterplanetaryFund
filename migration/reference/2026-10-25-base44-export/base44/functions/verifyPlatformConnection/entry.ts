import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV, verifyManualConnection, verifyOAuthConnection, isLinkBasedPlatform, verifyPublicCampaignConnection } from '../../shared/connectionVerification.ts';
import { redactCredentials } from '../../shared/integrationRegistry.ts';
import { verifiedConnectionCapabilities } from '../../shared/verifiedConnectionCapabilities.ts';
import { completeVerifiedManagedWork } from '../../shared/managedQueue.ts';
import { decryptConnectionSecret } from '../../shared/connectionCrypto.ts';
import { restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

const SAFE_ATTENTION = 'This connection needs attention.';
const SAFE_UNAVAILABLE = 'Live provider verification is unavailable.';

function publicConnection(row) {
  const { credentials, credentials_meta } = redactCredentials(row?.credentials);
  return { ...row, credentials, credentials_meta };
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { connection_id } = await req.json().catch(() => ({}));
    const ownerVisible = connection_id
      ? await base44.entities.PlatformConnection.get(connection_id).catch(() => null)
      : null;
    if (!ownerVisible || ownerVisible.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    // Owner-mode reads intentionally hide secret fields. Fetch the complete row
    // only after ownership is proven, then redact it again before any response.
    const sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const envName = OAUTH_ENV[connection.platform];
    try {
      let connectionVerified = false;
      let providerBacked = false;
      if (envName) {
        const connectorId = Deno.env.get(envName) || '';
        if (!connectorId) throw new Error('oauth_not_configured');
        const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId);
        if (!oauth?.accessToken) throw new Error('oauth_reauthorization_required');
        await verifyOAuthConnection(connection.platform, oauth);
        connectionVerified = true;
        providerBacked = true;
      } else if (['bluesky', 'mastodon'].includes(connection.platform)) {
        await verifyManualConnection(connection);
        connectionVerified = true;
        providerBacked = true;
      } else if (connection.platform === 'buymeacoffee') {
        // A read-only token can verify permitted account data, not authorize
        // web sign-in, posting, payouts, or other write capabilities.
        const encrypted = connection.credentials?.buymeacoffee_api_token;
        if (!encrypted) throw new Error('provider_probe_unavailable');
        const token = await decryptConnectionSecret(encrypted);
        const response = await fetch('https://developers.buymeacoffee.com/api/v1/supporters?page=1', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
          throw new Error('provider_probe_unavailable');
        }
        const result = await response.json();
        if (!result || typeof result !== 'object') throw new Error('provider_probe_unavailable');
        connectionVerified = true;
        providerBacked = true;
      } else if (connection.platform === 'kofi') {
        connectionVerified = connection.verification_status === 'verified'
          && connection.external_data_source === 'provider_verified';
        providerBacked = connectionVerified;
        if (!connectionVerified) throw new Error('kofi_webhook_required');
      } else if (isLinkBasedPlatform(connection.platform)) {
        // For public campaign trackers, a bounded read of the exact provider
        // domain proves the saved link is reachable. It does NOT convert the
        // owner-entered totals into provider-verified financial data.
        await verifyPublicCampaignConnection(connection);
        connectionVerified = true;
      } else {
        throw new Error('provider_probe_unavailable');
      }

      if (!connectionVerified) throw new Error('provider_probe_unavailable');
      const aiAllowed = user.ai_obo_consent?.granted === true &&
        connection.obo_consent?.granted === true &&
        connection.obo_consent?.opted_out !== true &&
        String(connection.obo_consent?.permission_version || '') ===
        String(user.ai_obo_consent?.permission_version || '');
      const verifiedCapabilities = providerBacked
        ? verifiedConnectionCapabilities(connection)
        : (connection.obo_consent?.provider_capabilities || []);
      const grantedForAgent = aiAllowed
        ? restrictedAgentScope(connection.obo_consent?.requested_capabilities, verifiedCapabilities)
        : [];
      const publishEligible = grantedForAgent.includes('create_post');
      const updated = await sr.entities.PlatformConnection.update(connection.id, {
        status: 'connected', verification_status: 'verified', last_synced: now, last_error: '',
        obo_consent: {
          ...(connection.obo_consent || {}),
          provider_capabilities: verifiedCapabilities,
          granted_capabilities: grantedForAgent,
        },
        agent_access: {
          ...(connection.agent_access || {}),
          shared_with_agents: aiAllowed,
          automation_enabled: aiAllowed && connection.automation_mode === 'auto' && providerBacked && publishEligible,
        },
        history: [...(connection.history || []), { at: now, event: 'health_check', detail: 'Provider connection verified' }].slice(-30),
      });
      // One authoritative completion rule for owner-triggered checks and the
      // scheduled worker. Account creation is not proven by a login check.
      await completeVerifiedManagedWork(sr, updated, now).catch((error) =>
        console.warn('Could not reconcile verified agent work:', error?.name || 'UnknownError'));
      return Response.json({ working: true, provider_verified: providerBacked, connection: publicConnection(updated) });
    } catch (error) {
      const reason = String(error?.message || '');
      const permissionMissing = reason === 'facebook_page_publish_permission_required';
      const reauth = permissionMissing || reason === 'oauth_reauthorization_required' || reason === 'oauth_not_configured';
      const message = permissionMissing
        ? 'Facebook Page publishing permission is missing. Reconnect and approve Page access.'
        : reauth ? 'Provider authorization needs attention.' : SAFE_UNAVAILABLE;
      const updated = await sr.entities.PlatformConnection.update(connection.id, {
        status: 'error', verification_status: 'unverified', last_error: message,
        agent_access: {
          ...(connection.agent_access || {}), automation_enabled: false,
        },
        capability_status: reauth ? 'reauthorization_required' : 'unknown',
        history: [...(connection.history || []), { at: now, event: 'health_check_failed', detail: message }].slice(-30),
      });
      return Response.json({ working: false, provider_verified: false, connection: publicConnection(updated), error: message });
    }
  } catch (error) {
    console.error('verifyPlatformConnection error:', error?.name || 'UnknownError');
    return Response.json({ error: SAFE_ATTENTION }, { status: 500 });
  }
}