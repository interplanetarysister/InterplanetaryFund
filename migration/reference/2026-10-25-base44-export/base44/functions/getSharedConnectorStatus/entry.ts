import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Surfaces the status of SHARED (platform-managed) connectors — the platform
// Slack bot and Wix site sync — which by design have no per-user
// PlatformConnection record and therefore never appear in listConnections().
// The Connections page calls this to show platform-managed integrations as
// connected alongside user-owned connections.
//
// Verification is provider-backed where possible (Slack auth.test). No tokens
// or credential values are ever returned — only connection state and a redacted
// identity summary.

const SHARED_CONNECTORS = [
  { type: 'slackbot', platform: 'slack', name: 'Slack Bot', kind: 'app', icon: '💬',
    note: 'Platform-wide bot for announcements and mentions. Managed by admins.' },
  { type: 'wix', platform: 'wix', name: 'Wix', kind: 'app', icon: '🌐',
    note: 'Connected Wix site — read site data, manage content, and receive platform-managed webhooks. Managed by admins.' },
];

async function checkSlackBot(sr: any) {
  try {
    const conn = await sr.connectors.getConnection('slackbot');
    if (!conn?.accessToken) return { connected: false, verified: false };
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({}),
    });
    const auth = await res.json();
    if (auth.ok) {
      return {
        connected: true, verified: true,
        identity: {
          bot_user_id: auth.user_id || null,
          team: auth.team || null,
          team_id: auth.team_id || null,
          url: auth.url || null,
        },
        verified_at: new Date().toISOString(),
      };
    }
    return { connected: true, verified: false, last_error: 'Slack verification failed.' };
  } catch (e) {
    return { connected: false, verified: false, last_error: 'Slack verification could not complete.' };
  }
}

function connectorCapabilities(conn: any): string[] {
  const raw = conn?.capabilities || conn?.grantedCapabilities || conn?.scopes || conn?.scope;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[ ,]+/) : [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

async function checkWix(sr: any) {
  try {
    const conn = await sr.connectors.getConnection('wix');
    if (!conn?.accessToken) return { connected: false, verified: false, capabilities: [] };

    // A token is configuration evidence, not provider verification. Prove the
    // connector against Wix with a harmless authenticated, site-scoped read.
    const res = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${conn.accessToken}` },
    });
    if (!res.ok) {
      return {
        connected: true,
        verified: false,
        capabilities: connectorCapabilities(conn),
        last_error: 'Wix verification failed.',
      };
    }

    const body = await res.json().catch(() => ({}));
    return {
      connected: true,
      verified: true,
      capabilities: connectorCapabilities(conn),
      identity: {
        site_display_name: body?.properties?.siteDisplayName || null,
        business_name: body?.properties?.businessName || null,
        language: body?.properties?.language || null,
        currency: body?.properties?.paymentCurrency || null,
        time_zone: body?.properties?.timeZone || null,
      },
      verified_at: new Date().toISOString(),
    };
  } catch (e) {
    return {
      connected: false,
      verified: false,
      capabilities: [],
      last_error: 'Wix verification could not complete.',
    };
  }
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const results = [];
    for (const c of SHARED_CONNECTORS) {
      const status = c.type === 'slackbot' ? await checkSlackBot(sr) : await checkWix(sr);
      results.push({ ...c, ...status });
    }
    return Response.json({ shared: results });
  } catch (error) {
    console.error('getSharedConnectorStatus error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not check platform integrations.' }, { status: 500 });
  }
}