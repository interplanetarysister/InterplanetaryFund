import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { ensureCanonicalCampaign } from '../../shared/base44Financial.ts';

// Retry-safe account deletion state machine. The account is deleted or
// anonymized LAST — never first — so a mid-process failure leaves the user
// intact and able to retry. Each stage is recorded in the AuditLog without PII
// (only the user id is recorded; never email or name).
//
// Stage 1 — AUTHORIZE (no deletion): confirm the caller is the authenticated
//   user. A prior run already in progress (account_deletion_pending) skips
//   straight to cleanup.
// Stage 2 — MARK PENDING + REVOKE ACCESS: set account_deletion_pending. The app
//   revokes access for a pending account (frontend guard in AuthContext), so
//   the user can no longer use the platform while cleanup runs.
// Stage 3 — DATA CLEANUP: every step is idempotent (deleteMany/updateMany on
//   already-empty / already-anonymized sets), so a retry after a mid-wipe
//   failure resumes cleanly.
// Stage 4 — DELETE OR ANONYMIZE LAST: attempt User.delete. If the platform
//   refuses (e.g. the app owner cannot be deleted), anonymize the remaining
//   custom data so the account is inert; the built-in identity fields cannot
//   be cleared.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;

    const audit = (action, status, detail) => logAudit(base44, {
      action,
      actor_user_id: user.id,
      target_type: 'user',
      target_id: user.id,
      detail: detail || '',
      status: status || 'success',
    });

    // ---- Stage 1: authorize (no deletion) ----
    const fresh = await sr.entities.User.get(user.id).catch(() => null);
    if (!fresh) {
      // Account already gone from a completed prior run.
      return Response.json({ deleted: true, resumed: true });
    }
    const resuming = !!fresh.account_deletion_pending;
    if (!resuming) {
      await audit('account_deletion_authorized', 'success', 'Deletion authorized; no data touched yet.');
    }

    // Financial obligations must outlive an account. Refuse deletion while
    // money is reserved, under review, awaiting reconciliation, or still owed
    // to one of the user's campaigns. This prevents a privacy action from
    // destroying the ownership/reconciliation trail for real funds.
    const openWithdrawals = await sr.entities.Withdrawal.filter({ owner_user_id: user.id }).catch(() => []);
    const blockingWithdrawal = (openWithdrawals || []).find((w) => !['paid', 'failed', 'cancelled'].includes(w.status));
    if (blockingWithdrawal) {
      return Response.json({ error: 'Your account has a withdrawal still being processed or reviewed. Finish or resolve it before deleting the account.' }, { status: 409 });
    }
    const ownedCampaigns = await sr.entities.Campaign.filter({ created_by_id: user.id }).catch(() => []);
    for (const campaign of ownedCampaigns || []) {
      let financial;
      try {
        financial = await ensureCanonicalCampaign(sr, campaign);
      } catch (_) {
        return Response.json({ error: 'We could not safely verify that this campaign has no remaining funds. Resolve the campaign balance before deleting the account.' }, { status: 409 });
      }
      if (Number(financial.availableBalance || 0) > 0) {
        return Response.json({ error: 'Your account still has campaign funds available to withdraw. Withdraw or resolve those funds before deleting the account.' }, { status: 409 });
      }
    }

    // ---- Stage 2: mark pending + revoke access ----
    if (!resuming) {
      await sr.entities.User.update(user.id, { account_deletion_pending: true });
      await audit('account_deletion_pending', 'success', 'Access revoked; cleanup will run next.');
    }

    // ---- Stage 3: stop future provider billing before local cleanup ----
    const runStep = async (name, fn) => {
      try {
        await fn();
      } catch (stepErr) {
        const detail = stepErr && stepErr.message ? stepErr.message : String(stepErr);
        console.error(`deleteAccount step "${name}" failed:`, detail);
        await audit('account_deletion_failed', 'failure', `Step "${name}" failed: ${detail}`);
        throw stepErr;
      }
    };

    await runStep('provider_billing', async () => {
      const stripeKey = String(secrets.get('STRIPE_SECRET_KEY') || '');
      const hasProviderBilling = !!fresh.stripe_customer_id || fresh.subscription_status === 'active' || fresh.subscription_status === 'trialing' || fresh.subscription_status === 'past_due';
      if (!stripeKey.startsWith('sk_live_')) {
        if (hasProviderBilling) throw new Error('Live billing access is unavailable; provider subscriptions cannot be safely cancelled.');
        return;
      }
      const stripe = new Stripe(stripeKey);

      // Cancel the user's IFund plan subscriptions, if any.
      if (fresh.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({ customer: fresh.stripe_customer_id, status: 'all', limit: 100 });
        for (const subscription of subscriptions.data || []) {
          if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
            await stripe.subscriptions.cancel(subscription.id);
          }
        }
      }

      // Cancel recurring donations initiated by this user. Checkout Session is
      // the stored provider reference; resolve it to the actual subscription.
      const recurring = await sr.entities.Donation.filter({
        donor_user_id: user.id,
        payment_method: 'stripe',
        is_recurring: true,
        payment_verified: true,
      }, 'created_date', 1000).catch(() => []);
      const sessionIds = [...new Set((recurring || []).map((d) => String(d.stripe_session_id || '')).filter((id) => id.startsWith('cs_')))];
      for (const sessionId of sessionIds) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (!subscriptionId) continue;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
          await stripe.subscriptions.cancel(subscriptionId);
        }
      }
    });

    // ---- Stage 4: data cleanup (idempotent) ----
    await runStep('personal_data', async () => {
      await sr.entities.FollowedCampaign.deleteMany({ user_id: user.id });
      await sr.entities.Notification.deleteMany({ user_id: user.id });
      await sr.entities.InboxItem.deleteMany({ user_id: user.id });
      await sr.entities.MissionBrief.deleteMany({ created_by_id: user.id });
      await sr.entities.Recommendation.deleteMany({ created_by_id: user.id });
      await sr.entities.Recommendation.deleteMany({ owner_user_id: user.id });
      await sr.entities.AgentActivity.deleteMany({ owner_user_id: user.id });
      await sr.entities.AgentDelegation.deleteMany({ owner_user_id: user.id });
      await sr.entities.Message.deleteMany({ created_by_id: user.id });
      await sr.entities.CommunityMember.deleteMany({ user_id: user.id });
      await sr.entities.VolunteerSignup.deleteMany({ user_id: user.id });
      await sr.entities.DiscussionPost.deleteMany({ created_by_id: user.id });
      await sr.entities.DiscussionReply.deleteMany({ created_by_id: user.id });
      await sr.entities.GrantApplication.deleteMany({ applicant_user_id: user.id });
    });

    await runStep('anonymize_donations', async () => {
      await sr.entities.Donation.updateMany(
        { donor_user_id: user.id, recurring_status: 'active' },
        { $set: { recurring_status: 'cancelled' } }
      );
      await sr.entities.Donation.updateMany(
        { donor_user_id: user.id },
        { $set: { donor_user_id: '', donor_name: 'Deleted user', message: '' } }
      );
    });

    await runStep('owned_campaigns', async () => {
      const campaigns = await sr.entities.Campaign.filter({ created_by_id: user.id });
      for (const c of campaigns) {
        await sr.entities.CampaignUpdate.deleteMany({ campaign_id: c.id });
        await sr.entities.DistributedPost.deleteMany({ campaign_id: c.id });
        await sr.entities.AgentActivity.deleteMany({ campaign_id: c.id });
        await sr.entities.AgentDelegation.deleteMany({ owner_user_id: user.id, campaign_id: c.id });
        // Preserve the campaign id itself because Donation, Withdrawal,
        // FinancialOperation and HoldingLedgerEntry records may legally and
        // operationally reference it. Remove public/personal campaign content.
        await sr.entities.Campaign.update(c.id, {
          title: 'Deleted account campaign',
          summary: '',
          story: '',
          status: 'paused',
          cover_image_url: '',
          location: '',
          location_lat: null,
          location_lng: null,
          ai_profile: {},
          story_versions: [],
          outreach_enabled: false,
          outreach_paused: true,
        });
      }
    });

    await runStep('financial_identity_redaction', async () => {
      // Preserve immutable amounts, provider references, status, fee and
      // reconciliation history while removing redundant display PII.
      await sr.entities.Withdrawal.updateMany(
        { owner_user_id: user.id },
        { $set: { user_name: 'Deleted user', paypal_email: '' } }
      );
    });

    await runStep('connections', async () => {
      await sr.entities.PlatformConnection.deleteMany({ created_by_id: user.id });
    });

    await audit('account_deletion_cleanup_done', 'success', 'Personal data removed; financial records retained and redacted where required.');

    // ---- Stage 5: delete or anonymize the account LAST ----
    try {
      await sr.entities.User.delete(user.id);
      await audit('account_deleted', 'success', 'Account deleted after data wipe.');
      return Response.json({ deleted: true });
    } catch (delErr) {
      // The platform refused to delete the account (e.g. the app owner). Keep
      // the account but anonymize every custom field so it is inert. The
      // built-in identity fields (id, email, full_name) cannot be cleared.
      const reason = delErr && delErr.message ? delErr.message : String(delErr);
      console.error('deleteAccount: User.delete not permitted, anonymizing:', reason);
      await sr.entities.User.update(user.id, {
        onboarding: {},
        comm_prefs: {},
        subscription_tier: 'free',
        subscription_status: 'none',
        subscription_renews_at: null,
        trial_end: null,
        stripe_customer_id: '',
        username: '',
        account_deletion_pending: true,
        account_status: 'disabled',
      });
      await audit('account_anonymized', 'success', 'Account could not be deleted; custom data anonymized. Built-in identity (id, email, full_name) is retained by the Base44 platform and cannot be cleared by the application.');
      return Response.json({ anonymized: true, reason: 'Account anonymized.' });
    }
  } catch (error) {
    console.error('deleteAccount error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to delete your account. Please try again or contact support.' }, { status: 500 });
  }
}