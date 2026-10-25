// Frontend mirror of base44/shared/fees.js; keep pure donation calculations in sync.
// Shared money arithmetic. Historical donations keep their original recorded
// allocations; new PayPal orders use gift-first checkout quotes below.
// Donor selects the campaign gift. Optional 10% platform support is an
// ADDITIONAL CHARGE, not a deduction from that gift. Processor fees are also
// separately included in the explicitly displayed total. IFund's 3% fee is
// deducted once at withdrawal and is disclosed to the campaign owner there.
// Quotes are estimates until the provider's capture is verified. Never credit
// unverified funds or silently reduce a promised campaign gift.

export const PLATFORM_FEE_RATE = 0.03;
export const CONTRIBUTION_RATE = 0.10;
export const PROCESSING_RATE = 0.029;
export const PROCESSING_FIXED = 0.30;
// PayPal US published standard domestic pricing (effective Sep 1, 2026):
// PayPal Checkout 3.49% + $0.49; Expanded Checkout wallets 2.89% + $0.29.
export const PAYPAL_PROCESSING_RATE = 0.0349;
export const PAYPAL_PROCESSING_FIXED = 0.49;
export const PAYPAL_WALLET_PROCESSING_RATE = 0.0289;
export const PAYPAL_WALLET_PROCESSING_FIXED = 0.29;

// Minimum donation: one dollar. Sub-dollar charges are rejected by most
// processors and cannot yield a meaningful recipient payout after fees.
export const MIN_DONATION = 1;

// Integer minor-unit (cents) helpers.
const toCents = (n) => Math.round((Number(n) || 0) * 100);
const fromCents = (c) => (Math.round(c) || 0) / 100;

export const round2 = (n) => fromCents(toCents(n));

// Validates a donor-entered amount before any payment is started. Returns
// { ok: true } or { ok: false, error }. Rejects zero/negative, sub-minimum,
// and amounts too large to charge.
export function validateDonationAmount(amount) {
  const a = Number(amount) || 0;
  if (!a || a <= 0) return { ok: false, error: 'Enter a positive donation amount.' };
  if (a < MIN_DONATION) return { ok: false, error: `The minimum donation is $${MIN_DONATION.toFixed(2)}.` };
  if (a > 1000000) return { ok: false, error: 'Donation amount is too large.' };
  return { ok: true };
}

// Optional 10% added on top of a donor-entered campaign gift for new checkouts.
// Historical stored donations still use amount minus platform_contribution.
export function computeContribution(amount, optedIn) {
  const a = toCents(amount);
  if (!optedIn || a <= 0) return 0;
  return fromCents(a * CONTRIBUTION_RATE);
}

// Historical stored-allocation calculation (not the new checkout quote).
// The gift from a recorded Donation is always gross minus contribution.
export function recipientGift(amount, optedIn) {
  const a = toCents(amount);
  const c = toCents(computeContribution(amount, optedIn));
  return fromCents(Math.max(0, a - c));
}

// Per-donation gift from a stored Donation record (amount minus its contribution).
export function giftOf(donation) {
  if (!donation) return 0;
  const a = toCents(donation.amount);
  const c = toCents(donation.platform_contribution);
  return fromCents(Math.max(0, a - c));
}

// The processor's fee (Stripe/PayPal). Charged ON TOP of the donation where the
// processor permits, identified by its actual source — never an IF fee.
export function computeProcessingFee(total) {
  const t = toCents(total);
  if (t <= 0) return 0;
  const fixed = Math.round(PROCESSING_FIXED * 100);
  const donation = Math.max(0, Math.floor((t - fixed) / (1 + PROCESSING_RATE)));
  return fromCents(t - donation);
}

// Total charged to the donor where the processor permits passing the processing
// cost through: the donation plus the processor's fee.
function feeFromTotal(total, rate, fixedDollars) {
  const t = toCents(total);
  if (t <= 0) return 0;
  const fixed = Math.round(fixedDollars * 100);
  const donation = Math.max(0, Math.floor((t - fixed) / (1 + rate)));
  return fromCents(t - donation);
}
export function computePayPalProcessingFee(total) { return feeFromTotal(total, PAYPAL_PROCESSING_RATE, PAYPAL_PROCESSING_FIXED); }
export function computePayPalWalletProcessingFee(total) { return feeFromTotal(total, PAYPAL_WALLET_PROCESSING_RATE, PAYPAL_WALLET_PROCESSING_FIXED); }

export function computeChargeTotal(total) { return round2(Number(total) || 0); }

// 3% platform fee on the recipient's gift (deducted at payout). Never negative.
export function computePlatformFee(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  return fromCents(Math.max(0, Math.round(gift * PLATFORM_FEE_RATE)));
}

// What the campaign actually receives, after the 3% platform fee. Never negative.
export function computeRecipientNet(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  const fee = toCents(computePlatformFee(amount, optedIn));
  return fromCents(Math.max(0, gift - fee));
}

// Gift-first estimate for generic card processing. The donor must approve the
// complete amount, including optional support and provider processing costs.
export function computeBreakdown(gift, optedIn) {
  return quoteGiftFirst(gift, optedIn, PROCESSING_RATE, PROCESSING_FIXED);
}

// Legacy breakdown function retained for historical estimate comparisons. New
// checkout flows must use quoteGiftFirst so entered gifts stay intact.
export function computeProcessorBreakdown(total, optedIn, processingFeeForTotal) {
  const totalCharged = round2(Number(total) || 0);
  const processing = round2(processingFeeForTotal(totalCharged));
  const a = round2(Math.max(0, totalCharged - processing));
  const contribution = computeContribution(a, optedIn);
  const gift = round2(a - contribution);
  const platformFee = computePlatformFee(a, optedIn);
  const recipientNet = round2(Math.max(0, gift - platformFee));
  return { amount: a, contribution, recipientGift: gift, processing, platformFee, recipientNet, totalCharged };
}

export function computePayPalBreakdown(gift, optedIn, paymentChannel = 'paypal') {
  return ['googlepay', 'applepay'].includes(paymentChannel)
    ? quoteGiftFirst(gift, optedIn, PAYPAL_WALLET_PROCESSING_RATE, PAYPAL_WALLET_PROCESSING_FIXED)
    : quoteGiftFirst(gift, optedIn, PAYPAL_PROCESSING_RATE, PAYPAL_PROCESSING_FIXED);
}

export function computePayPalWalletBreakdown(gift, optedIn) {
  return quoteGiftFirst(gift, optedIn, PAYPAL_WALLET_PROCESSING_RATE, PAYPAL_WALLET_PROCESSING_FIXED);
}

// Gift-first quote in integer cents. Gross up for the processor's percentage
// on the TOTAL charge plus fixed fee. Using a conservative whole-cent charge
// guarantees the estimated net is at least the donor's promised gift + tip.
export function quoteGiftFirst(gift, optedIn, rate, fixedDollars) {
  const raw = Number(gift);
  if (!Number.isFinite(raw) || raw <= 0) return { amount: 0, contribution: 0, recipientGift: 0, processing: 0, platformFee: 0, recipientNet: 0, totalCharged: 0 };
  const giftCents = toCents(raw);
  const tipCents = optedIn ? Math.round(giftCents * CONTRIBUTION_RATE) : 0;
  const allocationCents = giftCents + tipCents;
  const fixedCents = toCents(fixedDollars);
  let chargeCents = Math.ceil((allocationCents + fixedCents) / (1 - rate));
  while (chargeCents - Math.round(chargeCents * rate + fixedCents) < allocationCents) chargeCents++;
  const withdrawal = computeWithdrawal(fromCents(giftCents));
  return {
    amount: fromCents(allocationCents),
    contribution: fromCents(tipCents),
    recipientGift: fromCents(giftCents),
    processing: fromCents(chargeCents - allocationCents),
    platformFee: withdrawal.fee, // only render in the campaign owner's withdrawal view
    recipientNet: withdrawal.net, // never show a premature net gift to donors
    totalCharged: fromCents(chargeCents),
  };
}

// Withdrawal math for a set of recipient gifts: the single 3% platform fee and
// net payout. No processing fee here — the processor already took its one fee
// at checkout, so deducting it again at payout would double-charge. Never negative.
export function computeWithdrawal(giftsTotal) {
  const gross = round2(Number(giftsTotal) || 0);
  const fee = round2(gross * PLATFORM_FEE_RATE);
  const net = round2(Math.max(0, gross - fee));
  return { gross, fee, net };
}
