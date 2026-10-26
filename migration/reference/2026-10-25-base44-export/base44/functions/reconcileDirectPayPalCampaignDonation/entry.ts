import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { getTransaction, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import { recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';
import { logAudit } from '../../shared/auditLog.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);
const isSuperAdminOwner = (user) =>
  user?.role === 'admin' &&
  SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function existingAllocation(sr, transactionId) {
  const [ops, donations, holdings] = await Promise.all([
    sr.entities.FinancialOperation.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
    sr.entities.Donation.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
    sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: transactionId }, '-created_date', 20).catch(() => []),
  ]);
  return { ops: ops || [], donations: donations || [], holdings: holdings || [] };
}

function allocationIsComplete(allocation) {
  if (allocation.ops.length !== 1 || allocation.donations.length !== 1 || allocation.holdings.length !== 1) return false;
  const op = allocation.ops[0];
  const donation = allocation.donations[0];
  const holding = allocation.holdings[0];
  const canonicalId = String(op.id || '');
  const campaignId = String(op.campaign_id || '');
  const transactionId = String(op.provider_transaction_id || '');
  const channel = String(op.payment_channel || '');
  return !!canonicalId && !!campaignId && !!transactionId && ['paypal', 'googlepay', 'applepay'].includes(channel) &&
    op.operation_type === 'donation' && op.state === 'applied' && op.provider === 'paypal' &&
    donation.payment_verified === true && donation.campaign_id === campaignId && donation.provider_transaction_id === transactionId &&
    donation.payment_method === channel && String(donation.canonical_operation_id || '') === canonicalId &&
    round2(donation.amount) === round2(op.gross_amount) &&
    round2(donation.platform_contribution || 0) === round2(op.platform_contribution || 0) &&
    round2(donation.processing_fee || 0) === round2(op.processing_fee || 0) &&
    holding.state === 'settled' && holding.direction === 'in' && holding.source_provider === 'paypal' &&
    holding.campaign_id === campaignId && holding.provider_transaction_id === transactionId && holding.payment_channel === channel &&
    String(holding.currency || '').toUpperCase() === 'USD' && String(holding.canonical_operation_id || '') === canonicalId &&
    round2(holding.amount) === round2(op.gross_amount) &&
    round2(holding.platform_contribution || 0) === round2(op.platform_contribution || 0) &&
    round2(holding.processing_fee || 0) === round2(op.processing_fee || 0);
}

function matchesMoney(row, recoveredAmount, processorFee, platformContribution) {
  const amount = row.operation_type === 'donation' ? row.gross_amount : row.amount;
  return round2(amount) === recoveredAmount &&
    round2(row.platform_contribution || 0) === platformContribution &&
    round2(row.processing_fee || 0) === processorFee;
}

function stableFirst(rows) {
  return [...(rows || [])].sort((a, b) => {
    const time = new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
    return time || String(a.id || '').localeCompare(String(b.id || ''));
  })[0] || null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminOwner(user)) {
      return Response.json({ error: 'Forbidden — super admin only.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body.paypal_transaction_id || '').trim();
    const campaignId = String(body.campaign_id || '').trim();
    const donorName = String(body.donor_name || 'Recovered PayPal supporter').trim().slice(0, 160);
    if (!transactionId || !campaignId) {
      return Response.json({ error: 'PayPal transaction and campaign are required.' }, { status: 400 });
    }

    const tx = await getTransaction(transactionId).catch(() => null);
    if (!tx || tx.id !== transactionId || tx.status !== 'S') {
      return Response.json({ error: 'A settled PayPal receipt could not be verified.' }, { status: 409 });
    }
    if (tx.transactionEventCode !== 'T0013') {
      return Response.json({ error: 'Only PayPal donation-payment receipts can be recovered here.' }, { status: 409 });
    }
    if (String(tx.currency || '').toUpperCase() !== 'USD' || !(Number(tx.amount) > 0)) {
      return Response.json({ error: 'Only positive USD PayPal donation receipts can be recovered here.' }, { status: 409 });
    }
    if (Math.abs(Number(tx.feeAmount || 0)) > 0 && String(tx.feeCurrency || tx.currency || '').toUpperCase() !== 'USD') {
      return Response.json({ error: 'PayPal fee currency does not match this USD receipt.' }, { status: 409 });
    }

    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign?.created_by_id) return Response.json({ error: 'Campaign not found or has no owner.' }, { status: 404 });

    const providerGross = round2(tx.amount);
    const processorFee = round2(Math.abs(Number(tx.feeAmount || 0)));
    const recoveredAmount = round2(providerGross - processorFee);
    if (!(recoveredAmount > 0)) {
      return Response.json({ error: 'PayPal receipt has no recoverable amount after provider fees.' }, { status: 409 });
    }

    const before = await existingAllocation(sr, transactionId);
    const existingRows = [...before.ops, ...before.donations, ...before.holdings];
    const sameCampaign = existingRows.every((row) => !row.campaign_id || row.campaign_id === campaignId);
    if (!sameCampaign) {
      return Response.json({ error: 'This PayPal receipt is already allocated to another campaign.' }, { status: 409 });
    }
    const contributionValues = new Set(existingRows.map((row) => round2(row.platform_contribution || 0)));
    if (contributionValues.size > 1) {
      return Response.json({ error: 'Existing local records disagree on the platform contribution.' }, { status: 409 });
    }
    const platformContribution = existingRows.length ? [...contributionValues][0] : 0;
    if (platformContribution < 0 || platformContribution > recoveredAmount || !(round2(recoveredAmount - platformContribution) > 0)) {
      return Response.json({ error: 'Existing local platform contribution is invalid.' }, { status: 409 });
    }
    const persistedMirrorChannels = new Set([
      ...before.donations.map((row) => String(row.payment_method || '')),
      ...before.holdings.map((row) => String(row.payment_channel || '')),
    ].filter(Boolean));
    const operationChannels = new Set(before.ops.map((row) => String(row.payment_channel || '')).filter(Boolean));
    const paymentMethods = new Set([...operationChannels, ...persistedMirrorChannels]);
    if (existingRows.length && paymentMethods.size === 0) {
      return Response.json({ error: 'Existing local allocation is missing its PayPal payment channel and requires manual review.' }, { status: 409 });
    }
    if ([...paymentMethods].some((method) => !['paypal', 'googlepay', 'applepay'].includes(method)) || paymentMethods.size > 1) {
      return Response.json({ error: 'Existing local records disagree on the PayPal payment channel.' }, { status: 409 });
    }
    const paymentMethod = [...paymentMethods][0] || 'paypal';
    const invalidOperation = before.ops.some((row) =>
      row.operation_type !== 'donation' || row.state !== 'applied' || row.provider !== 'paypal' ||
      row.provider_transaction_id !== transactionId || !matchesMoney(row, recoveredAmount, processorFee, platformContribution)
    );
    const invalidDonation = before.donations.some((row) =>
      row.provider_transaction_id !== transactionId || !matchesMoney(row, recoveredAmount, processorFee, platformContribution)
    );
    const invalidHolding = before.holdings.some((row) =>
      row.source_provider !== 'paypal' || row.provider_transaction_id !== transactionId ||
      row.direction !== 'in' || String(row.currency || '').toUpperCase() !== 'USD' ||
      !matchesMoney(row, recoveredAmount, processorFee, platformContribution)
    );
    if (invalidOperation || invalidDonation || invalidHolding) {
      return Response.json({ error: 'Existing local allocation does not match the verified PayPal receipt.' }, { status: 409 });
    }
    const channelLessOperations = before.ops.filter((row) => !row.payment_channel);
    if (channelLessOperations.length) {
      // A caller/default is never sufficient to mutate legacy immutable
      // provenance. Backfill only after already-persisted Donation/Holding
      // evidence has supplied exactly one allowed channel and every financial
      // identity check above has succeeded.
      if (persistedMirrorChannels.size !== 1 || !persistedMirrorChannels.has(paymentMethod)) {
        return Response.json({ error: 'Legacy canonical operation has no independently persisted payment-channel evidence.' }, { status: 409 });
      }
      await Promise.all(channelLessOperations.map((row) =>
        sr.entities.FinancialOperation.update(row.id, { payment_channel: paymentMethod })
      ));
    }
    const existingOperationKeys = new Set(before.ops.map((row) => String(row.operation_key || '')).filter(Boolean));
    if (existingOperationKeys.size > 1) {
      return Response.json({ error: 'This receipt has conflicting canonical operation identities.' }, { status: 409 });
    }

    const wasComplete = allocationIsComplete(before);
    // Reuse a capture-created canonical operation when present. Otherwise this
    // campaign-independent key atomically claims a legacy direct receipt.
    const operationKey = [...existingOperationKeys][0] || `paypal:legacy-direct:${transactionId}`;
    const canonical = await recordCanonicalDonation(sr, {
      operationKey,
      provider: 'paypal',
      providerTransactionId: transactionId,
      campaignId,
      campaignTitle: campaign.title || '',
      campaignOwnerUserId: campaign.created_by_id,
      grossAmount: recoveredAmount,
      platformContribution,
      processingFee: processorFee,
      donorName,
      message: 'Recovered from a verified direct PayPal receipt that bypassed IFund campaign checkout.',
      paymentMethod,
      paymentVerified: true,
      source: before.ops.length ? 'paypal_capture_recovery' : 'admin_recovered_legacy_direct_paypal',
      isRecurring: !!stableFirst(before.donations)?.is_recurring,
    });

    const canonicalOp = await sr.entities.FinancialOperation.get(canonical.operationId).catch(() => null);
    if (!canonicalOp || canonicalOp.operation_type !== 'donation' || canonicalOp.state !== 'applied' || canonicalOp.provider !== 'paypal' ||
      canonicalOp.campaign_id !== campaignId || canonicalOp.campaign_owner_user_id !== campaign.created_by_id ||
      canonicalOp.provider_transaction_id !== transactionId || canonicalOp.payment_channel !== paymentMethod ||
      !matchesMoney(canonicalOp, recoveredAmount, processorFee, platformContribution)) {
      return Response.json({ error: 'Canonical receipt allocation conflicts with the selected campaign.' }, { status: 409 });
    }

    const holdingKey = stableFirst(before.holdings)?.operation_key || `holding:paypal:legacy-direct:${transactionId}`;
    await sr.entities.HoldingLedgerEntry.upsert([{
        operation_key: holdingKey,
        direction: 'in',
        state: 'settled',
        source_type: 'payment_processor',
        source_provider: 'paypal',
        source_account_ref: IFUND_PAYPAL_ACCOUNT_REF,
        provider_transaction_id: transactionId,
        campaign_id: campaignId,
        beneficiary_user_id: campaign.created_by_id,
        amount: recoveredAmount,
        currency: 'USD',
        platform_contribution: platformContribution,
        processing_fee: processorFee,
        payment_channel: paymentMethod,
        canonical_operation_id: String(canonical.operationId),
        settled_at: tx.transactionUpdatedDate || tx.transactionInitiationDate || new Date().toISOString(),
        reconciliation_note: `Recovered legacy direct PayPal receipt. Provider gross USD ${providerGross.toFixed(2)}, PayPal fee USD ${processorFee.toFixed(2)}, campaign value USD ${recoveredAmount.toFixed(2)}.`,
      }], { key: 'operation_key' });

    const reconciledHoldings = await sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: transactionId }, 'created_date', 20).catch(() => []);
    const canonicalHolding = reconciledHoldings.find((row) => row.operation_key === holdingKey);
    if (!canonicalHolding || reconciledHoldings.some((row) =>
      row.campaign_id !== campaignId || row.source_provider !== 'paypal' || row.provider_transaction_id !== transactionId ||
      row.direction !== 'in' || String(row.currency || '').toUpperCase() !== 'USD' ||
      (row.payment_channel && row.payment_channel !== paymentMethod) ||
      !matchesMoney(row, recoveredAmount, processorFee, platformContribution)
    )) {
      return Response.json({ error: 'Holding ledger reconciliation conflicts with the verified receipt.' }, { status: 409 });
    }
    // Persisted canonical holding now contains the complete evidence. Remove
    // only same-campaign, same-money duplicates that were verified above.
    for (const duplicate of reconciledHoldings) {
      if (duplicate.id !== canonicalHolding.id) {
        await sr.entities.HoldingLedgerEntry.update(duplicate.id, {
          state: 'settled',
          campaign_id: campaignId,
          payment_channel: paymentMethod,
          canonical_operation_id: String(canonical.operationId),
        });
        await sr.entities.HoldingLedgerEntry.delete(duplicate.id);
      }
    }
    const finalHoldings = await sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: transactionId }, 'created_date', 20).catch(() => []);
    if (finalHoldings.length !== 1 || String(finalHoldings[0].canonical_operation_id || '') !== String(canonical.operationId)) {
      throw new Error('PayPal holding ledger did not converge to one canonical allocation.');
    }

    // If a prior crash left same-receipt mirror rows without the canonical
    // link, adopt them before normal mirror convergence. No row is adopted
    // until campaign and money identity have been verified above.
    for (const existingDonation of before.donations) {
      if (String(existingDonation.canonical_operation_id || '') !== String(canonical.operationId)) {
        await sr.entities.Donation.update(existingDonation.id, { canonical_operation_id: String(canonical.operationId) });
      }
    }

    const priorDonation = stableFirst(before.donations);
    const donation = await reconcileDonationMirror(sr, canonical.operationId, {
      campaign_id: campaignId,
      campaign_title: campaign.title || '',
      amount: recoveredAmount,
      platform_contribution: platformContribution,
      processing_fee: processorFee,
      donor_name: priorDonation?.donor_name || donorName || 'Recovered PayPal supporter',
      message: priorDonation?.message || 'Recovered from a verified direct PayPal receipt.',
      is_recurring: !!priorDonation?.is_recurring,
      ...(priorDonation?.is_recurring ? { recurring_status: priorDonation.recurring_status || 'active' } : {}),
      ...(priorDonation?.donor_user_id ? { donor_user_id: priorDonation.donor_user_id } : {}),
      payment_method: paymentMethod,
      payment_verified: true,
      cleared: false,
      provider_transaction_id: transactionId,
      description: priorDonation?.description || `PayPal recovery; provider gross ${providerGross.toFixed(2)}, fee ${processorFee.toFixed(2)}.`,
    });

    const campaignGift = round2(recoveredAmount - platformContribution);
    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: 'PayPal donation recovered',
      body: `A verified PayPal receipt added $${campaignGift.toFixed(2)} to “${campaign.title || 'your campaign'}”.`,
      type: 'donation',
      link: `/campaign/${campaignId}`,
      read: false,
    });

    const completedAllocation = await existingAllocation(sr, transactionId);
    if (!allocationIsComplete(completedAllocation)) {
      throw new Error('PayPal receipt recovery did not converge every canonical side effect.');
    }

    await logAudit(base44, {
      action: 'legacy_paypal_campaign_donation_recovered',
      actor_user_id: user.id,
      target_type: 'Donation',
      target_id: donation.id,
      detail: `Recovered verified PayPal receipt ${transactionId} to campaign ${campaignId}.`,
      status: 'success',
      metadata: {
        canonical_operation_id: String(canonical.operationId),
        paypal_transaction_id: transactionId,
        campaign_id: campaignId,
        provider_gross: providerGross,
        processor_fee: processorFee,
        platform_contribution: platformContribution,
        payment_method: paymentMethod,
        campaign_amount: recoveredAmount,
      },
    });

    return Response.json({
      ok: true,
      duplicate: wasComplete,
      repaired: !wasComplete && existingRows.length > 0,
      campaign_id: campaignId,
      paypal_transaction_id: transactionId,
      provider_gross: providerGross,
      processor_fee: processorFee,
      platform_contribution: platformContribution,
      payment_method: paymentMethod,
      campaign_amount: recoveredAmount,
      campaign_gift: campaignGift,
      canonical_operation_id: String(canonical.operationId),
      donation_id: donation.id,
    });
  } catch (error) {
    console.error('reconcileDirectPayPalCampaignDonation error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'PayPal campaign recovery could not complete safely.' }, { status: 500 });
  }
}
