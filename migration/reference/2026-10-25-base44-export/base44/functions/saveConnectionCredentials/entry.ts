import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { mergeSecrets, redactCredentials, SECRET_FIELDS, hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { externalBalanceEvidenceChanged, reconcileExternalBalanceIdentity } from '../../shared/externalBalanceEvidence.ts';
import { encryptConnectionSecret } from '../../shared/connectionCrypto.ts';
import { requestedAgentScope, AI_CONNECTION_SCOPE_VERSION, restrictedAgentScope } from '../../shared/aiConnectionScope.ts';

// Creates or updates a PlatformConnection, merging credential edits so secret
// values (Ko-fi token, Bluesky app password, Mastodon access token) are only
// overwritten when a new non-empty value is provided — otherwise the stored
// value is preserved. The frontend therefore never needs to round-trip raw
// secrets. The response returns redacted credentials + a credentials_meta map.
// Every save is audit-logged; logs record WHICH secret was rotated, never the
// value.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      connection_id, platform, kind, display_name, external_url,
      campaign_id, automation_mode, external_total, external_currency, external_donor_count,
      balance_reaffirmed, credentials, ai_account_authorized, ai_scope_choice,
    } = body;
    if (!platform) return Response.json({ error: 'platform is required' }, { status: 400 });

    let existing = null;
    if (connection_id) {
      existing = await base44.entities.PlatformConnection.get(connection_id).catch(() => null);
      if (!existing) return Response.json({ error: 'Connection not found' }, { status: 404 });
      if (existing.created_by_id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let reportedTotal = external_total === undefined || external_total === null
      ? Number(existing?.external_total ?? 0)
      : Number(external_total);
    let reportedDonors = external_donor_count === undefined || external_donor_count === null
      ? Number(existing?.external_donor_count ?? 0)
      : Number(external_donor_count);
    if (!Number.isFinite(reportedTotal) || reportedTotal < 0) {
      return Response.json({ error: 'external_total must be a non-negative number' }, { status: 400 });
    }
    if (!Number.isInteger(reportedDonors) || reportedDonors < 0) {
      return Response.json({ error: 'external_donor_count must be a non-negative integer' }, { status: 400 });
    }

    const effectiveKind = kind || existing?.kind || 'crowdfunding';
    const effectiveCurrency = effectiveKind === 'crowdfunding'
      ? String(external_currency || existing?.external_currency || '').trim().toUpperCase()
      : undefined;
    if (effectiveCurrency && !/^[A-Z]{3}$/.test(effectiveCurrency)) {
      return Response.json({ error: 'external_currency must be a three-letter ISO currency code' }, { status: 400 });
    }

    const accountConsentRequested = existing
      ? existing.obo_consent?.granted === true && existing.obo_consent?.opted_out !== true
      : ai_account_authorized === true;
    const selectedScope = existing ? (existing.obo_consent?.scope_choice || 'legacy') : String(ai_scope_choice || 'full');
    let requestedScope: string[];
    try { requestedScope = existing ? (existing.obo_consent?.requested_capabilities || [])
      : requestedAgentScope(selectedScope); }
    catch { return Response.json({error:'Select a supported AI scope.'},{status:400}); }
    if (existing && existing.obo_consent?.scope_choice && ai_scope_choice && ai_scope_choice !== selectedScope)
      return Response.json({error:'Disconnect and reconnect to change AI scope.'},{status:409});
    const effectiveAutomationMode = accountConsentRequested
      ? (automation_mode || existing?.automation_mode || 'manual') : 'manual';
    const consentOwner = existing && existing.created_by_id !== user.id
      ? await base44.asServiceRole.entities.User.get(existing.created_by_id).catch(() => null)
      : user;
    if (effectiveAutomationMode !== 'manual' && !hasUnifiedOboConsent(consentOwner)) {
      return Response.json({ error: 'AI preparation and publishing authorization is required before an AI-assisted mode can be enabled.' }, { status: 403 });
    }

    const effectiveCampaignId = campaign_id || existing?.campaign_id || undefined;
    if (effectiveCampaignId) {
      const campaign = await base44.entities.Campaign.get(effectiveCampaignId).catch(() => null);
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const connectionOwnerId = existing?.created_by_id || user.id;
      if (campaign.created_by_id !== connectionOwnerId) {
        return Response.json({ error: 'A connection and its campaign must have the same owner.' }, { status: 403 });
      }
    }

    // Only accept known integration fields. Never accept regular website passwords.
    const allowedByPlatform: Record<string, string[]> = {
      kofi: ['kofi_verification_token'],
      buymeacoffee: ['buymeacoffee_api_token'],
      bluesky: ['bluesky_handle', 'bluesky_app_password'],
      mastodon: ['mastodon_instance', 'mastodon_access_token'],
    };
    const allowed = new Set(['account_identifier', ...(allowedByPlatform[platform] || [])]);
    const incoming: Record<string, string> = {};
    for (const [key, raw] of Object.entries(credentials || {})) {
      if (!allowed.has(key) || typeof raw !== 'string') continue;
      if (raw.length > 8192) return Response.json({ error: 'A credential is too long.' }, { status: 400 });
      incoming[key] = raw;
    }
    if (existing && existing.platform !== platform) {
      return Response.json({ error: 'Platform cannot be changed for this account.' }, { status: 400 });
    }
    if (incoming.account_identifier) incoming.account_identifier = incoming.account_identifier.trim().slice(0, 254);
    if (incoming.buymeacoffee_api_token) {
      try {
        incoming.buymeacoffee_api_token = await encryptConnectionSecret(incoming.buymeacoffee_api_token.trim());
      } catch {
        // Fail closed rather than saving provider secrets as plaintext records.
        return Response.json({
          error: 'Secure token storage is not configured yet. Your token was not saved. IFund must enable its encrypted credential key first.',
        }, { status: 503 });
      }
    }
    const mergedCreds = existing ? mergeSecrets(existing.credentials, incoming) : incoming;
    const now = new Date().toISOString();
    const credentialsChanged = SECRET_FIELDS.some(field => Boolean(incoming[field])) ||
      (incoming.account_identifier !== undefined &&
       incoming.account_identifier !== String(existing?.credentials?.account_identifier || ''));
    const balanceReconciliation = reconcileExternalBalanceIdentity({
      existing, platform, kind: effectiveKind, externalUrl: external_url,
      externalCurrency: effectiveCurrency, externalTotal: reportedTotal,
      externalDonorCount: reportedDonors, credentialsChanged, reaffirmed: balance_reaffirmed,
    });
    reportedTotal = balanceReconciliation.externalTotal;
    reportedDonors = balanceReconciliation.externalDonorCount;
    // The dialog always submits its displayed totals. Re-saving a URL or
    // rotating a credential must not make stale/provider-verified balance
    // evidence look newly owner-observed. Only a normalized value change or an
    // explicit owner reaffirmation refreshes provenance and observation time.
    const balanceEvidenceChanged = externalBalanceEvidenceChanged({
      kind: effectiveKind,
      existing,
      externalTotal: reportedTotal,
      externalCurrency: effectiveCurrency,
      externalDonorCount: reportedDonors,
      reaffirmed: balance_reaffirmed,
    });
    const data: any = {
      platform,
      kind: effectiveKind,
      display_name: display_name ?? existing?.display_name ?? '',
      external_url: external_url ?? existing?.external_url ?? '',
      campaign_id: effectiveCampaignId,
      automation_mode: effectiveAutomationMode,
      credentials: mergedCreds,
      external_total: reportedTotal,
      external_currency: effectiveCurrency,
      external_donor_count: reportedDonors,
      status: 'disconnected',
      verification_status: 'unverified',
      external_data_source: balanceReconciliation.identityChanged
        ? 'owner_reported'
        : (balanceEvidenceChanged ? 'owner_reported' : (existing?.external_data_source || 'owner_reported')),
      external_balance_observed_at: balanceReconciliation.reset
        ? null
        : (balanceEvidenceChanged ? now : (existing?.external_balance_observed_at || null)),
      last_error: '',
      history: [...(existing?.history || []), { at: now, event: existing ? 'configuration_updated' : 'configured', detail: existing ? 'Connection settings updated; provider verification required' : `Configured ${platform}; provider verification required` }].slice(-30),
    };

    // Saving a URL or credential is configuration, not verification. The
    // provider check is deliberately separate so "Connected" always means a
    // real provider-backed credential check or approved public-page read
    // succeeded after the latest configuration change.

    // Every connection inherits the owner's unified AI/OBO authorization.
    // Provider verification/capabilities still determine what the connection
    // can actually do; this removes a contradictory second IFund consent.
    const unifiedObo = hasUnifiedOboConsent(consentOwner);
    const currentConsent = existing?.obo_consent || {};
    // Connecting or saving an account cannot itself confer OBO authority.
    // A newly linked account inherits the owner's one IFund permission.
    // Existing accounts retain explicit refusal; saving a connection must not
    // silently undo an earlier account-specific revocation.
    // Account-specific affirmative checkbox is required on every new setup.
    // No implicit delegation merely because global AI permission is active.
    const accountAiConsent = unifiedObo && accountConsentRequested;
    data.obo_consent = {
      ...currentConsent,
      granted: accountAiConsent,
      opted_out: !accountAiConsent,
      revoked_at: accountAiConsent ? null : (currentConsent.revoked_at || now),
      granted_at: accountAiConsent ? (currentConsent.granted_at || now) : null,
      scope_version: existing?.obo_consent?.scope_version || AI_CONNECTION_SCOPE_VERSION,
      scope_choice: existing ? existing?.obo_consent?.scope_choice : selectedScope,
      requested_capabilities: requestedScope,
      permission_version: String(consentOwner.ai_obo_consent?.permission_version || '2026-10-unified-obo-v1'),
      granted_capabilities: accountAiConsent
        ? restrictedAgentScope(requestedScope, currentConsent.provider_capabilities || [])
        : [],
    };
    data.agent_access = {
      ...(existing?.agent_access || {}),
      shared_with_agents: accountAiConsent,
      // Settings saves set verification_status=unverified above. Never keep
      // auto actions enabled until a fresh provider check succeeds.
      automation_enabled: false,
    };



    let saved;
    if (existing) saved = await base44.entities.PlatformConnection.update(existing.id, data);
    else saved = await base44.entities.PlatformConnection.create(data);

    const rotated = SECRET_FIELDS.filter((f) => incoming[f]);
    await logAudit(base44, {
      action: existing ? 'connection_credentials_updated' : 'connection_created',
      actor_user_id: user.id,
      target_type: 'PlatformConnection',
      target_id: saved.id,
      detail: `${platform}: ${existing ? 'updated' : 'created'}${rotated.length ? `; secrets rotated: ${rotated.join(',')}` : ''}`,
      status: 'success',
      metadata: { platform, secrets_rotated: rotated },
    });

    const { credentials: redactedCreds, credentials_meta } = redactCredentials(saved.credentials);
    return Response.json({ connection: { ...saved, credentials: redactedCreds, credentials_meta } });
  } catch (error) {
    console.error('saveConnectionCredentials error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not save connection.' }, { status: 500 });
  }
}