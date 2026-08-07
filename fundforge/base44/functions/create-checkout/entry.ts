import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const body = await req.json();
    const { campaign_id, campaign_title, amount, message, currency, donor_user_id } = body;

    const amt = Number(amount);
    if (!amt || amt < 0.5) {
      return Response.json({ error: 'Minimum donation is $0.50' }, { status: 400 });
    }

    const origin = req.headers.get('Origin') || req.headers.get('origin');
    if (!origin) {
      return Response.json({ error: 'Missing origin' }, { status: 400 });
    }

    const apiKey = secrets.get('WIX_PAYMENTS_API_KEY');
    const siteId = secrets.get('WIX_PAYMENTS_SITE_ID');

    const itemName = `Donation: ${campaign_title || 'Fundraiser'}`.slice(0, 255);

    const resp = await fetch(
      'https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'wix-site-id': siteId
        },
        body: JSON.stringify({
          cart: {
            items: [{ name: itemName, quantity: 1, price: amt.toFixed(2) }]
          },
          callbackUrls: {
            postFlowUrl: `${origin}/discover`,
            thankYouPageUrl: `${origin}/thank-you`
          }
        })
      }
    );

    const data = await resp.json();
    if (!resp.ok || !data.checkoutSession) {
      console.error('Wix checkout error', resp.status, JSON.stringify(data));
      return Response.json({ error: 'Could not start checkout' }, { status: 502 });
    }

    const session = data.checkoutSession;

    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.Donation.create({
      campaign_id,
      campaign_title: campaign_title || '',
      donor_name: 'Pending',
      donor_user_id: donor_user_id || '',
      donor_email: '',
      summary_url: `${origin}/donations`,
      amount: amt,
      currency: currency || 'USD',
      platform: 'direct',
      message: message || '',
      checkout_id: session.id,
      status: 'pending'
    });

    return Response.json({ redirectUrl: session.redirectUrl });
  } catch (error) {
    console.error('create-checkout error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}