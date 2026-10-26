import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendPayout, IFUND_PAYPAL_ACCOUNT_REF, isLivePayPalPayoutReady } from '../../shared/paypal.ts';
import { giftOf, round2, computeWithdrawal } from '../../shared/fees.js';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import {
  ensureCanonicalCampaign,
  recordCanonicalDonation,
  reserveCanonicalWithdrawal,
  completeCanonicalWithdrawal,
  cancelCanonicalWithdrawal,
} from '../../shared/base44Financial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';

const CLEARING_DAYS = 7;
const REVIEW_THRESHOLD = 1000;
const SAFE_PAYOUT_ERROR = 'Unable to complete the payout. Please try again or contact support.';
const SAFE_WITHDRAWAL_ERROR = 'Unable to complete the withdrawal request. Please try again or contact support.';
const GENERIC_PAYOUT_REVIEW_NOTE = 'Payout failed. Detailed provider diagnostics are retained in controlled server logs.';
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const operationKeyFor = (withdrawalId) => `base44-withdrawal:${withdrawalId}`;

async function releaseDonationMirrors(sr, withdrawalId) {
  await sr.entities.Donation.updateMany(
    { withdrawal_id: withdrawalId },
    { $set: { withdrawal_id: '' } }
  ).catch(() => {});
  await sr.entities.HoldingLedgerEntry.updateMany(
    { withdrawal_id: withdrawalId, source_type: 'external_platform', direction: 'in', state: 'settled' },
    { $set: { withdrawal_id: '' } }
  ).catch(() => {});
}

async function verifyPendingDonation(base44, sr, donation, adminUser) {
  const campaign = await sr.entities.Campaign.get(donation.campaign_id).catch(() => null);
  if (!campaign) throw new Error('Campaign not found for pending donation.');
  await ensureCanonicalCampaign(sr, campaign);

  const institutional = !!donation.is_institutional;
  const method = donation.payment_method === 'cashapp' ? 'cashapp' : donation.payment_method === 'paypal' ? 'paypal' : 'other';
  const provider = institutional ? 'institutional_grant' : `manual_${method === 'cashapp' ? 'cashapp' : 'paypal'}`;
  const providerReference = String(donation.idempotency_key || donation.id);
  const operationKey = institutional ? `institutional_grant:${providerReference}` : `${provider}:${providerReference}`;

  let donorEmail;
  if (donation.donor_user_id) {
    const donor = await sr.entities.User.get(donation.donor_user_id).catch(() => null);
    donorEmail = donor?.email || undefined;
  }

  const canonical = await recordCanonicalDonation(sr, {
    operationKey,
    provider,
    providerTransactionId: providerReference,
    campaignId: donation.campaign_id,
    campaignTitle: donation.campaign_title || campaign.title,
    campaignOwnerUserId: campaign.created_by_id || '',
    grossAmount: Number(donation.amount || 0),
    platformContribution: Number(donation.platform_contribution || 0),
    processingFee: Number(donation.processing_fee || 0),
    donorName: donation.donor_name || (institutional ? 'Institutional Grant' : 'Anonymous'),
    ...(donorEmail ? { donorEmail } : {}),
    ...(donation.donor_user_id ? { donorUserId: donation.donor_user_id } : {}),
    message: donation.message || '',
    paymentMethod: method,
    paymentVerified: true,
    source: institutional ? 'admin_verified_institutional_receipt' : 'admin_verified_manual_receipt',
    isRecurring: !!donation.is_recurring,
  });

  if (donation.canonical_operation_id && String(donation.canonical_operation_id) !== String(canonical.operationId)) {
    throw new Error('Canonical operation mismatch while clearing donation.');
  }
  if (!donation.canonical_operation_id) {
    await sr.entities.Donation.update(donation.id, { canonical_operation_id: String(canonical.operationId) });
  }

  const mirror = await reconcileDonationMirror(sr, canonical.operationId, {
    campaign_id: donation.campaign_id,
    campaign_title: donation.campaign_title || campaign.title,
    amount: Number(donation.amount || 0),
    platform_contribution: Number(donation.platform_contribution || 0),
    processing_fee: Number(donation.processing_fee || 0),
    donor_name: donation.donor_name || (institutional ? 'Institutional Grant' : 'Anonymous'),
    message: donation.message || '',
    is_recurring: !!donation.is_recurring,
    ...(donation.is_recurring ? { recurring_status: donation.recurring_status || 'active' } : {}),
    ...(donation.donor_user_id ? { donor_user_id: donation.donor_user_id } : {}),
    payment_method: method,
    payment_verified: true,
    is_institutional: institutional,
    cleared: true,
    idempotency_key: providerReference,
  });

  if (campaign.created_by_id) {
    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: institutional ? 'Institutional funds verified' : 'Donation verified',
      body: institutional
        ? `$${Number(donation.amount || 0).toLocaleString()} in institutional funding for \"${campaign.title}\" was verified as received.`
        : `$${Number(donation.amount || 0).toLocaleString()} for \"${campaign.title}\" was verified as received.`,
      type: 'donation',
      link: `/campaign/${campaign.id}`,
      read: false,
    });
  }

  if (canonical.applied) {
    await logAudit(base44, {
      action: institutional ? 'institutional_funds_verified' : 'manual_donation_verified',
      target_type: 'donation',
      target_id: mirror?.id || donation.id,
      detail: `$${Number(donation.amount || 0)} receipt verified and applied to canonical ledger`,
      status: 'success',
      metadata: { actor: adminUser.id, canonical_operation_id: String(canonical.operationId), campaign_id: campaign.id },
    });
  }
  return { canonical, mirror: mirror || donation };
}

async function markPaidAfterProvider(base44, sr, withdrawal, payout, actorId) {
  const operationKey = withdrawal.canonical_operation_key || operationKeyFor(withdrawal.id);
  const holdingOperationKey = `holding:withdrawal:${withdrawal.id}:paid`;
  try {
    await completeCanonicalWithdrawal(sr, {
      operationKey,
      providerTransactionId: String(payout.payout_batch_id || payout.sender_batch_id),
    });
  } catch (error) {
    // PayPal accepted the payout, so never release the reservation here.
    await sr.entities.Withdrawal.update(withdrawal.id, {
      status: 'reconciliation_pending',
      payout_batch_id: payout.payout_batch_id || '',
      provider_sender_batch_id: payout.sender_batch_id || '',
      review_note: 'PayPal accepted the payout but canonical completion requires reconciliation.',
    });
    await logAudit(base44, {
      action: 'withdrawal_reconciliation_pending',
      target_type: 'withdrawal',
      target_id: withdrawal.id,
      detail: 'Provider accepted payout; canonical completion pending',
      status: 'failure',
      metadata: { actor: actorId, payout_batch_id: payout.payout_batch_id || '', sender_batch_id: payout.sender_batch_id || '' },
    });
    return { ok: false, reconciliationPending: true };
  }

  const paidAt = new Date().toISOString();
  const existingHolding = await sr.entities.HoldingLedgerEntry.filter({ operation_key: holdingOperationKey }).catch(() => []);
  if (!existingHolding?.length) {
    await sr.entities.HoldingLedgerEntry.create({
      operation_key: holdingOperationKey,
      direction: 'out',
      state: 'paid',
      source_type: 'withdrawal',
      source_provider: 'paypal',
      source_account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      provider_transaction_id: String(payout.payout_batch_id || payout.sender_batch_id),
      campaign_id: withdrawal.campaign_id,
      beneficiary_user_id: withdrawal.owner_user_id,
      amount: Number(withdrawal.net_amount || 0),
      currency: 'USD',
      platform_contribution: 0,
      processing_fee: 0,
      withdrawal_id: withdrawal.id,
      canonical_operation_id: String(withdrawal.canonical_ledger_entry_id || ''),
      settled_at: paidAt,
      reconciliation_note: 'Verified PayPal payout from the Interplanetary business PayPal holding account.',
    });
  }

  await sr.entities.Withdrawal.update(withdrawal.id, {
    status: 'paid',
    payout_batch_id: payout.payout_batch_id || '',
    provider_sender_batch_id: payout.sender_batch_id || '',
    processed_at: paidAt,
    review_note: '',
  });
  return { ok: true };
}

async function handleProviderFailure(base44, sr, withdrawal, err, actorId) {
  const operationKey = withdrawal.canonical_operation_key || operationKeyFor(withdrawal.id);
  if (err?.ambiguous) {
    // Network loss or provider duplicate response is not proof of failure.
    // Keep both canonical and Base44 locks until PayPal state is reconciled.
    await sr.entities.Withdrawal.update(withdrawal.id, {
      status: 'provider_status_unknown',
      provider_sender_batch_id: err.sender_batch_id || '',
      review_note: 'PayPal submission status is unknown. Funds remain reserved pending reconciliation.',
    });
    await logAudit(base44, {
      action: 'withdrawal_provider_status_unknown',
      target_type: 'withdrawal',
      target_id: withdrawal.id,
      detail: 'Provider result ambiguous; funds remain reserved',
      status: 'failure',
      metadata: { actor: actorId, sender_batch_id: err.sender_batch_id || '' },
    });
    return { ambiguous: true, released: false };
  }

  try {
    await cancelCanonicalWithdrawal(sr, { operationKey, reason: 'PayPal definitively rejected the payout.' });
    await releaseDonationMirrors(sr, withdrawal.id);
    await sr.entities.Withdrawal.update(withdrawal.id, { status: 'failed', review_note: GENERIC_PAYOUT_REVIEW_NOTE });
    return { ambiguous: false, released: true };
  } catch (cancelErr) {
    // Fail closed: local donation locks stay in place if canonical Base44 release fails.
    await sr.entities.Withdrawal.update(withdrawal.id, {
      status: 'reservation_release_pending',
      review_note: 'Provider rejected payout, but canonical reservation release requires reconciliation.',
    });
    console.error('canonical withdrawal cancellation failed:', cancelErr?.message || cancelErr);
    return { ambiguous: false, released: false };
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const body = await req.json();
    const action = body.action || 'request';
    // An emergency payout pause applies BEFORE new reservations or approvals.
    // Historical payout reconciliation, donation verification, provider status
    // resolution, and safe reservation release must always remain available.
    if (action === 'request' || action === 'approve') {
      if (!(await isFeatureEnabled(base44, 'outbound_payout_execution'))) return featureUnavailable('New payouts');
      if (!(await isLivePayPalPayoutReady())) return Response.json({ error: 'New PayPal payouts are temporarily unavailable while provider access is being verified.' }, { status: 503 });
    }

    if (action === 'clear') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      const d = await sr.entities.Donation.get(body.donation_id);
      if (!d) return Response.json({ error: 'Donation not found.' }, { status: 404 });
      if (!d.is_institutional && d.payment_verified !== false) {
        if (d.cleared && d.canonical_operation_id) return Response.json({ ok: true, donation_id: d.id, cleared: true, duplicate: true });
        return Response.json({ error: 'Only unverified or institutional donations need clearing.' }, { status: 400 });
      }
      const { canonical, mirror } = await verifyPendingDonation(base44, sr, d, user);
      return Response.json({ ok: true, donation_id: mirror?.id || d.id, cleared: true, canonical_operation_id: String(canonical.operationId), duplicate: !canonical.applied });
    }

    // Complete an already-submitted provider payout without sending money again.
    if (action === 'reconcile_paid') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (!['reconciliation_pending', 'provider_status_unknown'].includes(w.status)) return Response.json({ error: 'Withdrawal is not awaiting payout reconciliation.' }, { status: 400 });
      const providerRef = body.provider_transaction_id || w.payout_batch_id;
      if (!providerRef) return Response.json({ error: 'Verified PayPal payout reference is required.' }, { status: 400 });
      await completeCanonicalWithdrawal(sr, {
        operationKey: w.canonical_operation_key || operationKeyFor(w.id),
        providerTransactionId: String(providerRef),
      });
      await sr.entities.Withdrawal.update(w.id, { status: 'paid', payout_batch_id: String(providerRef), processed_at: new Date().toISOString(), review_note: '' });
      await logAudit(base44, { action: 'withdrawal_reconciled_paid', target_type: 'withdrawal', target_id: w.id, detail: 'Admin verified provider payout and completed canonical ledger', status: 'success', metadata: { actor: user.id, provider_reference: String(providerRef) } });
      return Response.json({ ok: true, status: 'paid', withdrawal_id: w.id });
    }

    // Release uncertain money only after explicit provider non-payment verification.
    if (action === 'release_reservation') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      if (body.confirm_not_paid !== true) return Response.json({ error: 'Explicit confirmation that PayPal did not pay is required.' }, { status: 400 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (!['provider_status_unknown', 'reservation_release_pending', 'under_review'].includes(w.status)) return Response.json({ error: 'This withdrawal cannot be released from its current state.' }, { status: 400 });
      const adminNote = String(body.admin_note || '').trim().slice(0, 500);
      await cancelCanonicalWithdrawal(sr, { operationKey: w.canonical_operation_key || operationKeyFor(w.id), reason: adminNote || 'Admin confirmed provider did not pay.' });
      await releaseDonationMirrors(sr, w.id);
      await sr.entities.Withdrawal.update(w.id, { status: 'cancelled', review_note: adminNote ? `Provider non-payment confirmed; funds released. Admin note: ${adminNote}` : 'Provider non-payment confirmed; funds released.', processed_at: new Date().toISOString() });
      await logAudit(base44, { action: 'withdrawal_reservation_released', target_type: 'withdrawal', target_id: w.id, detail: adminNote ? `Admin confirmed provider non-payment; canonical and mirror reservations released. Note: ${adminNote}` : 'Admin confirmed provider non-payment; canonical and mirror reservations released', status: 'success', metadata: { actor: user.id } });
      return Response.json({ ok: true, status: 'cancelled', withdrawal_id: w.id });
    }

    if (action === 'approve') {
      if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (w.status !== 'under_review') return Response.json({ error: 'Only held withdrawals can be approved.' }, { status: 400 });
      if (!w.canonical_operation_key || !w.canonical_reservation_id) return Response.json({ error: 'Legacy held withdrawal requires financial migration before approval.' }, { status: 409 });
      try {
        const payout = await sendPayout({ receiver: w.paypal_email, amount: w.net_amount, note: `Interplanetary Fund withdrawal for \"${w.campaign_title}\"`, itemId: w.id });
        const final = await markPaidAfterProvider(base44, sr, w, payout, user.id);
        if (!final.ok) return Response.json({ ok: true, status: 'reconciliation_pending', withdrawal_id: w.id, payout_batch_id: payout.payout_batch_id || null }, { status: 202 });
        await logAudit(base44, { action: 'withdrawal_approved', target_type: 'withdrawal', target_id: w.id, detail: `Approved net $${w.net_amount} paid`, status: 'success', metadata: { actor: user.id } });
        return Response.json({ ok: true, status: 'paid', payout_batch_id: payout.payout_batch_id });
      } catch (err) {
        console.error('requestWithdrawal approve payout error:', err?.name || 'PayoutError');
        const state = await handleProviderFailure(base44, sr, w, err, user.id);
        if (state.ambiguous) return Response.json({ ok: true, status: 'provider_status_unknown', withdrawal_id: w.id }, { status: 202 });
        return Response.json({ error: state.released ? `${SAFE_PAYOUT_ERROR} Your funds were released back to your available balance.` : SAFE_PAYOUT_ERROR }, { status: 500 });
      }
    }

    const { campaign_id, paypal_email, paypal_email_confirm } = body;
    if (!campaign_id) return Response.json({ error: 'Select a campaign to withdraw from.' }, { status: 400 });
    if (!emailOk(paypal_email)) return Response.json({ error: 'Enter a valid PayPal email address.' }, { status: 400 });
    if (paypal_email !== paypal_email_confirm) return Response.json({ error: 'PayPal email addresses do not match.' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
    if (campaign.created_by_id !== user.id) return Response.json({ error: 'You can only withdraw funds from your own campaigns.' }, { status: 403 });

    // Active subscribers are exempt from the once-per-day withdrawal limit.
    // Subscription state is provider-backed through the Stripe webhook; never infer
    // entitlement from the selected tier alone.
    const hasWithdrawalSubscription = effectiveSubscription(user).active;
    if (!hasWithdrawalSubscription) {
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const recent = await sr.entities.Withdrawal.filter({ owner_user_id: user.id });
      const alreadyToday = (recent || []).some((w) =>
        !['failed', 'cancelled'].includes(w.status) && new Date(w.created_date) >= startToday
      );
      if (alreadyToday) {
        return Response.json(
          { error: 'You can only withdraw once per day without an active subscription. Please try again tomorrow.' },
          { status: 400 }
        );
      }
    }

    // Seed pre-canonical funds before any local donation row gets reserved.
    await ensureCanonicalCampaign(sr, campaign);

    const cutoff = new Date(Date.now() - CLEARING_DAYS * 86400000);
    const allDonations = await sr.entities.Donation.filter({ campaign_id });
    const available = (allDonations || []).filter((d) => {
      if (d.withdrawal_id) return false;
      if (d.cleared) return d.payment_verified === true;
      if (d.payment_verified !== true || d.is_institutional) return false;
      return new Date(d.created_date) <= cutoff;
    });
    const settledExternal = await sr.entities.HoldingLedgerEntry.filter({
      campaign_id,
      beneficiary_user_id: user.id,
      source_type: 'external_platform',
      direction: 'in',
      state: 'settled',
    }, '-created_date', 5000).catch(() => []);
    if (settledExternal.length >= 5000) {
      return Response.json({ error: 'External settlement history is too large for a safe single withdrawal. Contact support.' }, { status: 409 });
    }
    const availableExternal = settledExternal.filter((entry) => !entry.withdrawal_id && Number(entry.amount || 0) > 0);
    let gross = round2(
      available.reduce((s, d) => s + giftOf(d), 0) +
      availableExternal.reduce((s, entry) => s + Number(entry.amount || 0), 0)
    );
    if (gross <= 0) return Response.json({ error: 'No cleared funds are available yet. Donations and external funds become withdrawable only after verification and settlement.' }, { status: 400 });

    let { fee, net } = computeWithdrawal(gross);
    const withdrawal = await sr.entities.Withdrawal.create({
      owner_user_id: user.id,
      user_name: user.full_name,
      campaign_id,
      campaign_title: campaign.title,
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      paypal_email,
      covered_donation_ids: available.map((d) => d.id),
      covered_holding_entry_ids: availableExternal.map((entry) => entry.id),
      status: 'reserving',
    });
    const operationKey = operationKeyFor(withdrawal.id);
    await sr.entities.Withdrawal.update(withdrawal.id, { canonical_operation_key: operationKey });

    // Local mirror reservation gives the UI an exact set of covered donations;
    // the canonical Base44 reservation below is the authoritative double-spend boundary.
    await sr.entities.Donation.updateMany(
      { id: { $in: available.map((d) => d.id) }, withdrawal_id: { $in: [null, ''] } },
      { $set: { withdrawal_id: withdrawal.id } }
    );
    if (availableExternal.length) {
      await sr.entities.HoldingLedgerEntry.updateMany(
        {
          id: { $in: availableExternal.map((entry) => entry.id) },
          withdrawal_id: { $in: [null, ''] },
          source_type: 'external_platform',
          direction: 'in',
          state: 'settled',
        },
        { $set: { withdrawal_id: withdrawal.id } }
      ).catch(() => {});
    }

    const reChecked = await sr.entities.Donation.filter({ withdrawal_id: withdrawal.id });
    const reservedIds = (reChecked || []).map((d) => d.id);
    const reCheckedHolding = await sr.entities.HoldingLedgerEntry.filter({ withdrawal_id: withdrawal.id }).catch(() => []);
    const reservedHoldingIds = (reCheckedHolding || [])
      .filter((entry) => entry.source_type === 'external_platform' && entry.direction === 'in' && entry.state === 'settled')
      .map((entry) => entry.id);
    const reservedGross = round2(
      reservedIds.reduce((s, id) => {
        const d = available.find((a) => a.id === id);
        return s + (d ? giftOf(d) : 0);
      }, 0) +
      reservedHoldingIds.reduce((s, id) => {
        const entry = availableExternal.find((candidate) => candidate.id === id);
        return s + (entry ? Number(entry.amount || 0) : 0);
      }, 0)
    );

    if (reservedGross <= 0) {
      await sr.entities.Withdrawal.update(withdrawal.id, { status: 'failed', review_note: 'Funds were claimed by another withdrawal. Please try again.' });
      return Response.json({ error: 'Those funds were just claimed by another withdrawal. Please try again.' }, { status: 409 });
    }
    gross = reservedGross;

    let reservation;
    try {
      reservation = await reserveCanonicalWithdrawal(sr, {
        operationKey,
        campaignId: campaign_id,
        campaignOwnerUserId: user.id,
        requestedGross: gross,
        payoutMethod: 'paypal',
        payoutDestination: paypal_email,
        withdrawalId: withdrawal.id,
      });
    } catch (reserveErr) {
      await releaseDonationMirrors(sr, withdrawal.id);
      await sr.entities.Withdrawal.update(withdrawal.id, { status: 'failed', review_note: 'Canonical balance reservation failed.' });
      console.error('canonical withdrawal reservation failed:', reserveErr?.name || 'ReservationError');
      return Response.json({ error: 'Funds could not be reserved safely. Please try again.' }, { status: 409 });
    }

    fee = Number(reservation.platformFee);
    net = Number(reservation.netAmount);
    await sr.entities.Withdrawal.update(withdrawal.id, {
      gross_amount: Number(reservation.grossAmount),
      platform_fee: fee,
      net_amount: net,
      covered_donation_ids: reservedIds,
      covered_holding_entry_ids: reservedHoldingIds,
      canonical_reservation_id: String(reservation.reservationId),
      canonical_ledger_entry_id: String(reservation.ledgerEntryId || ''),
      status: net > REVIEW_THRESHOLD ? 'under_review' : 'processing',
      ...(net > REVIEW_THRESHOLD ? { review_note: `Net amount $${net.toFixed(2)} exceeds the $${REVIEW_THRESHOLD} auto-approval threshold.` } : {}),
    });
    await logAudit(base44, { action: 'withdrawal_reserved', target_type: 'withdrawal', target_id: withdrawal.id, detail: `Canonical reservation $${gross} (fee $${fee}, net $${net})`, status: 'success', metadata: { canonical_reservation_id: String(reservation.reservationId), canonical_operation_key: operationKey } });

    if (net > REVIEW_THRESHOLD) return Response.json({ ok: true, status: 'under_review', withdrawal_id: withdrawal.id, gross, fee, net });

    const currentWithdrawal = await sr.entities.Withdrawal.get(withdrawal.id);
    try {
      const payout = await sendPayout({ receiver: paypal_email, amount: net, note: `Interplanetary Fund withdrawal for \"${campaign.title}\"`, itemId: withdrawal.id });
      const final = await markPaidAfterProvider(base44, sr, currentWithdrawal, payout, user.id);
      if (!final.ok) return Response.json({ ok: true, status: 'reconciliation_pending', withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: payout.payout_batch_id || null }, { status: 202 });
      await logAudit(base44, { action: 'withdrawal_paid', target_type: 'withdrawal', target_id: withdrawal.id, detail: `Net $${net} paid after canonical reservation`, status: 'success', metadata: { canonical_reservation_id: String(reservation.reservationId), payout_batch_id: payout.payout_batch_id || '' } });
      return Response.json({ ok: true, status: 'paid', withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: payout.payout_batch_id });
    } catch (err) {
      console.error('requestWithdrawal payout error:', err?.name || 'PayoutError');
      const state = await handleProviderFailure(base44, sr, currentWithdrawal, err, user.id);
      if (state.ambiguous) return Response.json({ ok: true, status: 'provider_status_unknown', withdrawal_id: withdrawal.id, gross, fee, net }, { status: 202 });
      return Response.json({ error: state.released ? `${SAFE_PAYOUT_ERROR} Your funds were released back to your available balance.` : SAFE_PAYOUT_ERROR }, { status: 500 });
    }
  } catch (error) {
    console.error('requestWithdrawal error:', error?.name || 'UnknownError');
    return Response.json({ error: SAFE_WITHDRAWAL_ERROR }, { status: 500 });
  }
}
