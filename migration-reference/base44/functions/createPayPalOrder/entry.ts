import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createOrder } from '../../shared/paypal.ts';

// Creates a PayPal v2 order (intent: CAPTURE) for a Google Pay donation. The
// order id is handed to the PayPal SDK's Google Pay session to confirm with
// the buyer's Google Pay payment data, then captured separately.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { campaign_id, amount, donor_name, message } = await req.json();
    const value = parseFloat(amount);
    if (!campaign_id || !value || value <= 0) {
      return Response.json({ error: 'A campaign and a positive amount are required' }, { status: 400 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const order = await createOrder({
      amount: value,
      description: `Donation to ${campaign.title}`,
      metadata: {
        campaign_id,
        donor_name: donor_name || 'Anonymous',
        message: (message || '').slice(0, 250),
      },
    });

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('createPayPalOrder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}