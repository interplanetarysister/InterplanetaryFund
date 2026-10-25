import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { verifiedPayPalPlan, paypalBillingRequest, IFUND_PAYPAL_ACCOUNT_REF, permittedPayPalCheckoutOrigin } from '../../shared/paypalSubscriptions.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'subscription_checkout'))) return featureUnavailable('Subscription checkout');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role === 'admin') return Response.json({ error: 'Admin already has permanent top-tier access.' }, { status: 409 });
    if (user.subscription_status === 'active' || user.subscription_status === 'trialing' || user.subscription_status === 'past_due') {
      return Response.json({ error: 'Manage your existing subscription before starting another paid plan.' }, { status: 409 });
    }
    const { tier, interval, origin } = await req.json().catch(() => ({}));
    const approvedOrigin = permittedPayPalCheckoutOrigin(origin);
    if (!approvedOrigin) return Response.json({ error: 'Invalid return location.' }, { status: 400 });
    const sr = base44.asServiceRole;
    if (tier === 'nonprofit') {
      const approvals = await sr.entities.NonprofitSubscriptionApproval.filter({ user_id: user.id });
      if (!(approvals || []).some(row => row.status === 'approved')) {
        return Response.json({ error: 'The nonprofit discount requires IFund to verify your nonprofit registration.' }, { status: 403 });
      }
    }
    const webhookRows = await sr.entities.PayPalBillingWebhook.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    }).catch(() => []);
    if (!(webhookRows || []).some(row => row.webhook_id && row.url)) {
      return Response.json({ error: 'PayPal subscription notifications are not configured.' }, { status: 503 });
    }
    const verified = await verifiedPayPalPlan(sr, String(tier || ''), String(interval || ''));
    if (!verified) return Response.json({ error: 'This PayPal subscription price is not yet configured or verified.' }, { status: 503 });
    // Intent is recorded BEFORE contacting PayPal so a provider callback can
    // never grant another user's plan.
    const intent = await sr.entities.PayPalSubscriptionIntent.create({
      user_id: user.id, tier, interval, plan_id: verified.row.plan_id,
      custom_id: 'IFUND-' + crypto.randomUUID(),
      account_ref: IFUND_PAYPAL_ACCOUNT_REF, status: 'initiated',
      created_at: new Date().toISOString(),
    });
    const subscription = await paypalBillingRequest('/v1/billing/subscriptions', {
      method: 'POST', requestId: 'IFUND_SUB_' + intent.id,
      body: {
        plan_id: verified.row.plan_id, custom_id: intent.custom_id,
        application_context: {
          brand_name: 'Interplanetary Fund',
          user_action: 'SUBSCRIBE_NOW',
          return_url: approvedOrigin + '/subscriptions?paypal_checkout=return',
          cancel_url: approvedOrigin + '/subscriptions?paypal_checkout=cancel',
        },
      },
    });
    const approve = subscription?.links?.find(item => item.rel === 'approve')?.href;
    if (!subscription?.id || !/^https:\/\/(www\.)?paypal\.com\//.test(String(approve || ''))) {
      throw new Error('PayPal subscription approval link unavailable.');
    }
    await sr.entities.PayPalSubscriptionIntent.update(intent.id, {
      paypal_subscription_id: subscription.id, status: 'approval_pending',
    });
    return Response.json({ url: approve, pending: true });
  } catch (error) {
    console.error('createPayPalSubscriptionCheckout:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to start PayPal subscription. No plan access has been granted.' }, { status: 503 });
  }
}