import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { paypalBillingRequest, getPayPalBillingSubscription, isPayPalSubscriptionId } from '../../shared/paypalSubscriptions.ts';
import { reconcilePayPalSubscription } from '../../shared/paypalSubscriptionReconcile.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const id = String(user.paypal_subscription_id || '');
    if (user.subscription_provider !== 'paypal' || !isPayPalSubscriptionId(id)) {
      return Response.json({ error: 'You do not have a PayPal subscription to cancel.' }, { status: 409 });
    }
    const sr = base44.asServiceRole;
    const intents = await sr.entities.PayPalSubscriptionIntent.filter({ paypal_subscription_id: id, user_id: user.id });
    if (!(intents || []).length) return Response.json({ error: 'Subscription ownership could not be confirmed.' }, { status: 403 });
    const remote = await getPayPalBillingSubscription(id);
    if (!['CANCELLED','EXPIRED'].includes(remote.status)) {
      await paypalBillingRequest('/v1/billing/subscriptions/' + encodeURIComponent(id) + '/cancel', {
        method: 'POST',
        requestId: 'IFUND_CANCEL_' + id,
        body: { reason: 'The IFund subscriber canceled their subscription.' },
      });
    }
    const result = await reconcilePayPalSubscription(sr, id, user.id);
    return Response.json({ ok: result.status === 'canceled', status: result.status });
  } catch (error) {
    console.error('cancelPayPalSubscription:', error?.name || 'UnknownError');
    return Response.json({ error: 'Cancellation could not be confirmed. Check PayPal before retrying.' }, { status: 503 });
  }
}