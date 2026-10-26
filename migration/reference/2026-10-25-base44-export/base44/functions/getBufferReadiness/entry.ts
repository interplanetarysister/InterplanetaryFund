import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Admin-only Buffer readiness check. This is read-only and never publishes,
// stores provider credentials in an entity, or authorizes an IFund user.
export default async function (req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user?.role !== 'admin') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const apiKey = String(secrets.get('BUFFER_API_KEY') || '').trim();
    const clientId = String(secrets.get('BUFFER_CLIENT_ID') || '').trim();
    const clientSecret = String(secrets.get('BUFFER_CLIENT_SECRET') || '').trim();
    const configured = {
      personal_api_key: apiKey.length > 0,
      oauth_client_id: clientId.length > 0,
      oauth_client_secret: clientSecret.length > 0,
    };

    const baseResult = {
      configured,
      personal_account_verified: false,
      oauth_callback_verified: false,
      user_oauth_verified: false,
      posting_verified: false,
      messaging_supported: false,
    };

    if (!apiKey) {
      return Response.json({ ...baseResult, status: 'personal_key_missing' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      // Official Buffer GraphQL read-only health query.
      const response = await fetch('https://api.buffer.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: 'query IFundBufferOrganizations { account { organizations { id } } }',
        }),
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return Response.json({ ...baseResult, status: 'personal_key_rejected' });
      }
      if (!response.ok) {
        return Response.json({ ...baseResult, status: 'provider_unavailable' });
      }
      const result = await response.json();
      if (result?.errors?.length || !Array.isArray(result?.data?.account?.organizations)) {
        return Response.json({ ...baseResult, status: 'provider_query_failed' });
      }
      return Response.json({
        ...baseResult,
        status: 'personal_account_verified',
        personal_account_verified: true,
        organization_count: result.data.account.organizations.length,
      });
    } catch {
      return Response.json({ ...baseResult, status: 'provider_unavailable' });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('getBufferReadiness failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Buffer readiness could not be checked.' }, { status: 500 });
  }
}
