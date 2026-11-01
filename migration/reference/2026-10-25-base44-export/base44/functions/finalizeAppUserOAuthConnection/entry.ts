import { reconcileOAuthExternalBalance } from '../../shared/externalBalanceEvidence.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { requestedAgentScope, AI_CONNECTION_SCOPE_VERSION, restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

const COMMON_IF_CAPABILITIES = [
  'read_account', 'read_resources', 'read_campaign', 'manage_campaign',
  'create_post', 'edit_post', 'delete_own_post', 'upload_media',
  'read_interactions', 'comment', 'reply_comment', 'read_messages', 'reply_message',
  'discover', 'follow', 'join', 'read_analytics',
  'read_donations', 'read_payments', 'read_transactions', 'read_balance',
  // Transferring or paying out money requires separate explicit financial
  // authorization and is never included in ordinary AI/social delegation.
  'subscribe_events', 'reconcile_external_funds', 'settlement_status',
];

const CONFIG: Record<string, { kind: string; requestedCapabilities: string[] }> = {
  gmail: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googledrive: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googlecalendar: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  google_contacts: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  google_photos: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googlesheets: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googledocs: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googleforms: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googletasks: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  slack: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  notion: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  outlook: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  microsoft_teams: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  one_drive: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  dropbox: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  github: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  gitlab: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },

  // Request the complete foreseeable IF capability envelope once. These are
  // desired capabilities only; provider-reported scopes remain the sole source
  // for what is actually granted and usable.
  linkedin: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  facebook: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  instagram: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  discord: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  tiktok: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  threads: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  x: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  pinterest: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  reddit: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  youtube: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  patreon: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
  eventbrite: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
  gumroad: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
  wordpress_com: { kind: 'social', requestedCapabilities: ['read_account', 'read_resources', 'create_post', 'edit_post', 'upload_media'] },
};

function providerCapabilities(oauth: any): string[] {
  // Base44 connector responses vary by provider. Only persist capabilities when
  // the provider/connector explicitly reports them. Access-token presence proves
  // connection transport, not every desired permission.
  const raw = oauth?.capabilities || oauth?.grantedCapabilities || oauth?.scopes || oauth?.scope;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[ ,]+/)
      : [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { platform } = body;
    const key = String(platform || '').toLowerCase();
    const cfg = CONFIG[key];
    // Canonical IFund-wide OBO is the sole authorization decision. Provider
    // OAuth can still connect while IFund help is off, but delegated agent access
    // remains disabled until setUnifiedOboConsent records an explicit grant.
    // A new provider sign-in is NOT a per-connection AI authorization.
    // The user must affirm delegation after returning from the provider.
    const envName = OAUTH_ENV[key];
    const connectorId = cfg && envName ? (Deno.env.get(envName) || '') : '';
    if (!cfg || !connectorId) return Response.json({ configured: false, connected: false });

    let oauth: any;
    try {
      oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      if (!oauth?.accessToken) return Response.json({ configured: true, connected: false });
    } catch {
      return Response.json({ configured: true, connected: false });
    }

    const existing = (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    const requestedCampaignId = String(body.campaign_id || existing?.campaign_id || '').trim();
    let pairedCampaign = null;
    if (requestedCampaignId) {
      pairedCampaign = await base44.asServiceRole.entities.Campaign.get(requestedCampaignId).catch(() => null);
      if (!pairedCampaign || pairedCampaign.created_by_id !== user.id) {
        return Response.json({ error: 'The selected campaign is not available to this account.' }, { status: 403 });
      }
    }
    const requestedDisplayName = String(body.display_name || pairedCampaign?.title || existing?.display_name || key).trim().slice(0, 200);
    const now = new Date().toISOString();
    const confirmed = providerCapabilities(oauth);
    const oauthBalanceEvidence = reconcileOAuthExternalBalance({ existing, kind: cfg.kind });
    // A popup checkbox, not global setting or provider login, is the account
    // delegation consent. Existing per-account revocations stay revoked unless
    // the owner explicitly checks the box again when reconnecting.
    const unifiedObo = hasUnifiedOboConsent(user) && body.ai_account_authorized === true;
    const scopeChoice = existing ? (existing?.obo_consent?.scope_choice || 'legacy') : String(body.ai_scope_choice || 'full');
    let selectedCapabilities;
    try { selectedCapabilities = existing ? (existing?.obo_consent?.requested_capabilities || [])
      : requestedAgentScope(scopeChoice); }
    catch {return Response.json({error:'Unsupported AI scope'},{status:400});}
    if (existing && existing.obo_consent?.scope_choice && body.ai_scope_choice && body.ai_scope_choice !== scopeChoice)
      return Response.json({error:'Disconnect and reconnect to change AI scope'},{status:409});
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: requestedDisplayName || key,
      external_url: existing?.external_url || '',
      campaign_id: requestedCampaignId || undefined,
      automation_mode: unifiedObo ? (existing?.automation_mode || 'auto') : 'manual',
      obo_consent: {
        granted: unifiedObo,
        granted_at: unifiedObo ? now : null,
        scope_version: existing?.obo_consent?.scope_version || AI_CONNECTION_SCOPE_VERSION,
        scope_choice: existing ? existing.obo_consent?.scope_choice : scopeChoice,
        permission_version: String(user.ai_obo_consent?.permission_version || '2026-10-unified-obo-v1'),
        opted_out: !unifiedObo,
        revoked_at: existing?.obo_consent?.revoked_at || undefined,
        requested_capabilities: selectedCapabilities,
        // Provider-reported capabilities remain authoritative. Unified IFund
        // authorization permits use of those capabilities but never invents them.
        granted_capabilities: unifiedObo ? restrictedAgentScope(selectedCapabilities, confirmed) : [],
        provider_capabilities: confirmed,
      },
      agent_access: {
        shared_with_agents: unifiedObo,
        automation_enabled: false,
      },
      // OAuth token presence proves authorization material exists. A harmless
      // provider call must still succeed before the connection is shown as working.
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: confirmed.length ? 'confirmed' : 'unknown',
      ...oauthBalanceEvidence,
      last_error: 'Provider authorization received; live provider verification is pending.',
      history: [...(existing?.history || []), {
        at: now,
        event: 'oauth_authorized',
        detail: confirmed.length
          ? `Provider authorization saved; ${confirmed.length} provider-reported capabilities recorded; live verification required`
          : 'Provider authorization saved; detailed provider capabilities were not reported and remain unknown; live verification required',
      }].slice(-30),
    };
    const saved = existing
      ? await base44.entities.PlatformConnection.update(existing.id, data)
      : await base44.entities.PlatformConnection.create(data);
    return Response.json({
      configured: true, authorization_present: true, connected: false,
      provider_verified: false, verification_required: true,
      ai_consent_required: !unifiedObo,
      ai_authorized: unifiedObo,
      // No credentials are returned to the client.
      connection: { id: saved.id, platform: saved.platform, status: saved.status, campaign_id: saved.campaign_id || '', display_name: saved.display_name || '' },
    });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}