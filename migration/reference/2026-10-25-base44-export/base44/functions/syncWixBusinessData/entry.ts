import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const URLS = {
  contacts: 'https://www.wixapis.com/contacts/v4/contacts?fieldsets=FULL&paging.limit=100',
  orders: 'https://www.wixapis.com/ecom/v1/orders/search',
  marketing: 'https://www.wixapis.com/email-marketing/v1/campaigns',
};

async function upsert(sr: any, owner: string, type: string, externalId: string, data: any, status = '') {
  const key = { provider: 'wix', record_type: type, external_id: externalId, owner_user_id: owner };
  const existing = (await sr.entities.ExternalPlatformRecord.filter(key))[0];
  const value = { ...key, status, data, observed_at: new Date().toISOString() };
  return existing ? sr.entities.ExternalPlatformRecord.update(existing.id, value) : sr.entities.ExternalPlatformRecord.create(value);
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const conn = await base44.asServiceRole.connectors.getConnection('wix');
    if (!conn?.accessToken) return Response.json({ error: 'Wix is not connected.' }, { status: 409 });
    const auth = { Authorization: `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json' };
    const sr = base44.asServiceRole;

    const contactsRes = await fetch(URLS.contacts, { headers: auth });
    const contactsBody = contactsRes.ok ? await contactsRes.json() : { contacts: [] };
    let contacts = 0, leads = 0;
    for (const c of contactsBody.contacts || []) {
      await upsert(sr, user.id, 'contact', String(c.id), c, 'observed');
      contacts++;
      const activity = String(c?.info?.lastActivity?.activityType || '');
      if (['FORM_SUBMITTED','INBOX_FORM_SUBMITTED','CONTACT_CREATED'].includes(activity)) {
        await upsert(sr, user.id, 'lead', String(c.id), { contact: c, lead_signal: activity }, 'observed');
        leads++;
      }
    }

    const ordersRes = await fetch(URLS.orders, { method: 'POST', headers: auth, body: JSON.stringify({ search: { cursorPaging: { limit: 100 } } }) });
    const ordersBody = ordersRes.ok ? await ordersRes.json() : { orders: [] };
    let orders = 0;
    for (const o of ordersBody.orders || []) {
      await upsert(sr, user.id, 'order', String(o.id), o, String(o.paymentStatus || o.status || 'observed'));
      orders++;
    }

    const marketingRes = await fetch(URLS.marketing, { headers: auth });
    const marketingBody = marketingRes.ok ? await marketingRes.json() : { campaigns: [] };
    let marketing = 0;
    for (const m of marketingBody.campaigns || []) {
      const id = String(m.campaignId || m.id || '');
      if (!id) continue;
      await upsert(sr, user.id, 'marketing', id, m, String(m.distributionStatus || m.status || 'observed'));
      marketing++;
    }

    // Wix orders remain external commerce observations. They do not create
    // IFund Donation records or withdrawable balances without a separate,
    // provider-verified settlement/reconciliation path.
    return Response.json({ ok: contactsRes.ok && ordersRes.ok && marketingRes.ok, contacts, leads, orders, marketing });
  } catch (error) {
    console.error('syncWixBusinessData error:', error?.message || error);
    return Response.json({ error: 'Wix business data could not be synchronized.' }, { status: 500 });
  }
}