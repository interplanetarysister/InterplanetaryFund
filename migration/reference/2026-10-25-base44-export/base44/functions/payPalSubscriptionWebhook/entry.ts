import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyWebhookSignature } from '../../shared/paypal.ts';
import { reconcilePayPalSubscription } from '../../shared/paypalSubscriptionReconcile.ts';
import { IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypalSubscriptions.ts';

const EVENTS = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
]);
export default async function(req) {
  // Public, no-credential route probe for provisioning. Never claims
  // that a live webhook is already registered.
  if (req.method === 'GET') return Response.json({ type: 'ifund_paypal_subscription_webhook', ready: true });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const hooks = await sr.entities.PayPalBillingWebhook.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    });
    const registered = (hooks || []).find(row => row.webhook_id && row.url);
    if (!registered) return Response.json({ error: 'PayPal subscription webhook has not been registered.' }, { status: 503 });
    const raw = await req.text();
    if (raw.length > 150000) return Response.json({ error: 'Webhook payload too large.' }, { status: 413 });
    const verified = await verifyWebhookSignature(raw, req.headers, registered.webhook_id);
    if (!verified) return Response.json({ error: 'Invalid PayPal webhook signature.' }, { status: 401 });
    const event = JSON.parse(raw);
    const type = String(event.event_type || '');
    const eventId = String(event.id || '');
    if (!/^WH-[A-Z0-9-]{8,90}$/.test(eventId)) return Response.json({ error: 'Invalid PayPal webhook event.' }, { status: 400 });
    if (!EVENTS.has(type)) return Response.json({ received: true, ignored: true });
    // PAYMENT.SALE events use resource.id for the SALE, not the subscription.
    // Their billing_agreement_id is the I-* subscription reference.
    const subscriptionId = type.startsWith('PAYMENT.SALE.')
      ? String(event.resource?.billing_agreement_id || '')
      : String(event.resource?.id || '');
    // Subscription-event resources contain the actual subscription ID;
    // payment-sale IDs are deliberately not used to mutate entitlements.
    if (!/^I-[A-Z0-9]{10,30}$/.test(subscriptionId)) {
      return Response.json({ received: true, ignored: true, reason: 'no_subscription_reference' });
    }
    const key = 'paypal_subscriptions:' + eventId;
    const seen = await sr.entities.WebhookEvent.filter({ source: 'paypal_subscriptions', event_key: key });
    let record = (seen || [])[0] || null;
    if (record?.state === 'nonfinancial_complete') return Response.json({ received: true, duplicate: true });
    if (!record) {
      record = await sr.entities.WebhookEvent.create({ source: 'paypal_subscriptions', event_key: key, event_type: type, state: 'claimed' });
    }
    try {
      if (type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.SALE.REVERSED') {
        const intents = await sr.entities.PayPalSubscriptionIntent.filter({ paypal_subscription_id: subscriptionId });
        for (const intent of intents || []) {
          if (intent.account_ref === IFUND_PAYPAL_ACCOUNT_REF) {
            await sr.entities.PayPalSubscriptionIntent.update(intent.id, {
              last_reversal_at: String(event.create_time || new Date().toISOString()),
            });
          }
        }
      }
      // The provider GET is authoritative, not the event payload/status.
      // A late CANCELLED event cannot overwrite a newly ACTIVE subscription.
      const result = await reconcilePayPalSubscription(sr, subscriptionId);
      await sr.entities.WebhookEvent.update(record.id, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
      return Response.json({ received: true, subscription_status: result.status });
    } catch (error) {
      await sr.entities.WebhookEvent.update(record.id, { state: 'failed', last_error: 'Subscription reconciliation needs retry.' }).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('payPalSubscriptionWebhook:', error?.name || 'UnknownError');
    return Response.json({ error: 'Webhook processing is incomplete; retry.' }, { status: 500 });
  }
}