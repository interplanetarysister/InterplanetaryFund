import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { createOrder } from '../../shared/paypal.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computePayPalBreakdown, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/base44Financial.ts';
import { campaignPaymentAccess } from '../../shared/prelaunchPayments.ts';
import { areFeaturesEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

// Creates an idempotent PayPal v2 order for PayPal Buttons, Google Pay, or Apple Pay. All financially
// meaningful values are encoded server-side into PayPal custom_id so capture
// can verify campaign, donation amount, processor fee, and optional platform
// contribution without trusting post-payment client input.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const paymentAccess = await campaignPaymentAccess(base44);
    if (!paymentAccess.allowed) return Response.json({ error: 'Campaign donations are currently paused. The platform remains open for campaigns and sharing.' }, { status: 409 });
    if (secrets.get('PAYPAL_MODE') !== 'live') return Response.json({ error: 'PayPal campaign payments are not currently available.' }, { status: 503 });
    const sr = base44.asServiceRole;

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });

    const { campaign_id, amount, platform_contribution, intent_id, payment_channel } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) return Response.json({ error: 'A campaign is required' }, { status: 400 });
    if (!intent_id || !/^[A-Za-z0-9_-]{16,100}$/.test(String(intent_id))) return Response.json({ error: 'A stable payment intent is required' }, { status: 400 });
    const channel = ['paypal', 'googlepay', 'applepay'].includes(payment_channel) ? payment_channel : '';
    if (!channel) return Response.json({ error: 'A supported payment channel is required' }, { status: 400 });
    if (!(await areFeaturesEnabled(base44, ['payment_checkout_enabled', channel === 'googlepay' ? 'google_pay_checkout' : channel === 'applepay' ? 'apple_pay_checkout' : 'paypal_checkout']))) return featureUnavailable('This payment method');
    const quote = computePayPalBreakdown(Number(amount), platform_contribution === true, channel);
    const totalCharge = quote.totalCharged;
    if (!(totalCharge > 0) || totalCharge > 1000000) return Response.json({ error: 'The total payment amount is too large.' }, { status: 400 });

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `createPayPalOrder:${ip}`, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    await ensureCanonicalCampaign(sr, campaign);

    const processing = quote.processing;
    const value = quote.amount; // promised campaign gift + optional tip
    const contribution = quote.contribution; // optional tip, added on top
    // Keep the user's pledged campaign gift intact; never silently reduce it
    // to fund platform support or PayPal processing.
    if (!(value > 0) || !(round2(value - contribution) > 0)) {
      return Response.json({ error: 'The campaign gift must remain positive.' }, { status: 400 });
    }
    const order = await createOrder({
      amount: totalCharge,
      description: `Donation to ${campaign.title}`,
      customId: [
        campaign_id,
        Math.round(value * 100),
        Math.round(processing * 100),
        Math.round(contribution * 100),
        channel,
        'gift_first_v2', // new orders only; old five-field orders retain original allocation
      ].join('|'),
      requestId: String(intent_id),
    });

    return Response.json({ id: order.id });
  } catch (error) {
    console.error('createPayPalOrder error:', error?.message || error);
    return Response.json({ error: 'Unable to start your donation. Please try again.' }, { status: 503 });
  }
}
