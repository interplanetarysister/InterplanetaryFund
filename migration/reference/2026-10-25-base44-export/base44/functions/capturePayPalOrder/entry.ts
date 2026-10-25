import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { captureOrder, getOrder, getTransaction, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { round2 } from '../../shared/fees.js';
import { resolvePayPalCaptureAllocation } from '../../shared/paypalAllocation.js';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { ensureCanonicalCampaign, recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';
import { sendDonationReceipt } from '../../shared/sendDonationReceipt.ts';

// Captures a PayPal/Google Pay/Apple Pay order and applies the resulting donation through
// Base44's canonical transactional financial boundary. Provider capture idempotency + the
// canonical operation key guarantees concurrent/retried handlers cannot create
// multiple financial donations or increment campaign totals more than once.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Finalize an already initiated provider order even if the admin has since
    // paused NEW donations. Never strand an authorized order or its ledger.
    if (secrets.get('PAYPAL_MODE') !== 'live') return Response.json({ error: 'PayPal campaign payments are not currently available.' }, { status: 503 });
    const sr = base44.asServiceRole;

    const { order_id, campaign_id, donor_name, message, is_recurring, reconcile_only, paypal_transaction_id } = await req.json();
    if (!order_id || !campaign_id) {
      return Response.json({ error: 'Order id and campaign are required' }, { status: 400 });
    }
    const recovering = reconcile_only === true;
    // Recovery must never capture or charge. It is available only to the
    // designated super admins; normal donor checkout follows the existing path.
    if (recovering) {
      const actor = await base44.auth.me().catch(() => null);
      const allowed = new Set(['interplanetarysister@gmail.com', 'cuddlemeplatonically@gmail.com']);
      if (actor?.role !== 'admin' || !allowed.has(String(actor.email || '').trim().toLowerCase())) {
        return Response.json({ error: 'Super admin receipt verification required.' }, { status: 403 });
      }
      if (!/^[A-Za-z0-9_-]{8,90}$/.test(String(order_id)) ||
          !/^[A-Za-z0-9_-]{8,90}$/.test(String(paypal_transaction_id || ''))) {
        return Response.json({ error: 'An original PayPal order and capture reference are required.' }, { status: 400 });
      }
    }

    // Complete all local authorization and campaign checks before the irreversible
    // provider capture. Once PayPal reports COMPLETED, later campaign status drift
    // must not strand captured money outside the canonical ledger.
    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (!recovering && campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });
    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;

    let cap;
    try {
      cap = recovering ? await getOrder(order_id) : await captureOrder(order_id);
    } catch (capErr) {
      console.error(recovering ? 'capturePayPalOrder verification error:' : 'capturePayPalOrder capture error:', capErr?.name || 'PayPalError');
      const fl = await checkRateLimit(base44, `captureFail:${order_id}`, 5, 600);
      if (!fl.allowed) return Response.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
      await logAudit(base44, { action: 'capture_failed', target_type: 'campaign', target_id: campaign_id, detail: 'Capture failed', status: 'failure' });
      return Response.json({ error: recovering
        ? 'PayPal could not verify the original order without charging. No records were changed.'
        : 'Unable to complete your donation. Please try again or contact support.' }, { status: 502 });
    }
    if (cap.status !== 'COMPLETED' || cap.capture_status !== 'COMPLETED' || !cap.capture_id) {
      const fl = await checkRateLimit(base44, `captureFail:${order_id}`, 5, 600);
      if (!fl.allowed) return Response.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
      await logAudit(base44, {
        action: recovering ? 'paypal_receipt_verification_failed' : 'capture_failed',
        target_type: 'campaign',
        target_id: campaign_id,
        detail: `Capture not completed (order=${cap.status || 'unknown'}, capture=${cap.capture_status || 'missing'})`,
        status: 'failure',
      });
      return Response.json({ error: 'Payment was not completed', status: cap.capture_status || cap.status }, { status: 402 });
    }
    if (cap.currency !== 'USD') {
      return Response.json({ error: 'Captured payment currency does not match this campaign.' }, { status: 409 });
    }
    if (recovering) {
      // Independent read-only transaction evidence must agree with the
      // completed order. An order reference alone is not a valid donation.
      if (String(cap.capture_id) !== String(paypal_transaction_id)) {
        return Response.json({ error: 'The PayPal capture does not match this receipt.' }, { status: 409 });
      }
      const tx = await getTransaction(cap.capture_id).catch(() => null);
      if (!tx || tx.id !== cap.capture_id || tx.status !== 'S' ||
          !['T0000','T0005','T0006','T0007','T0011','T0013'].includes(tx.transactionEventCode) ||
          tx.currency !== 'USD' || Math.abs(Number(tx.amount) - Number(cap.amount)) > 0.01 ||
          (tx.paypalReferenceIdType === 'ODR' && tx.paypalReferenceId && tx.paypalReferenceId !== order_id)) {
        return Response.json({ error: 'PayPal has not verified this settled checkout receipt.' }, { status: 409 });
      }
    }

    // custom_id is generated by createPayPalOrder on the server and binds all
    // financial allocations to the captured provider order:
    // Legacy: campaign|netDonation|fee|contribution|channel.
    // Gift-first v2: same five fields plus version marker (keeps old receipts valid).
    const parts = String(cap.custom_id || '').split('|');
    const giftFirst = parts.length === 6 && parts[5] === 'gift_first_v2';
    if ((!giftFirst && parts.length !== 5) || parts[0] !== campaign_id) {
      return Response.json({ error: 'PayPal order does not match this campaign.' }, { status: 409 });
    }
    const donCents = Number.parseInt(parts[1], 10);
    const procCents = Number.parseInt(parts[2], 10);
    const contributionCents = Number.parseInt(parts[3], 10);
    const paymentChannel = ['paypal', 'googlepay', 'applepay'].includes(parts[4]) ? parts[4] : '';
    if (!paymentChannel || ![donCents, procCents, contributionCents].every(Number.isInteger) || donCents <= 0 || procCents < 0 || contributionCents < 0 || contributionCents > donCents) {
      return Response.json({ error: 'PayPal order financial metadata is invalid.' }, { status: 409 });
    }

    const operationKey = `paypal:${order_id}`;
    const existingOperations = await sr.entities.FinancialOperation.filter({ operation_key: operationKey }).catch(() => []);
    let canonical;
    let total;
    let processingFee;
    let contribution;

    if (existingOperations.length) {
      // A retry may observe a richer PayPal receipt than the first successful
      // handler. Freeze the first canonical allocation and channel before
      // considering provider enrichment so retries cannot revise settled money.
      if (existingOperations.length !== 1) {
        return Response.json({ error: 'Captured payment requires financial reconciliation.' }, { status: 409 });
      }
      const saved = existingOperations[0];
      total = round2(saved.gross_amount);
      processingFee = round2(saved.processing_fee);
      contribution = round2(saved.platform_contribution);
      const savedChannel = String(saved.payment_channel || '').toLowerCase();
      const immutableMatch =
        saved.operation_type === 'donation' && saved.state === 'applied' &&
        saved.campaign_id === campaign_id && saved.provider === 'paypal' &&
        String(saved.provider_transaction_id || '') === String(cap.capture_id) &&
        savedChannel === paymentChannel && total > 0 && processingFee >= 0 &&
        contribution >= 0 && round2(total - contribution) > 0 &&
        Math.abs(round2(total + processingFee) - round2(cap.amount)) <= 0.01;
      if (!immutableMatch) {
        return Response.json({ error: 'Captured payment requires financial reconciliation.' }, { status: 409 });
      }
      canonical = { operationId: saved.id, applied: false };
    } else {
      const allocation = resolvePayPalCaptureAllocation({
        chargedAmount: cap.amount,
        quotedDonation: donCents / 100,
        quotedFee: procCents / 100,
        quotedContribution: contributionCents / 100,
        providerReceivable: cap.provider_receivable_amount,
        providerFee: cap.provider_processing_fee,
        preservePledgedGift: giftFirst,
      });
      if (!allocation.ok) {
        // The PayPal capture is already irreversible: do not retry another charge
        // under a new order ID. Keep the receipt available for admin reconciliation.
        return Response.json({ error: 'Captured payment requires financial reconciliation.' }, { status: 409 });
      }
      total = allocation.amount;
      processingFee = allocation.processingFee;
      contribution = allocation.platformContribution;
    }

    await ensureCanonicalCampaign(sr, campaign);
    const displayName = donor_name || cap.payer_name || donor?.full_name || 'Anonymous';
    if (!canonical) {
      canonical = await recordCanonicalDonation(sr, {
        operationKey,
        provider: 'paypal',
        providerTransactionId: cap.capture_id,
        campaignId: campaign_id,
        campaignTitle: campaign.title,
        campaignOwnerUserId: campaign.created_by_id || '',
        grossAmount: total,
        platformContribution: contribution,
        processingFee,
        donorName: displayName,
        ...(donor?.email ? { donorEmail: donor.email } : {}),
        ...(donor?.id ? { donorUserId: donor.id } : {}),
        message: message || '',
        paymentMethod: paymentChannel,
        paymentVerified: true,
        source: 'paypal_capture',
        isRecurring: !!is_recurring,
      });

      // A concurrent handler may have won the atomic claim. Mirror only the
      // persisted immutable allocation, never this handler's candidate values.
      const savedOperation = await sr.entities.FinancialOperation.get(canonical.operationId).catch(() => null);
      if (!savedOperation || savedOperation.campaign_id !== campaign_id ||
          String(savedOperation.provider_transaction_id || '') !== String(cap.capture_id) ||
          String(savedOperation.payment_channel || '').toLowerCase() !== paymentChannel) {
        return Response.json({ error: 'Captured payment requires financial reconciliation.' }, { status: 409 });
      }
      total = round2(savedOperation.gross_amount);
      processingFee = round2(savedOperation.processing_fee);
      contribution = round2(savedOperation.platform_contribution);
      if (!(total > 0) || processingFee < 0 || contribution < 0 ||
          !(round2(total - contribution) > 0) ||
          Math.abs(round2(total + processingFee) - round2(cap.amount)) > 0.01) {
        return Response.json({ error: 'Captured payment requires financial reconciliation.' }, { status: 409 });
      }
    }

    // The designated Interplanetary Fund holding account is the business PayPal
    // account. A COMPLETED capture is provider evidence that this direct PayPal
    // donation reached that account. Mirror custody separately from beneficial
    // ownership so pooled PayPal funds remain allocated to the correct campaign.
    const holdingOperationKey = `holding:paypal:${cap.capture_id}`;
    const holdingIdentityMatches = (row, allowMissingChannel = false) =>
      row?.direction === 'in' && row?.state === 'settled' && row?.source_type === 'payment_processor' &&
      row?.source_provider === 'paypal' && row?.source_account_ref === IFUND_PAYPAL_ACCOUNT_REF &&
      row?.provider_transaction_id === String(cap.capture_id) &&
      row?.campaign_id === campaign_id && round2(row?.amount) === total && String(row?.currency || '').toUpperCase() === 'USD' &&
      round2(row?.platform_contribution || 0) === contribution && round2(row?.processing_fee || 0) === processingFee &&
      (row?.payment_channel === paymentChannel || (allowMissingChannel && !row?.payment_channel)) &&
      String(row?.canonical_operation_id || '') === String(canonical.operationId);
    const existingHoldings = await sr.entities.HoldingLedgerEntry.filter({ operation_key: holdingOperationKey }).catch(() => []);
    if (existingHoldings.some((row) => !holdingIdentityMatches(row, true))) {
      throw new Error('PayPal holding operation conflicts with the captured allocation.');
    }
    await sr.entities.HoldingLedgerEntry.upsert([{
        operation_key: holdingOperationKey,
        direction: 'in',
        state: 'settled',
        source_type: 'payment_processor',
        source_provider: 'paypal',
        source_account_ref: IFUND_PAYPAL_ACCOUNT_REF,
        provider_transaction_id: String(cap.capture_id),
        campaign_id,
        beneficiary_user_id: campaign.created_by_id || '',
        amount: total,
        currency: cap.currency,
        platform_contribution: contribution,
        processing_fee: processingFee,
        payment_channel: paymentChannel,
        canonical_operation_id: String(canonical.operationId),
        settled_at: new Date().toISOString(),
        reconciliation_note: 'Verified PayPal capture received into the designated Interplanetary Fund business PayPal holding account.',
      }], { key: 'operation_key' });
    const persistedHoldings = await sr.entities.HoldingLedgerEntry.filter({ operation_key: holdingOperationKey }).catch(() => []);
    if (persistedHoldings.length !== 1 || !holdingIdentityMatches(persistedHoldings[0])) {
      throw new Error('PayPal holding operation could not be confirmed uniquely.');
    }

    const donation = await reconcileDonationMirror(sr, canonical.operationId, {
      campaign_id,
      campaign_title: campaign.title,
      amount: total,
      platform_contribution: contribution,
      processing_fee: processingFee,
      donor_name: displayName,
      message: message || '',
      is_recurring: !!is_recurring,
      ...(is_recurring ? { recurring_status: 'active' } : {}),
      ...(donor?.id ? { donor_user_id: donor.id } : {}),
      payment_method: paymentChannel,
      payment_verified: true,
      cleared: false,
      provider_transaction_id: String(cap.capture_id),
    });

    if (campaign.created_by_id) {
      await reconcileNotificationMirror(sr, canonical.operationId, {
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${displayName} gave USD ${total.toLocaleString()} to \"${campaign.title}\" via ${paymentChannel === 'googlepay' ? 'Google Pay' : paymentChannel === 'applepay' ? 'Apple Pay' : 'PayPal'}`,
        type: 'donation',
        link: `/campaign/${campaign_id}`,
        read: false,
      });
    }

    if (canonical.applied) {
      await logAudit(base44, {
        action: 'donation_captured',
        target_type: 'campaign',
        target_id: campaign_id,
        detail: `USD ${total} via ${paymentChannel === 'googlepay' ? 'Google Pay' : paymentChannel === 'applepay' ? 'Apple Pay' : 'PayPal'} ${recovering ? 'recovered from a completed capture' : 'captured'} and applied canonically`,
        status: 'success',
        metadata: { canonical_operation_id: String(canonical.operationId), provider_reference: cap.capture_id },
      });
    }

    // Automated receipt: email the donor a receipt for every verified gift.
    if (canonical.applied) {
      await sendDonationReceipt(sr, { ...donation, donor_email: donor?.email }, campaign);
      // Marketing KPI: a verified, canonically-applied donation is the ultimate proof of trust.
      try { await base44.analytics.track({ eventName: 'donation_completed', properties: { campaign_id, amount: total, is_recurring: !!is_recurring } }); } catch (_) { /* non-fatal */ }
    }

    return Response.json({
      ok: true,
      donation_id: donation?.id,
      amount: total,
      duplicate: !canonical.applied,
      canonical_operation_id: String(canonical.operationId),
    });
  } catch (error) {
    console.error('capturePayPalOrder error:', error?.message || error);
    return Response.json({ error: 'Unable to complete your donation safely. Please try again or contact support.' }, { status: 503 });
  }
}
