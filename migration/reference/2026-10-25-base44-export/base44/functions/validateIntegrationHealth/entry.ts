import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { emitIntegrationAlert, isUnhealthy, STATUS_LABEL } from '../../shared/integrationRegistry.ts';

// Admin-triggered health validator. Configuration presence is not provider
// verification. A registry entry becomes ACTIVE only when this function obtains
// provider-backed evidence during this run. Unsupported checks fail closed.
const PLATFORM_SECRETS = {
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'],
  cloudflare: ['Cloudflare_api_token'],
  openai: ['OPENAI_API_KEY'],
};

function checkSecrets(platform) {
  const names = PLATFORM_SECRETS[platform] || [];
  const missing = names.filter((n) => !secrets.get(n));
  return { names, missing };
}

async function verifyCloudflareToken() {
  const token = secrets.get('Cloudflare_api_token');
  if (!token) return { ok: false, detail: 'Cloudflare API token is not configured.' };
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    if (!res.ok) return { ok: false, detail: 'Cloudflare token verification failed.' };
    const data = await res.json().catch(() => null);
    if (data?.success === true && data?.result?.status === 'active') {
      return { ok: true, detail: 'Cloudflare token verified active.' };
    }
    return { ok: false, detail: 'Cloudflare token is not active.' };
  } catch (_) {
    return { ok: false, detail: 'Cloudflare token verification could not complete.' };
  }
}

async function validateEntry(sr, e) {
  const checks = [];
  const flags = [];
  let status = e.status === 'REVOKED' ? 'REVOKED' : 'DISCONNECTED';
  let providerVerified = false;
  let lastFailure = '';
  const p = String(e.platform || '').toLowerCase();

  // An explicit revocation is authoritative. Validation must never revive it,
  // including when a stale provider token still happens to work.
  if (e.status === 'REVOKED') {
    return { status: 'REVOKED', flags, checks: [{ check: 'explicit_revocation', ok: true,
      detail: 'Administrator revocation is preserved.' }], lastFailure: '',
      alertTitle: '', alertBody: '', providerVerified: false };
  }

  if (PLATFORM_SECRETS[p]) {
    const { names, missing } = checkSecrets(p);
    checks.push({
      check: 'secret_refs_present',
      ok: missing.length === 0,
      detail: missing.length ? 'Required provider configuration is missing.' : `${names.length} configured reference(s) present.`,
    });
    if (missing.length && !e.optional) {
      status = 'MISCONFIGURED';
      lastFailure = 'Required provider configuration is missing.';
    }
    if (missing.length && e.optional) {
      checks.push({ check: 'optional_not_configured', ok: true, detail: 'Optional integration is not configured.' });
    }
    if (p === 'paypal') {
      const mode = (secrets.get('PAYPAL_MODE') || '').toLowerCase();
      if (mode.includes('sandbox') && e.environment === 'production') {
        flags.push('dev_creds_in_prod');
        status = 'MISCONFIGURED';
        lastFailure = 'Sandbox configuration is referenced by a production registry entry.';
      }
    }
  }

  if (e.auth_type === 'oauth' && status !== 'REVOKED' && status !== 'MISCONFIGURED') {
    if (String(e.account_identifier || '').toLowerCase().includes('platform-managed')) {
      checks.push({
        check: 'platform_managed',
        ok: true,
        detail: 'Provider is managed by the hosting platform; app-side live verification is unavailable.',
      });
      status = 'DISCONNECTED';
      lastFailure = 'Live provider verification is unavailable from the app runtime.';
    } else {
      try {
        const conn = await sr.connectors?.getConnection?.(p);
        if (conn?.accessToken) {
          checks.push({
            check: 'oauth_configured',
            ok: true,
            detail: 'Connector authorization is configured; live provider verification is still required.',
          });
          status = 'DISCONNECTED';
          lastFailure = 'Live provider verification is required before activation.';
        } else {
          checks.push({ check: 'oauth_configured', ok: false, detail: 'Connector authorization is not configured.' });
          status = 'REAUTH_REQUIRED';
          lastFailure = 'OAuth connector authorization is required.';
        }
      } catch (_) {
        checks.push({ check: 'oauth_configured', ok: false, detail: 'Connector authorization check failed.' });
        status = 'REAUTH_REQUIRED';
        lastFailure = 'OAuth connector authorization needs attention.';
      }
    }
  }

  if (e.auth_type === 'per_connection' && status !== 'REVOKED' && status !== 'MISCONFIGURED') {
    flags.push('decentralized_credentials');
    checks.push({
      check: 'per_connection_storage',
      ok: true,
      detail: 'Credentials are stored on owner-scoped PlatformConnection records; registry activation requires separate provider evidence.',
    });
    status = 'DISCONNECTED';
    if (!lastFailure) lastFailure = 'Registry-level live provider verification is unavailable.';
  }

  if (p === 'cloudflare' && status !== 'REVOKED' && status !== 'MISCONFIGURED') {
    const cf = await verifyCloudflareToken();
    checks.push({ check: 'cloudflare_token_verified', ok: cf.ok, detail: cf.detail });
    if (cf.ok) {
      status = 'ACTIVE';
      providerVerified = true;
      lastFailure = '';
    } else {
      status = 'REAUTH_REQUIRED';
      lastFailure = 'Cloudflare authorization needs attention.';
    }
  }

  // Convex is historical evidence only in the Base44-authoritative runtime.
  // Keep the record for migration knowledge, but never manufacture ACTIVE state.
  if (p === 'convex') {
    checks.push({ check: 'legacy_backend', ok: true, detail: 'Historical backend record retained; not health-gated by Base44.' });
    status = 'DISCONNECTED';
    lastFailure = '';
    providerVerified = false;
  }

  if (e.dependencies && e.dependencies.length) {
    checks.push({ check: 'dependencies_referenced', ok: true, detail: e.dependencies.join(', ') });
  }

  // Absence of live verification is not evidence of an explicit disconnect.
  if (e.status === 'REAUTH_REQUIRED' && status === 'DISCONNECTED' && !providerVerified) {
    status = 'REAUTH_REQUIRED';
    lastFailure ||= 'Reauthorization remains pending; live provider verification is unavailable.';
    checks.push({ check: 'pending_reauthorization_preserved', ok: false,
      detail: 'No provider-backed result was available to close the reauthorization request.' });
  }

  const alertTitle = isUnhealthy(status) ? `[${p}] ${STATUS_LABEL[status] || status}` : '';
  const alertBody = lastFailure || `Integration "${p}" requires attention: ${status}.`;
  return { status, flags, checks, lastFailure, alertTitle, alertBody, providerVerified };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const entries = await sr.entities.PlatformAccessRegistry.list(undefined, 200);
    const now = new Date().toISOString();
    const report = [];

    for (const e of entries) {
      const before = e.status;
      const result = await validateEntry(sr, e);
      const update = {
        last_verified: now,
        status: result.status,
        cleanup_flags: result.flags,
        last_failure: result.lastFailure || '',
        auth_failures: result.status === 'ACTIVE' ? 0 : (e.auth_failures || 0),
      };
      if (result.status === 'ACTIVE' && result.providerVerified) {
        update.last_successful_verification = now;
      }
      await sr.entities.PlatformAccessRegistry.update(e.id, update);

      if (before !== result.status) {
        await logAudit(base44, {
          action: 'integration_status_change',
          actor_user_id: user.id,
          target_type: 'PlatformAccessRegistry',
          target_id: e.id,
          detail: `${e.platform}: ${before} -> ${result.status}`,
          status: 'success',
          metadata: { platform: e.platform, from: before, to: result.status, flags: result.flags },
        });
      }

      const isHistoricalConvex = String(e.platform || '').toLowerCase() === 'convex';
      if (!isHistoricalConvex && !e.optional && isUnhealthy(result.status)) {
        await emitIntegrationAlert(sr, { ...e, status: result.status }, result.alertTitle, result.alertBody);
      }

      report.push({
        platform: e.platform,
        status: result.status,
        provider_verified: result.providerVerified,
        flags: result.flags,
        checks: result.checks,
      });
    }

    return Response.json({ ok: true, checked: entries.length, at: now, report });
  } catch (error) {
    console.error('validateIntegrationHealth error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Integration health check could not complete.' }, { status: 500 });
  }
}
