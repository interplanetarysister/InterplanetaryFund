import { round2, computeContribution } from './fees.js';

// Pure, independently testable settlement calculation. Provider-observed net
// always overrides the checkout fee ESTIMATE when PayPal includes it.
export function resolvePayPalCaptureAllocation({
  chargedAmount,
  quotedDonation,
  quotedFee,
  quotedContribution,
  providerReceivable = null,
  providerFee = null,
  preservePledgedGift = false,
}) {
  const charge = round2(chargedAmount);
  const quote = round2(quotedDonation);
  const feeQuote = round2(quotedFee);
  if (!Number.isFinite(Number(chargedAmount)) || charge <= 0 ||
      !Number.isFinite(Number(quotedDonation)) || quote <= 0 ||
      !Number.isFinite(Number(quotedFee)) || feeQuote < 0 ||
      Math.abs(round2(quote + feeQuote) - charge) > 0.01) {
    return { ok: false, reason: 'order_mismatch' };
  }

  let amount = quote;
  let processingFee = feeQuote;
  let source = 'quote';
  const hasReceivable = providerReceivable != null;
  const hasFee = providerFee != null;
  const received = hasReceivable ? Number(providerReceivable) : null;
  const actualFee = hasFee ? Number(providerFee) : null;
  if ((hasReceivable && (!Number.isFinite(received) || received <= 0 || received > charge)) ||
      (hasFee && (!Number.isFinite(actualFee) || actualFee < 0 || actualFee >= charge))) {
    return { ok: false, reason: 'provider_breakdown_invalid' };
  }
  if (hasReceivable && hasFee && Math.abs(round2(received + actualFee) - charge) > 0.01) {
    return { ok: false, reason: 'provider_breakdown_mismatch' };
  }
  if (hasReceivable) {
    amount = round2(received);
    processingFee = round2(charge - amount);
    source = 'paypal_receivable';
  } else if (hasFee) {
    processingFee = round2(actualFee);
    amount = round2(charge - processingFee);
    source = 'paypal_fee';
  }

  if (!(amount > 0)) return { ok: false, reason: 'provider_receivable_not_positive' };
  // Existing five-field PayPal orders remain on their original allocation rules.
  // New orders promise a fixed gift to the campaign. Allocate processor variance
  // against the platform portion first and never credit money PayPal did not send.
  let platformContribution;
  if (preservePledgedGift) {
    const promisedGift = round2(quote - round2(quotedContribution));
    if (!(promisedGift > 0) || amount < promisedGift) {
      return { ok: false, reason: 'pledged_campaign_gift_shortfall' };
    }
    platformContribution = round2(Math.min(round2(quotedContribution), amount - promisedGift));
  } else {
    platformContribution = Number(quotedContribution) > 0 ? computeContribution(amount, true) : 0;
  }
  if (!(round2(amount - platformContribution) > 0)) {
    return { ok: false, reason: 'campaign_allocation_not_positive' };
  }
  return { ok: true, amount, processingFee, platformContribution, source };
}
