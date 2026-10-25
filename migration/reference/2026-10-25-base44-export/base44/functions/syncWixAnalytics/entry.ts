import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const conn = await base44.asServiceRole.connectors.getConnection('wix');
    if (!conn?.accessToken) return Response.json({ error: 'Wix is not connected.' }, { status: 409 });
    const end = new Date();
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0,10);
    const url = new URL('https://www.wixapis.com/analytics-ng/v2/site-analytics/data');
    url.searchParams.set('dateRange.startDate', fmt(start));
    url.searchParams.set('dateRange.endDate', fmt(end));
    for (const m of ['TOTAL_SESSIONS','TOTAL_ORDERS','TOTAL_FORMS_SUBMITTED','TOTAL_UNIQUE_VISITORS','CLICKS_TO_CONTACT']) {
      url.searchParams.append('measurementTypes', m);
    }
    // The API spec maps dateRange and measurementTypes to query parameters.
    // This exact shape was provider-verified against the live Wix site.
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    });
    if (!r.ok) return Response.json({ error: 'Wix analytics are unavailable.', status: r.status }, { status: 502 });
    const body = await r.json();
    const sr = base44.asServiceRole;
    const externalId = `site-analytics-${fmt(start)}-${fmt(end)}`;
    const key = { provider: 'wix', record_type: 'analytics', external_id: externalId, owner_user_id: user.id };
    const existing = (await sr.entities.ExternalPlatformRecord.filter(key))[0];
    const value = { ...key, status: 'observed', data: body, observed_at: new Date().toISOString() };
    existing ? await sr.entities.ExternalPlatformRecord.update(existing.id, value) : await sr.entities.ExternalPlatformRecord.create(value);
    return Response.json({ ok: true, range: { start: fmt(start), end: fmt(end) }, data: body.data || [] });
  } catch (error) {
    console.error('syncWixAnalytics error:', error?.message || error);
    return Response.json({ error: 'Wix analytics could not be synchronized.' }, { status: 500 });
  }
}