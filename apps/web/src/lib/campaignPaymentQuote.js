const PAYPAL_PROCESSING_RATE = 0.0349;
const PAYPAL_PROCESSING_FIXED_CENTS = 49;
const toCents = (value) => Math.round((Number(value) || 0) * 100);
const fromCents = (value) => Math.round(value) / 100;

// Gift-first quote: optional platform support is added on top of the full
// campaign gift. Provider capture, not this estimate, is authoritative.
export function computePayPalGiftFirstQuote(giftAmount, optionalSupport) {
  const giftCents = toCents(giftAmount);
  if (!Number.isFinite(Number(giftAmount)) || giftCents <= 0) {
    return { gift: 0, support: 0, processing: 0, total: 0 };
  }
  const supportCents = optionalSupport ? Math.round(giftCents * 0.1) : 0;
  const allocationCents = giftCents + supportCents;
  let totalCents = Math.ceil(
    (allocationCents + PAYPAL_PROCESSING_FIXED_CENTS) / (1 - PAYPAL_PROCESSING_RATE)
  );
  while (
    totalCents - Math.round(totalCents * PAYPAL_PROCESSING_RATE + PAYPAL_PROCESSING_FIXED_CENTS)
      < allocationCents
  ) totalCents += 1;
  return {
    gift: fromCents(giftCents),
    support: fromCents(supportCents),
    processing: fromCents(totalCents - allocationCents),
    total: fromCents(totalCents),
  };
}
