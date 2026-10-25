import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';
import { staticRecipe, orderedTransports, requiresRouteRediscovery } from '../../shared/platformConnectionRecipes.ts';

const ACTIONS = new Set(['connect', 'create_account', 'repair', 'reauthorize']);
const clean = (value: unknown, max = 300) =>
  String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

async function resolveRecipe(sr: any, platform: string, operation: string) {
  const rows = await sr.entities.PlatformConnectionRecipe.filter({ platform, operation }).catch(() => []);
  const persisted = rows?.[0] || null;
  // Crowdfunding pages often expose a public read route, not an OAuth connect
  // API. Reuse the proven public-check recipe instead of leaving the agent
  // waiting on an undefined "connect" transport.
  const seed = staticRecipe(platform, operation) ||
    (operation === 'connect' ? staticRecipe(platform, 'read_metrics') : null);
  const effective = persisted && persisted.status !== 'disabled'
    ? persisted
    : seed
      ? { platform, operation, status: 'probation', ...seed }
      : null;
  const supportedTransports = effective
    ? orderedTransports(effective).filter((value: string) => value && value !== 'manual')
    : [];
  const rediscoveryRequired = requiresRouteRediscovery(effective, supportedTransports);
  return {
    recipe: effective,
    transport_order: supportedTransports,
    rediscovery_required: rediscoveryRequired,
  };
}

function waitingRequirement(action: string, transport: string | null) {
  if (action === 'create_account') {
    return 'Open the official platform site to sign up or sign in, then return to IFund and connect the account. IFund will verify the connection; account creation is not yet automated.';
  }
  if (transport === 'oauth') return 'Provider sign-in or consent is required on the provider page.';
  if (transport === 'token') return 'Connection details must be supplied through the protected IFund connection form.';
  if (transport === 'webhook') return 'The provider webhook or verification setup must be completed before IFund can verify the connection.';
  if (transport === 'public_browser') return 'A valid provider campaign URL is required before IFund can verify the public connection.';
  if (transport === 'authenticated_browser') return 'A protected provider session is required before IFund can continue.';
  return 'A supported provider connection step is required before IFund can continue.';
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    if (!(await isFeatureEnabled(base44, 'managed_connections'))) return featureUnavailable('New managed connections');
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasManagedConnections(user)) {
      return Response.json(
        { error: 'Managed Connections requires an eligible active subscription.' },
        { status: 403 },
      );
    }
    if (!hasUnifiedOboConsent(user)) {
      return Response.json(
        { error: 'Turn on IFund help before asking Managed Connections to act for you.' },
        { status: 403 },
      );
    }
    const consentVersion = String(user.ai_obo_consent?.permission_version || '').trim();
    if (!consentVersion) {
      return Response.json(
        { error: 'Review and renew your IFund help permission before Managed Connections acts for you.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const platform = clean(body.platform, 80).toLowerCase();
    const action = clean(body.action, 40).toLowerCase();
    const connectionId = clean(body.connection_id, 120);
    const campaignId = clean(body.campaign_id, 120);

    if (!platform || !ACTIONS.has(action)) {
      return Response.json({ error: 'A supported platform action is required.' }, { status: 400 });
    }
    if ((action === 'repair' || action === 'reauthorize') && !connectionId) {
      return Response.json({ error: 'An existing connection is required for this action.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    let connection: any = null;
    if (connectionId) {
      // Prove ownership in owner mode before any service-role access or delegated action.
      const visible = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
      if (!visible || visible.created_by_id !== user.id || visible.platform !== platform) {
        return Response.json({ error: 'Connection not found.' }, { status: 404 });
      }
      connection = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
      if (!connection || connection.created_by_id !== user.id || connection.platform !== platform) {
        return Response.json({ error: 'Connection not found.' }, { status: 404 });
      }
      if (
        connection.obo_consent?.granted !== true ||
        connection.obo_consent?.opted_out === true ||
        String(connection.obo_consent?.permission_version || '') !== consentVersion
      ) {
        return Response.json(
          { error: 'This connection needs the current IFund help authorization before delegated repair can run.' },
          { status: 403 },
        );
      }
    }

    let campaign: any = null;
    if (campaignId) {
      campaign = await base44.entities.Campaign.get(campaignId).catch(() => null);
      if (!campaign || campaign.created_by_id !== user.id) {
        return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      }
      if (connection?.campaign_id && connection.campaign_id !== campaignId) {
        return Response.json({ error: 'Connection and campaign do not match.' }, { status: 409 });
      }
    }

    // A saved "connected" flag can be stale. Never claim that a repair or
    // reconnect succeeded from the database alone; use live verification below.
    const operation = action === 'create_account' ? 'account_create' : 'connect';
    const resolved = await resolveRecipe(sr, platform, operation);
    const transports = resolved.transport_order.filter((t: string) => t && t !== 'manual');
    const nextTransport = transports[0] || null;
    const now = new Date().toISOString();

    // Avoid flooding the work queue when someone taps an AI action repeatedly.
    // Existing outstanding work remains resumable; a new request is created
    // only after the previous request has reached a terminal state.
    const prior = await base44.entities.AgentDelegation.filter({
      owner_user_id: user.id,
      destination_agent: 'managed_connection_agent',
      objective: `${action} ${platform}`,
    }).catch(() => []);
    const active = (Array.isArray(prior) ? prior : []).find((item: any) =>
      ['requested', 'assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review'].includes(item.status) &&
      item.consent_version === consentVersion &&
      (item.continuation_state?.continuation_ref || item.id) === (connection?.id || item.id) &&
      (!campaignId || item.campaign_id === campaignId)
    );
    if (active) {
      return Response.json({
        accepted: true,
        state: active.status,
        platform, action,
        connection_id: connection?.id || null,
        delegation_id: active.id,
        executable_now: false,
        message: active.continuation_state?.external_requirement ||
          active.result_summary || 'Your existing IFund request is still active.',
      });
    }

    const delegation = await base44.entities.AgentDelegation.create({
      owner_user_id: user.id,
      campaign_id: campaign?.id || connection?.campaign_id || undefined,
      campaign_title_snapshot: campaign?.title || '',
      source_agent: 'user',
      destination_agent: 'managed_connection_agent',
      objective: `${action} ${platform}`,
      context_summary: connection
        ? `Continue Managed Connections work for the owner's existing ${platform} connection ${connection.id}.`
        : `Continue Managed Connections work for the owner's ${platform} account without storing secrets in delegation context.`,
      context_provenance: [{
        claim: 'Managed Connections request originated from the authenticated owner.',
        source_type: 'user_statement',
        source_reference: 'requestManagedConnectionAction',
        confidence: 'verified',
      }],
      status: 'in_progress',
      consent_version: consentVersion,
      continuation_state: {
        pending_step: action === 'create_account' ? 'resolve_account_creation_route' : 'verify_or_prepare_connection',
        completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved'],
        external_requirement: '',
        return_route: '/connections',
      },
      retry_count: 0,
      max_retries: 3,
      last_attempt_at: now,
      created_at: now,
      updated_at: now,
    });

    if (connection && action !== 'create_account') {
      const verification = await base44.functions.invoke('verifyPlatformConnection', {
        connection_id: connection.id,
      }).catch(() => null);
      const verified = verification?.data;
      if (verified?.working === true) {
        await base44.entities.AgentDelegation.update(delegation.id, {
          status: 'completed',
          result_summary: 'The existing connection passed a live provider verification check.',
          verification: `verifyPlatformConnection:${connection.id}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          continuation_state: {
            pending_step: '',
            completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved', 'provider_verified'],
            external_requirement: '',
            return_route: '/connections',
          },
        });
        return Response.json({
          accepted: true,
          state: 'completed',
          platform,
          action,
          connection_id: connection.id,
          delegation_id: delegation.id,
          working: true,
          message: 'The connection passed a live provider check and is working.',
        });
      }
    }

    const externalRequirement = waitingRequirement(action, nextTransport);
    // If a URL or code is required, the next step belongs to the owner.
    // Never leave the user looking at a passive "working" spinner.
    const waitForUser = action === 'create_account' || action === 'reauthorize' ||
      ['oauth', 'token', 'authenticated_browser', 'public_browser', 'webhook'].includes(String(nextTransport || ''));
    const nextStatus = waitForUser ? 'waiting_user' : 'waiting_external';

    await base44.entities.AgentDelegation.update(delegation.id, {
      status: nextStatus,
      result_summary: action === 'create_account'
        ? 'Provider sign-up is an action on the official platform website; IFund has not created an account.'
        : resolved.rediscovery_required
          ? 'No verified IFund connection route is configured for this platform yet.'
          : 'The request is authorized and preserved until the next provider-required step can be completed.',
      updated_at: new Date().toISOString(),
      continuation_state: {
        pending_step: action === 'create_account' ? 'complete_official_provider_signup' : resolved.rediscovery_required ? 'discover_supported_route' : 'resume_provider_connection',
        completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved'],
        external_requirement: externalRequirement,
        return_route: '/connections',
        continuation_ref: connection?.id || delegation.id,
      },
    });

    return Response.json({
      accepted: true,
      state: nextStatus,
      platform,
      action,
      connection_id: connection?.id || null,
      delegation_id: delegation.id,
      consent_version: consentVersion,
      candidate_transports: transports,
      next_transport: nextTransport,
      rediscovery_required: resolved.rediscovery_required,
      executable_now: false,
      next_route: '/connections#connection-help',
      interaction_required: waitForUser,
      // The app can open its configured provider OAuth connection on a user
      // gesture; code issuance or second-factor checks belong to the provider.
      provider_verification_code_issuer: nextTransport === 'oauth' ? 'provider' : null,
      message: externalRequirement,
    });
  } catch (error) {
    console.error('requestManagedConnectionAction error:', error?.message || error);
    return Response.json({ error: 'IFund could not prepare this Managed Connections request.' }, { status: 500 });
  }
}
