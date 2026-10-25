import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, round2, validateDonationAmount } from '../../shared/fees.js';
import { ensureCanonicalCampaign, recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';
import { reconcileCanonicalCampaignProjection } from '../../shared/base44Financial.ts';
import { sendDonationReceipt } from '../../shared/sendDonationReceipt.ts';
import { resolveStripeSubscriptionPrice } from '../../shared/stripeSubscriptionCatalog.ts';
import { PREMIUM_DAY_PASS_PRICE_ID, DAY_PASS_DURATION_MS, verifiedDayPassPrice } from '../../shared/premiumAccessCatalog.ts';

function webhookOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function getWebhookRecord(sr, eventKey, eventType) {
  let rows = await sr.entities.WebhookEvent.filter({ source: 'stripe', event_key: eventKey }).catch(() => []);
  let record = webhookOrder(rows)[0] || null;
  if (!record) {
    record = await sr.entities.WebhookEvent.create({
      source: 'stripe',
      event_key: eventKey,
      event_type: eventType,
      state: 'claimed',
      attempt_count: 1,
    });
  } else if (record.state !== 'side_effects_complete' && record.state !== 'nonfinancial_complete') {
    await sr.entities.WebhookEvent.update(record.id, {
      event_type: eventType,
      attempt_count: Number(record.attempt_count || 0) + 1,
      last_error: '',
    });
  }

  // The Base44 row is diagnostic/recovery state, not the financial lock. If
  // simultaneous deliveries created more than one row, converge to one row.
  rows = await sr.entities.WebhookEvent.filter({ source: 'stripe', event_key: eventKey }).catch(() => []);
  const ordered = webhookOrder(rows);
  record = ordered[0] || record;
  for (const duplicate of ordered.slice(1)) {
    await sr.entities.WebhookEvent.delete(duplicate.id).catch(() => {});
  }
  return record;
}

async function markWebhook(sr, record, patch) {
  if (!record?.id) return;
  await sr.entities.WebhookEvent.update(record.id, patch).catch(() => {});
}

function readFinancialMetadata(metadata, campaignId) {
  const m = metadata || {};
  if (!campaignId || m.campaign_id !== campaignId) throw new Error('Stripe metadata campaign mismatch.');
  const total = round2(Number.parseFloat(m.donation_amount));
  const processingFee = round2(Number.parseFloat(m.processing_fee || '0'));
  const contribution = m.platform_contribution_amount != null
    ? round2(Number.parseFloat(m.platform_contribution_amount))
    : computeContribution(total, m.platform_contribution_opt === 'true');

  const amountCheck = validateDonationAmount(total);
  if (!amountCheck.ok) throw new Error(amountCheck.error);
  if (!Number.isFinite(processingFee) || processingFee < 0) throw new Error('Invalid Stripe processing fee metadata.');
  if (!Number.isFinite(contribution) || contribution < 0 || contribution > total) throw new Error('Invalid Stripe contribution metadata.');
  return { total, processingFee, contribution };
}

async function applyStripeDonation({
  base44,
  sr,
  webhookRecord,
  campaignId,
  metadata,
  providerObjectId,
  providerObjectKind,
  providerTransactionId,
  amountCharged,
  currency,
  isRecurring,
  donorEmail,
  paymentRail = 'card',
}) {
  if (String(currency || '').toLowerCase() !== 'usd') throw new Error('Stripe currency mismatch.');
  if (providerObjectKind !== 'session' && providerObjectKind !== 'invoice') throw new Error('Unsupported Stripe financial object.');

  const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
  if (!campaign) throw new Error('Campaign not found for Stripe donation.');
  if (campaign.status !== 'active') throw new Error('Campaign is not accepting donations.');

  const { total, processingFee, contribution } = readFinancialMetadata(metadata, campaignId);
  const expectedCharge = round2(total + processingFee);
  if (Math.abs(round2(Number(amountCharged || 0)) - expectedCharge) > 0.01) {
    throw new Error('Stripe charged amount does not match server-created donation metadata.');
  }

  await ensureCanonicalCampaign(sr, campaign);

  // Financial identity follows the provider object that represents this
  // particular charge. The first payment of a recurring donation is still a
  // Checkout Session; later renewals are invoices. Recurring status is tracked
  // separately so we never mislabel the first recurring payment just to obtain
  // the correct idempotency key.
  const operationKey = `stripe:${providerObjectKind}:${providerObjectId}`;
  const previousHolds = await sr.entities.StripeReversalHold.filter({
    payment_intent_id: String(providerTransactionId || ''),
  });
  if ((previousHolds || []).some(h => h.review_status === 'pending')) {
    throw new Error('Payment already has a Stripe reversal hold and cannot be credited automatically.');
  }
  const blocked = await sr.entities.FinancialOperation.filter({ operation_key: operationKey }).catch(() => []);
  if ((blocked || []).some(row => String(row.note || '').startsWith('STRIPE_REVERSAL_HOLD:'))) {
    throw new Error('Donation has a Stripe reversal hold; paid access cannot be restored by an older event.');
  }
  const isRenewal = providerObjectKind === 'invoice';
  const donorName = metadata?.donor_name || 'Anonymous';
  const canonical = await recordCanonicalDonation(sr, {
    operationKey,
    provider: 'stripe',
    providerTransactionId: String(providerTransactionId || providerObjectId),
    campaignId,
    campaignTitle: campaign.title,
    campaignOwnerUserId: campaign.created_by_id || '',
    grossAmount: total,
    platformContribution: contribution,
    processingFee,
    donorName,
    ...(donorEmail ? { donorEmail } : {}),
    ...(metadata?.donor_user_id ? { donorUserId: metadata.donor_user_id } : {}),
    message: metadata?.message || '',
    paymentMethod: paymentRail === 'stripe_crypto' ? 'stripe_crypto' : 'stripe',
    paymentVerified: true,
    source: isRenewal ? 'stripe_invoice_webhook' : 'stripe_checkout_webhook',
    isRecurring: !!isRecurring,
  });

  await markWebhook(sr, webhookRecord, {
    state: 'financial_applied',
    canonical_operation_id: String(canonical.operationId),
    financial_applied_at: new Date().toISOString(),
  });

  const donation = await reconcileDonationMirror(sr, canonical.operationId, {
    campaign_id: campaignId,
    campaign_title: campaign.title,
    amount: total,
    platform_contribution: contribution,
    processing_fee: processingFee,
    donor_name: donorName,
    message: metadata?.message || '',
    is_recurring: !!isRecurring,
    ...(isRecurring ? { recurring_status: 'active' } : {}),
    ...(metadata?.donor_user_id ? { donor_user_id: metadata.donor_user_id } : {}),
    payment_method: paymentRail === 'stripe_crypto' ? 'stripe_crypto' : 'stripe',
    payment_verified: true,
    cleared: false,
    stripe_session_id: providerObjectId,
  });

  if (campaign.created_by_id) {
    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: isRenewal ? 'Recurring donation received' : (isRecurring ? 'New recurring donation received' : 'New donation received'),
      body: isRenewal
        ? `${donorName} renewed $${total.toLocaleString()} to \"${campaign.title}\"`
        : `${donorName} donated $${total.toLocaleString()} to \"${campaign.title}\"`,
      type: 'donation',
      link: `/campaign/${campaign.id}`,
      read: false,
    });
  }

  if (canonical.applied) {
    await logAudit(base44, {
      action: isRenewal ? 'donation_renewal_confirmed' : 'donation_confirmed',
      target_type: 'campaign',
      target_id: campaignId,
      detail: `$${total} confirmed via Stripe through canonical ledger`,
      status: 'success',
      metadata: {
        canonical_operation_id: String(canonical.operationId),
        provider_reference: String(providerTransactionId || providerObjectId),
        provider_object_kind: providerObjectKind,
        recurring: !!isRecurring,
      },
    });
  }

  await markWebhook(sr, webhookRecord, {
    state: 'side_effects_complete',
    canonical_operation_id: String(canonical.operationId),
    side_effects_completed_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    last_error: '',
  });

  // Automated receipt: email the donor a receipt for every verified gift.
  if (canonical.applied) {
    await sendDonationReceipt(sr, { ...donation, donor_email: donorEmail }, campaign);
  }
  return canonical;
}

export default async function(req) {
  let base44;
  let webhookRecord = null;
  try {
    base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secrets.get('STRIPE_WEBHOOK_SECRET'));
    } catch (err) {
      console.error('Invalid webhook signature:', err instanceof Error ? err.message : 'unknown');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Production financial state must never be created from Stripe test-mode events.
    if (event.livemode !== true) {
      console.warn('Ignoring non-live Stripe event:', event.id, event.type);
      return Response.json({ received: true, ignored: true, reason: 'non_live_event' }, { status: 202 });
    }

    const eventKey = `stripe:${event.id}`;
    webhookRecord = await getWebhookRecord(sr, eventKey, event.type);
    if (webhookRecord?.state === 'side_effects_complete' || webhookRecord?.state === 'nonfinancial_complete') {
      return Response.json({ received: true, duplicate: true });
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const m = session.metadata || {};

      // Premium day-pass access is separate from campaign donations and subscriptions.
      // Every entitlement must follow a signed, PAID Checkout event and a fresh
      // provider GET. Delayed asynchronous payments are not credited prematurely.
      if (m.ifund_purchase === 'premium_day_pass') {
        if (session.mode !== 'payment' || session.livemode !== true ||
            !m.user_id || session.client_reference_id !== m.user_id) {
          throw new Error('Invalid IFund day-pass session ownership.');
        }
        const confirmed = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent'] });
        if (confirmed.payment_status !== 'paid') {
          await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete',
            processed_at: new Date().toISOString(), last_error: '' });
          return Response.json({ received: true, payment_pending: true });
        }
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
        const price = await stripe.prices.retrieve(PREMIUM_DAY_PASS_PRICE_ID);
        const onlyLine = items.data?.length === 1 && !items.has_more && items.data[0];
        const intent = typeof confirmed.payment_intent === 'object'
          ? confirmed.payment_intent
          : confirmed.payment_intent ? await stripe.paymentIntents.retrieve(confirmed.payment_intent) : null;
        const matches = verifiedDayPassPrice(price) &&
          confirmed.client_reference_id === m.user_id &&
          confirmed.metadata?.ifund_purchase === 'premium_day_pass' &&
          confirmed.metadata?.user_id === m.user_id &&
          confirmed.currency === 'usd' && confirmed.amount_total === 100 &&
          onlyLine?.price?.id === PREMIUM_DAY_PASS_PRICE_ID && onlyLine.quantity === 1 &&
          intent?.livemode === true && intent?.status === 'succeeded' &&
          intent?.currency === 'usd' && intent?.amount_received === 100 &&
          intent?.metadata?.user_id === m.user_id &&
          intent?.metadata?.ifund_purchase === 'premium_day_pass';
        if (!matches) throw new Error('Day-pass payment or Stripe price could not be verified.');
        const purchaser = await sr.entities.User.get(m.user_id).catch(() => null);
        if (!purchaser || purchaser.role === 'admin' ||
            purchaser.account_deletion_pending || purchaser.account_status === 'disabled') {
          throw new Error('Day-pass account is not eligible for activation.');
        }
        if (purchaser.stripe_day_pass_checkout_id !== confirmed.id) {
          const expiresAt = new Date(event.created * 1000 + DAY_PASS_DURATION_MS).toISOString();
          // Do not overwrite a later verified pass with an older delayed event.
          const existingExpiry = Date.parse(String(purchaser.premium_day_pass_expires_at || '')) || 0;
          if (Date.parse(expiresAt) > existingExpiry) {
            await sr.entities.User.update(purchaser.id, {
              premium_day_pass_expires_at: expiresAt,
              stripe_day_pass_checkout_id: confirmed.id,
              stripe_day_pass_payment_intent: intent.id,
            });
          }
        }
        await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete',
          processed_at: new Date().toISOString(), last_error: '' });
        return Response.json({ received: true, verified: true, purchase: 'premium_day_pass' });
      }

      // AI plan checkout. This is not a campaign donation, so it remains a
      // non-financial application side effect for this particular integrity boundary.
      if (m.subscription_tier) {
        // A completed redirect is not proof of an active paid subscription.
        // Verify the recurring price and owner against Stripe itself.
        const account = await stripe.accounts.retrieve();
        const verifiedMapping = await resolveStripeSubscriptionPrice(sr, stripe, account.id, m.subscription_tier, m.subscription_interval);
        const expectedPrice = verifiedMapping?.id || null;
        const sub = session.subscription ? await stripe.subscriptions.retrieve(session.subscription) : null;
        const selectedPrice = sub?.items?.data?.[0]?.price?.id;
        const matches = session.mode === 'subscription' &&
          (sub?.status === 'active' || sub?.status === 'trialing') &&
          !!expectedPrice && selectedPrice === expectedPrice &&
          sub?.metadata?.user_id === m.user_id &&
          sub?.metadata?.subscription_tier === m.subscription_tier &&
          sub?.metadata?.subscription_interval === m.subscription_interval;
        if (matches && m.user_id) {
          const subscriptionUser = await sr.entities.User.get(m.user_id).catch(() => null);
          if (subscriptionUser && subscriptionUser.role !== 'admin' &&
              !(subscriptionUser.subscription_provider === 'paypal' && subscriptionUser.subscription_status === 'active')) {
            const paidStart = sub.status === 'active' && session.payment_status === 'paid' &&
              Number.isFinite(Number(sub.start_date || sub.created)) &&
              Number(sub.start_date || sub.created) > 0
              ? new Date(Number(sub.start_date || sub.created) * 1000).toISOString() : null;
            const priorStart = Date.parse(String(subscriptionUser.first_paid_subscription_at || ''));
            const earliest = paidStart && Number.isFinite(priorStart) && priorStart < Date.parse(paidStart)
              ? subscriptionUser.first_paid_subscription_at : paidStart;
            await sr.entities.User.update(m.user_id, {
              ...(earliest ? { first_paid_subscription_at: earliest } : {}),
              subscription_tier: m.subscription_tier,
              subscription_status: sub.status === 'trialing' ? 'trialing' : 'active',
              subscription_provider: 'stripe',
              subscription_interval: m.subscription_interval,
              stripe_customer_id: session.customer || sub.customer || undefined,
              stripe_subscription_id: sub.id,
              ...(sub.current_period_end ? { subscription_renews_at: new Date(sub.current_period_end * 1000).toISOString() } : {}),
            });
          }
        }
        await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
        return Response.json({ received: true, verified: !!matches });
      }

      if (m.campaign_id) {
        // checkout.session.completed can arrive before an asynchronous payment
        // actually succeeds. Never create financial value until Stripe says paid.
        if (session.payment_status !== 'paid') {
          await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
          return Response.json({ received: true, payment_pending: true });
        }
        if (m.payment_rail === 'stripe_crypto') {
          // Signed Stripe events are necessary but not sufficient. Confirm
          // the actual successful charge came through the crypto method;
          // a browser success URL or altered metadata never credits funds.
          if (!session.payment_intent || session.mode !== 'payment' || session.livemode !== true) {
            throw new Error('Crypto payment is missing a live Stripe PaymentIntent.');
          }
          const intent = await stripe.paymentIntents.retrieve(session.payment_intent, {
            expand: ['latest_charge'],
          });
          const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
          if (intent.status !== 'succeeded' || intent.currency !== 'usd' ||
              charge?.paid !== true || charge?.payment_method_details?.type !== 'crypto' ||
              Number(intent.amount_received || 0) !== Number(session.amount_total || 0)) {
            throw new Error('Crypto donation charge is not confirmed by the payment provider.');
          }
        }
        await applyStripeDonation({
          base44,
          sr,
          webhookRecord,
          paymentRail: m.payment_rail === 'stripe_crypto' ? 'stripe_crypto' : 'card',
          campaignId: m.campaign_id,
          metadata: m,
          providerObjectId: session.id,
          providerObjectKind: 'session',
          providerTransactionId: session.payment_intent || session.id,
          amountCharged: round2((session.amount_total || 0) / 100),
          currency: session.currency,
          isRecurring: m.is_recurring === 'true',
          donorEmail: session.customer_details?.email || undefined,
        });
        return Response.json({ received: true });
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      // A refund/dispute cannot remain part of IFund's withdrawable balance.
      // Use a fresh provider GET, not untrusted event amounts or user input.
      const resource = event.data.object;
      const chargeId = event.type === 'charge.refunded' ? resource.id : resource.charge;
      if (typeof chargeId !== 'string' || !/^ch_[A-Za-z0-9]+$/.test(chargeId)) {
        throw new Error('Stripe reversal references an invalid charge.');
      }
      const charge = await stripe.charges.retrieve(chargeId);
      const reversed = charge.livemode === true &&
        (Number(charge.amount_refunded || 0) > 0 || charge.disputed === true);
      if (!reversed) {
        await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString() });
        return Response.json({ received: true, no_active_reversal: true });
      }
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId && /^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
        // Refunded or disputed day passes lose access; never modify donations
        // or a newer pass from an unrelated PaymentIntent.
        const passHolders = await sr.entities.User.filter({ stripe_day_pass_payment_intent: paymentIntentId });
        for (const holder of passHolders || []) {
          if (holder.role !== 'admin' && holder.stripe_day_pass_payment_intent === paymentIntentId) {
            await sr.entities.User.update(holder.id, {
              premium_day_pass_expires_at: new Date().toISOString(),
            });
          }
        }
        const holds = await sr.entities.StripeReversalHold.filter({ payment_intent_id: paymentIntentId });
        if (!(holds || []).length) {
          await sr.entities.StripeReversalHold.create({
            payment_intent_id: paymentIntentId, charge_id: chargeId,
            reason: event.type, amount_refunded_cents: Number(charge.amount_refunded || 0),
            disputed: charge.disputed === true, provider_event_id: event.id,
            review_status: 'pending', recorded_at: new Date().toISOString(),
          });
        }
        const operations = await sr.entities.FinancialOperation.filter({ provider: 'stripe', provider_transaction_id: paymentIntentId });
        for (const operation of operations || []) {
          if (operation.operation_type !== 'donation') continue;
          const mirrors = await sr.entities.Donation.filter({ canonical_operation_id: operation.id });
          if (!mirrors?.length) throw new Error('Stripe reversal mirror is missing; retry and review.');
          // Conservative full hold even on a partial refund. Finance can
          // reconcile the exact net amount rather than risk overpaying.
          await sr.entities.FinancialOperation.update(operation.id, {
            note: 'STRIPE_REVERSAL_HOLD: refunded or disputed charge. Do not release. Review full/partial amounts and any prior payouts.',
          });
          for (const mirror of mirrors) {
            await sr.entities.Donation.update(mirror.id, { payment_verified: false,
              description: 'Stripe refund or dispute pending financial review.' });
          }
          await reconcileCanonicalCampaignProjection(sr, operation.campaign_id);
        }
      }
      await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString() });
      return Response.json({ received: true, reversal_hold_applied: true });
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        let sub;
        try { sub = await stripe.subscriptions.retrieve(invoice.subscription); } catch (_) { sub = null; }
        const sm = sub?.metadata || {};
        if (sm.campaign_id) {
          await applyStripeDonation({
            base44,
            sr,
            webhookRecord,
            campaignId: sm.campaign_id,
            metadata: sm,
            providerObjectId: invoice.id,
            providerObjectKind: 'invoice',
            providerTransactionId: invoice.payment_intent || invoice.id,
            amountCharged: round2((invoice.amount_paid ?? invoice.total ?? invoice.amount_due ?? 0) / 100),
            currency: invoice.currency,
            isRecurring: true,
            donorEmail: invoice.customer_email || undefined,
          });
          return Response.json({ received: true });
        }
      }

      // AI subscription renewal.
      if (invoice.customer) {
        const users = await sr.entities.User.filter({ stripe_customer_id: invoice.customer });
        const u = users && users[0];
        if (u && u.role !== 'admin' && u.subscription_provider === 'stripe' &&
            u.stripe_subscription_id === invoice.subscription) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          await sr.entities.User.update(u.id, {
            subscription_status: 'active',
            ...(periodEnd ? { subscription_renews_at: new Date(periodEnd * 1000).toISOString() } : {}),
          });
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      if (sub.customer) {
        const users = await sr.entities.User.filter({ stripe_customer_id: sub.customer });
        const u = users && users[0];
        if (u && u.role !== 'admin' && u.subscription_provider === 'stripe' &&
            u.stripe_subscription_id === sub.id) {
          const statusMap = { trialing: 'trialing', active: 'active', past_due: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled', unpaid: 'canceled' };
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
          await sr.entities.User.update(u.id, {
            subscription_status: statusMap[sub.status] || 'none',
            ...(sub.current_period_end ? { subscription_renews_at: new Date(sub.current_period_end * 1000).toISOString() } : {}),
            ...(interval === 'month' ? { subscription_interval: 'monthly' } : interval === 'year' ? { subscription_interval: 'annual' } : {}),
          });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      if (sub.customer) {
        const users = await sr.entities.User.filter({ stripe_customer_id: sub.customer });
        const u = users && users[0];
        if (u && u.role !== 'admin' && u.subscription_provider === 'stripe' &&
            u.stripe_subscription_id === sub.id) {
          await sr.entities.User.update(u.id, {
            subscription_status: 'canceled',
            subscription_tier: 'free',
            subscription_renews_at: null,
            stripe_subscription_id: '',
          });
          await sr.entities.Notification.create({
            user_id: u.id,
            title: 'Subscription canceled',
            body: 'Your AI subscription has been canceled. You are now on the Free tier.',
            type: 'system',
            link: '/subscriptions',
          });
        }
      }
    }

    await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('stripeWebhook error:', message);
    if (base44 && webhookRecord) {
      await markWebhook(base44.asServiceRole, webhookRecord, {
        state: 'failed',
        last_error: String(message).slice(0, 500),
      });
    }
    // Keep durable recovery state and return 500 so Stripe retries. Financial
    // replay is safe because the canonical Base44 FinancialOperation owns idempotency.
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
