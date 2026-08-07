import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { jwtVerify, importSPKI } from 'npm:jose@5.9.6';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const publicKey = secrets.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
    if (!publicKey) {
      console.error('Missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
      return Response.json({ error: 'no key' }, { status: 500 });
    }

    const raw = await req.text();
    const key = await importSPKI(publicKey, 'RS256');
    const { payload } = await jwtVerify(raw, key, { algorithms: ['RS256'] });

    const event = JSON.parse(payload.data);
    const eventData = JSON.parse(event.data);

    const base44 = createClientFromRequest(req);

    if (event.eventType === 'wix.ecom.v1.order_approved') {
      const order = eventData.actionEvent.body.order;
      const checkoutId = order.checkoutId;
      const amount = Number(order.priceSummary?.total?.amount || 0);

      const pending = await base44.asServiceRole.entities.Donation.filter({ checkout_id: checkoutId });
      if (pending.length > 0) {
        const donation = pending[0];
        if (donation.status !== 'paid') {
          const cd = order.billingInfo?.contactDetails || {};
          const email = cd.email || order.buyerInfo?.email || '';
          const name = [cd.firstName, cd.lastName].filter(Boolean).join(' ') || email || 'Anonymous';
          await base44.asServiceRole.entities.Donation.update(donation.id, {
            status: 'paid',
            donor_name: name,
            donor_email: email
          });
          const camp = await base44.asServiceRole.entities.Campaign.get(donation.campaign_id);
          if (camp) {
            await base44.asServiceRole.entities.Campaign.update(camp.id, {
              raised: (camp.raised || 0) + amount
            });
          }
        }
      }
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('webhook error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}