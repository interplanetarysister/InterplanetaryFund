import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

// One free, card-free, three-day Basic trial per new account.
// Trial access is enforced against trial_end in both client and backend entitlements.
export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'subscription_checkout'))) return featureUnavailable('Premium trials');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role === 'admin') return Response.json({ error: 'Admin access is already included.' }, { status: 409 });
    const hasPaidHistory = Boolean(user.stripe_customer_id || user.paypal_subscription_id);
    const trialAlreadyUsed = Boolean(user.premium_trial_started_at || user.trial_end);
    const alreadySubscribed = ['active', 'trialing', 'past_due'].includes(String(user.subscription_status));
    const passActive = Date.parse(String(user.premium_day_pass_expires_at || '')) > Date.now();
    if (hasPaidHistory || trialAlreadyUsed || alreadySubscribed || passActive) {
      return Response.json({ error: 'The introductory trial is available once to new members without active premium access.' }, { status: 409 });
    }
    const startedAt = new Date();
    const trialEnd = new Date(startedAt.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await base44.asServiceRole.entities.User.update(user.id, {
      subscription_tier: 'basic',
      subscription_status: 'trialing',
      subscription_interval: 'monthly',
      premium_trial_started_at: startedAt.toISOString(),
      trial_end: trialEnd,
    });
    return Response.json({ ok: true, trial_end: trialEnd, charged: false, renewal_scheduled: false });
  } catch (error) {
    console.error('startPremiumTrial:', error?.name || 'UnknownError');
    return Response.json({ error: 'Trial could not be started. Please try again.' }, { status: 503 });
  }
}
