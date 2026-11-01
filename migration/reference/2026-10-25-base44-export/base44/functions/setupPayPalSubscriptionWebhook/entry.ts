import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { paypalBillingRequest, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypalSubscriptions.ts';
const SUB_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
];
const URL = 'https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook';
export default async function(req) {
  // A non-secret stage code makes administrator repairs diagnosable without
  // exposing provider responses or any PayPal credential to the browser.
  let stage = 'authorize';
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const admin = guard.user;
    if (admin.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    // The public callback route is independently smoke-tested before rollout.
    // Calling the same Base44 deployment URL from inside its own function
    // runtime can fail due to edge routing even while external GET returns 200.
    // Guard the fixed first-party callback URL, then require PayPal to confirm
    // registration before persisting any webhook as billing-ready.
    stage = 'validate_callback_url';
    const callback = new globalThis.URL(URL);
    if (callback.protocol !== 'https:' ||
        callback.origin !== 'https://interplanetaryfund.base44.app' ||
        callback.pathname !== '/functions/payPalSubscriptionWebhook' ||
        callback.search || callback.hash) {
      return Response.json({ error: 'The trusted PayPal webhook URL is invalid.' }, { status: 503 });
    }
    const sr = base44.asServiceRole;
    stage = 'read_saved_webhooks';
    const hooks = await sr.entities.PayPalBillingWebhook.filter({ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF });
    const existing = (hooks || []).find(row => row.url === URL && row.webhook_id);
    if (existing) {
      stage = 'verify_paypal_webhook';
      const remote = await paypalBillingRequest('/v1/notifications/webhooks/' + encodeURIComponent(existing.webhook_id)).catch(() => null);
      const enabled = new Set((remote?.event_types || []).map(item => item.name));
      if (remote?.url === URL && SUB_EVENTS.every(e => enabled.has(e) || enabled.has('*'))) {
        return Response.json({ ok: true, webhook_registered: true, existing: true });
      }
      return Response.json({ error: 'Existing PayPal webhook needs reconciliation. No second webhook was created.' }, { status: 409 });
    }
    // Reuse a matching remote webhook when local persistence was interrupted.
    stage = 'list_paypal_webhooks';
    const remoteList = await paypalBillingRequest('/v1/notifications/webhooks');
    const matching = (remoteList.webhooks || []).find(row => row.url === URL &&
      SUB_EVENTS.every(e => (row.event_types || []).some(t => t.name === e || t.name === '*')));
    stage = 'register_paypal_webhook';
    const hook = matching || await paypalBillingRequest('/v1/notifications/webhooks', {
      method: 'POST', requestId: 'IFUND_SUBSCRIPTION_WEBHOOK_202610',
      body: { url: URL, event_types: SUB_EVENTS.map(name => ({ name })) },
    });
    if (!hook?.id) throw new Error('PayPal did not confirm the subscription webhook.');
    stage = 'verify_registered_webhook';
    const remote = await paypalBillingRequest('/v1/notifications/webhooks/' + encodeURIComponent(hook.id));
    const grantedEvents = new Set((remote?.event_types || []).map(e => e.name));
    if (remote?.url !== URL || !SUB_EVENTS.every(e => grantedEvents.has(e) || grantedEvents.has('*'))) {
      throw new Error('PayPal has not confirmed the callback URL and required events.');
    }
    stage = 'save_verified_webhook';
    await sr.entities.PayPalBillingWebhook.create({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      webhook_id: hook.id, url: URL, events: SUB_EVENTS,
      verified_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, webhook_registered: true, existing: !!matching });
  } catch (error) {
    console.error('setupPayPalSubscriptionWebhook:', error?.name || 'UnknownError');
    return Response.json({ error: 'PayPal subscription webhook provisioning could not finish.', stage }, { status: 503 });
  }
}