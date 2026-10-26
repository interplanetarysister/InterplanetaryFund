import { giftOf, round2, computeWithdrawal } from './fees.js';

const TERMINAL_STATES = ['completed', 'cancelled', 'failed'];

function normalizePaymentChannel(value) {
  return String(value || '').trim().toLowerCase();
}

function donationAllocationIdentity(value, includePaymentChannel = true) {
  return JSON.stringify({
    operationType: String(value.operation_type || 'donation'),
    campaignId: String(value.campaign_id || ''),
    campaignOwnerUserId: String(value.campaign_owner_user_id || ''),
    provider: String(value.provider || ''),
    providerTransactionId: String(value.provider_transaction_id || ''),
    grossAmount: round2(Number(value.gross_amount || 0)),
    platformContribution: round2(Number(value.platform_contribution || 0)),
    processingFee: round2(Number(value.processing_fee || 0)),
    ...(includePaymentChannel ? { paymentChannel: normalizePaymentChannel(value.payment_channel) } : {}),
  });
}

async function allocationFingerprint(identity) {
  const bytes = new TextEncoder().encode(identity);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function flagAllocationConflict(sr, rows, operationKey) {
  const note = `CONFLICT: immutable donation allocation differs for operation ${operationKey}. Manual reconciliation required.`;
  await Promise.all((rows || []).map((row) =>
    row?.id ? sr.entities.FinancialOperation.update(row.id, { note }).catch(() => {}) : null
  ));
}

// Converge duplicate FinancialOperation records for the same operation_key.
//
// Ordering contract (defect A repair):
//   1. determine the canonical (earliest) record;
//   2. determine whether the records can SAFELY converge — conflicting terminal
//      states (e.g. one completed, one failed) must NOT be merged or deleted;
//   3. persist the canonical merged state;
//   4. only after a successful persist, remove genuinely redundant duplicates.
//
// A persistence failure is NOT silently suppressed — it aborts convergence so
// duplicate state is never destroyed before the canonical record absorbs it.
async function one(sr, operationKey) {
  const rows = await sr.entities.FinancialOperation.filter({ operation_key: operationKey }).catch(() => []);
  if (!rows || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const ordered = [...rows].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const canonical = ordered[0];

  // Never converge evidence that binds one key to different money or rails.
  const donationRows = ordered.filter((row) => row.operation_type === 'donation');
  const donationChannels = new Set(donationRows.map((row) => String(row.payment_channel || '')).filter(Boolean));
  if (donationRows.length && (donationRows.length !== ordered.length || new Set(donationRows.map(donationAllocationIdentity)).size > 1 || donationChannels.size > 1)) {
    await flagAllocationConflict(sr, ordered, operationKey);
    throw new Error('Conflicting immutable donation allocation requires manual reconciliation.');
  }

  // Detect conflicting terminal states. Completed ≠ cancelled ≠ failed.
  // These represent materially different financial outcomes and must never be
  // silently merged. Retain all evidence and return the earliest without
  // deleting anything; the conflict enters a manual reconciliation path.
  const terminalPresent = new Set(
    ordered.map((r) => r.state).filter((s) => TERMINAL_STATES.includes(s))
  );
  if (terminalPresent.size > 1) {
    // Flag the canonical record for reconciliation review.
    await sr.entities.FinancialOperation.update(canonical.id, {
      note: `CONFLICT: duplicate records with conflicting terminal states (${[...terminalPresent].join(', ')}) exist for this operation. Manual reconciliation required.`
    }).catch(() => {});
    return canonical;
  }

  // Safe convergence: build the merged patch from duplicates. Only forward
  // state to a terminal value if ALL duplicates agree on that terminal state.
  const patch = {};
  const agreedTerminal = terminalPresent.size === 1 ? [...terminalPresent][0] : null;

  for (const dup of ordered.slice(1)) {
    if (agreedTerminal && dup.state === agreedTerminal) {
      patch.state = agreedTerminal;
      if (dup.completed_at) patch.completed_at = dup.completed_at;
      if (dup.cancelled_at) patch.cancelled_at = dup.cancelled_at;
      if (dup.provider_transaction_id) patch.provider_transaction_id = dup.provider_transaction_id;
    } else if (!TERMINAL_STATES.includes(dup.state) && !TERMINAL_STATES.includes(canonical.state)) {
      // Neither is terminal — forward to the more progressed non-terminal state.
      const rank = { pending: 0, applied: 1, reserved: 2 };
      if ((rank[dup.state] || 0) > (rank[canonical.state] || 0)) {
        patch.state = dup.state;
      }
    }
    if (dup.withdrawal_id && !canonical.withdrawal_id) patch.withdrawal_id = dup.withdrawal_id;
    if (dup.provider_transaction_id && !canonical.provider_transaction_id) patch.provider_transaction_id = dup.provider_transaction_id;
  }

  // Step 3: persist canonical state BEFORE any destructive cleanup.
  if (Object.keys(patch).length) {
    await sr.entities.FinancialOperation.update(canonical.id, patch);
    // Step 4: persist succeeded — now safe to remove redundant duplicates.
  }
  for (const dup of ordered.slice(1)) {
    await sr.entities.FinancialOperation.delete(dup.id).catch(() => {});
  }
  return canonical;
}

export async function ensureCanonicalCampaign(sr, campaign, currentWithdrawalId = '') {
  if (!campaign?.id) throw new Error('Campaign is required for financial registration.');
  const rows = await sr.entities.Donation.filter({ campaign_id: campaign.id }, '-created_date', 5000).catch(() => []);
  if (rows.length >= 5000) throw new Error('Campaign financial baseline exceeds the safe batch size.');
  const verified = rows.filter((d) => d.payment_verified === true && (!d.is_institutional || d.cleared === true));
  const raisedAmount = round2(verified.reduce((s,d) => s + giftOf(d), 0));
  const donorCount = verified.length;
  const donationAvailable = round2(verified.filter((d) => !d.withdrawal_id || d.withdrawal_id === currentWithdrawalId).reduce((s,d) => s + giftOf(d), 0));
  // Verified external-platform settlements that have actually arrived in the
  // Interplanetary holding account are available for withdrawal too. Restrict
  // this to source_type=external_platform so direct IFund PayPal donations are
  // not double-counted (those are already represented by Donation rows).
  const settledExternal = await sr.entities.HoldingLedgerEntry.filter({
    campaign_id: campaign.id,
    beneficiary_user_id: campaign.created_by_id,
    source_type: 'external_platform',
    direction: 'in',
    state: 'settled',
  }, '-created_date', 5000).catch(() => []);
  if (settledExternal.length >= 5000) throw new Error('Campaign external settlement baseline exceeds the safe batch size.');
  const externalAvailable = round2(settledExternal
    .filter((entry) => !entry.withdrawal_id || entry.withdrawal_id === currentWithdrawalId)
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  const availableBalance = round2(donationAvailable + externalAvailable);
  return { campaignId: campaign.id, raisedAmount, donorCount, availableBalance, donationAvailable, externalAvailable, needsLegacyBaseline: false };
}

export async function recordCanonicalDonation(sr, args) {
  const allocation = {
    operation_key: args.operationKey, operation_type: 'donation', state: 'applied',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId || '',
    provider: args.provider || '', provider_transaction_id: args.providerTransactionId || '',
    payment_channel: normalizePaymentChannel(args.paymentMethod),
    gross_amount: round2(Number(args.grossAmount || 0)), platform_contribution: round2(Number(args.platformContribution || 0)),
    processing_fee: round2(Number(args.processingFee || 0))
  };
  const identity = donationAllocationIdentity(allocation);
  const coreIdentity = donationAllocationIdentity(allocation, false);
  const fingerprint = await allocationFingerprint(identity);

  const priorRows = await sr.entities.FinancialOperation.filter({ operation_key: args.operationKey }).catch(() => []);
  if (priorRows?.length) {
    if (priorRows.some((row) =>
      row.operation_type !== 'donation' || donationAllocationIdentity(row, false) !== coreIdentity ||
      (row.payment_channel && donationAllocationIdentity(row) !== identity)
    )) {
      await flagAllocationConflict(sr, priorRows, args.operationKey);
      throw new Error('Donation operation key is already bound to a different allocation.');
    }
    const expectedChannel = normalizePaymentChannel(args.paymentMethod);
    const channels = new Set(priorRows.map((row) => normalizePaymentChannel(row.payment_channel)).filter(Boolean));
    if (channels.size > 1 || (channels.size === 1 && expectedChannel && !channels.has(expectedChannel))) {
      await flagAllocationConflict(sr, priorRows, args.operationKey);
      throw new Error('Donation operation key is already bound to a different payment channel.');
    }
    if (expectedChannel && priorRows.some((row) => !row.payment_channel)) {
      await flagAllocationConflict(sr, priorRows, args.operationKey);
      throw new Error('Legacy donation operation is missing immutable payment-channel evidence. Manual reconciliation required.');
    }
    const prior = await one(sr, args.operationKey);
    const campaign = await sr.entities.Campaign.get(args.campaignId);
    const totals = await ensureCanonicalCampaign(sr, campaign);
    return { operationId: prior.id, applied: false, ...totals };
  }

  const result = await sr.entities.FinancialOperation.upsert(
    [{ ...allocation, allocation_fingerprint: fingerprint }],
    { key: ['operation_key', 'allocation_fingerprint'] }
  );
  const written = result?.records?.[0] || null;
  const op = await one(sr, args.operationKey);
  if (!op || donationAllocationIdentity(op) !== identity) {
    throw new Error('Canonical donation allocation could not be confirmed.');
  }
  const campaign = await sr.entities.Campaign.get(args.campaignId);
  const totals = await ensureCanonicalCampaign(sr, campaign);
  return { operationId: op.id, applied: Number(result?.created || 0) > 0 && written?.id === op.id, ...totals };
}

export async function recordCanonicalExternalObservation(sr, args) {
  const amount = Number(args.amount || args.grossAmount || 0);
  const currency = String(args.currency || '').trim().toUpperCase();
  const connectionId = String(args.externalConnectionId || args.providerAccountId || '');
  if (!(amount > 0)) throw new Error('External observation amount must be positive.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('External observation currency must be a valid ISO code.');
  if (!connectionId) throw new Error('External observation requires a connection id.');

  let op = await one(sr, args.operationKey);
  const operationCreated = !op;
  if (!op) {
    op = await sr.entities.FinancialOperation.create({
      operation_key: args.operationKey, operation_type: 'external_observation', state: 'applied',
      campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId || '',
      provider: args.provider || '', provider_transaction_id: args.providerTransactionId || '',
      gross_amount: amount,
    });
  } else {
    const sameIdentity =
      op.operation_type === 'external_observation' &&
      String(op.campaign_id || '') === String(args.campaignId || '') &&
      String(op.campaign_owner_user_id || '') === String(args.campaignOwnerUserId || '') &&
      String(op.provider || '') === String(args.provider || '') &&
      String(op.provider_transaction_id || '') === String(args.providerTransactionId || '') &&
      Math.abs(Number(op.gross_amount || 0) - amount) < 0.01;
    if (!sameIdentity) throw new Error('External observation idempotency conflict requires reconciliation.');
  }

  let mirrors = await sr.entities.ExternalFundObservation.filter({ operation_key: args.operationKey }).catch(() => []);
  let observation = mirrors?.[0] || null;
  if (!observation) {
    observation = await sr.entities.ExternalFundObservation.create({
      operation_key: args.operationKey,
      provider: String(args.provider || ''),
      provider_transaction_id: String(args.providerTransactionId || ''),
      external_connection_id: connectionId,
      campaign_id: String(args.campaignId || ''),
      beneficiary_user_id: String(args.campaignOwnerUserId || ''),
      amount,
      currency,
      observed_at: new Date().toISOString(),
      settlement_state: 'external',
      description: 'Provider-verified external observation. Not IFund-held or withdrawable until independently settled into the IFund holding account.',
    });
  } else {
    const sameMirror =
      String(observation.external_connection_id || '') === connectionId &&
      String(observation.campaign_id || '') === String(args.campaignId || '') &&
      String(observation.beneficiary_user_id || '') === String(args.campaignOwnerUserId || '') &&
      String(observation.provider || '') === String(args.provider || '') &&
      String(observation.provider_transaction_id || '') === String(args.providerTransactionId || '') &&
      String(observation.currency || '').toUpperCase() === currency &&
      Math.abs(Number(observation.amount || 0) - amount) < 0.01;
    if (!sameMirror) throw new Error('External observation mirror conflict requires reconciliation.');
  }

  // Converge accidental duplicate mirrors only when they represent the exact
  // same provider observation. Keep conflicting evidence for manual review.
  if ((mirrors || []).length > 1) {
    const ordered = [...mirrors].sort((a, b) => {
      const at = new Date(a.created_date || 0).getTime();
      const bt = new Date(b.created_date || 0).getTime();
      if (at !== bt) return at - bt;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    observation = ordered[0];
    for (const duplicate of ordered.slice(1)) {
      const same =
        duplicate.external_connection_id === observation.external_connection_id &&
        duplicate.campaign_id === observation.campaign_id &&
        duplicate.beneficiary_user_id === observation.beneficiary_user_id &&
        duplicate.provider === observation.provider &&
        duplicate.provider_transaction_id === observation.provider_transaction_id &&
        String(duplicate.currency || '').toUpperCase() === String(observation.currency || '').toUpperCase() &&
        Math.abs(Number(duplicate.amount || 0) - Number(observation.amount || 0)) < 0.01;
      if (same) await sr.entities.ExternalFundObservation.delete(duplicate.id).catch(() => {});
    }
  }

  const connectionRows = await sr.entities.ExternalFundObservation.filter({
    external_connection_id: connectionId,
    campaign_id: String(args.campaignId || ''),
    beneficiary_user_id: String(args.campaignOwnerUserId || ''),
    currency,
  }, '-created_date', 5000).catch(() => []);
  if (connectionRows.length >= 5000) throw new Error('External observation history exceeds the safe batch size.');
  const liveRows = connectionRows.filter((row) => row.settlement_state !== 'reversed');
  const observedTotal = round2(liveRows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const observedCount = liveRows.length;

  return {
    operationId: op.id,
    observationId: observation.id,
    created: operationCreated,
    observedTotal,
    observedCount,
    currency,
  };
}

export async function reserveCanonicalWithdrawal(sr, args) {
  const prior = await one(sr, args.operationKey);
  if (prior) {
    if (prior.state === 'cancelled' || prior.state === 'failed') throw new Error('Withdrawal reservation is no longer active.');
    return { reservationId: prior.id, ledgerEntryId: prior.id, grossAmount: prior.gross_amount, platformFee: prior.platform_fee, netAmount: prior.net_amount };
  }
  const campaign = await sr.entities.Campaign.get(args.campaignId);
  if (!campaign || campaign.created_by_id !== args.campaignOwnerUserId) throw new Error('Campaign ownership mismatch.');
  const totals = await ensureCanonicalCampaign(sr, campaign, args.withdrawalId || '');
  const gross = round2(Number(args.requestedGross || 0));
  if (!(gross > 0) || gross > totals.availableBalance) throw new Error('Insufficient verified available balance.');
  const { fee, net } = computeWithdrawal(gross);
  const op = await sr.entities.FinancialOperation.create({
    operation_key: args.operationKey, operation_type: 'withdrawal_reservation', state: 'reserved',
    campaign_id: args.campaignId, campaign_owner_user_id: args.campaignOwnerUserId,
    gross_amount: gross, platform_fee: fee, net_amount: net, payout_method: args.payoutMethod || '',
    payout_destination_ref: args.payoutDestination ? 'configured' : ''
  });
  return { reservationId: op.id, ledgerEntryId: op.id, grossAmount: gross, platformFee: fee, netAmount: net };
}

export async function completeCanonicalWithdrawal(sr, args) {
  const op = await one(sr, args.operationKey);
  if (!op) throw new Error('Withdrawal reservation not found.');
  if (op.state === 'completed') return { operationId: op.id, applied: false };
  if (op.state !== 'reserved') throw new Error('Withdrawal reservation is not active.');
  await sr.entities.FinancialOperation.update(op.id, { state: 'completed', provider_transaction_id: String(args.providerTransactionId || ''), completed_at: new Date().toISOString() });
  return { operationId: op.id, applied: true };
}

export async function cancelCanonicalWithdrawal(sr, args) {
  const op = await one(sr, args.operationKey);
  if (!op) throw new Error('Withdrawal reservation not found.');
  if (op.state === 'cancelled') return { operationId: op.id, applied: false };
  if (op.state === 'completed') throw new Error('Completed withdrawal cannot be cancelled.');
  await sr.entities.FinancialOperation.update(op.id, { state: 'cancelled', cancelled_at: new Date().toISOString(), note: String(args.reason || '') });
  return { operationId: op.id, applied: true };
}

export async function mirrorCanonicalCampaignTotal(sr, campaignId, canonical) {
  if (!canonical || !Number.isFinite(Number(canonical.raisedAmount)) || !Number.isFinite(Number(canonical.donorCount))) return;
  await sr.entities.Campaign.update(campaignId, { raised_amount: Number(canonical.raisedAmount), donor_count: Number(canonical.donorCount) });
}

export async function reconcileCanonicalCampaignProjection(sr, campaignId, maxAttempts = 5) {
  if (!campaignId) throw new Error('Campaign is required for total reconciliation.');
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign) throw new Error('Campaign not found while reconciling donation totals.');
    const before = await ensureCanonicalCampaign(sr, campaign);
    await mirrorCanonicalCampaignTotal(sr, campaignId, before);
    const [persisted, after] = await Promise.all([
      sr.entities.Campaign.get(campaignId).catch(() => null),
      ensureCanonicalCampaign(sr, campaign),
    ]);
    if (
      persisted &&
      Number(persisted.raised_amount) === Number(after.raisedAmount) &&
      Number(persisted.donor_count) === Number(after.donorCount) &&
      Number(before.raisedAmount) === Number(after.raisedAmount) &&
      Number(before.donorCount) === Number(after.donorCount)
    ) return after;
  }
  throw new Error('Campaign total projection remained unstable after bounded reconciliation.');
}
