import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { reconcilePayPalSubscription } from '../../shared/paypalSubscriptionReconcile.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const { subscription_id } = await req.json().catch(() => ({}));
    if (!/^I-[A-Z0-9]{10,30}$/.test(String(subscription_id || ''))) return Response.json({ error: 'Invalid subscription confirmation.' }, { status: 400 });
    const result = await reconcilePayPalSubscription(base44.asServiceRole, subscription_id, guard.user.id);
    return Response.json({ verified: result.status === 'active', status: result.status, tier: result.status === 'active' ? result.tier : undefined });
  } catch (error) {
    console.error('confirmPayPalSubscription:', error?.name || 'UnknownError');
    return Response.json({ error: 'Your PayPal subscription has not yet been verified. No paid access has been granted.' }, { status: 409 });
  }
}