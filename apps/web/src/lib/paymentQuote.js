// PayPal's U.S. User Agreement prohibits adding a payment-method surcharge.
// The donor pays their selected campaign amount and optional IFund support;
// IFund bears provider processing costs, while the existing 7% platform fee
// remains assessed to the campaign owner at withdrawal, not during checkout.
export function paymentQuoteCents(giftCents, optionalSupportCents = 0, channel = "paypal") {
  if (!Number.isSafeInteger(giftCents) || giftCents < 100 || giftCents > 100000000 ||
      !Number.isSafeInteger(optionalSupportCents) || optionalSupportCents < 0 ||
      optionalSupportCents > Math.round(giftCents * 0.1)) return null;
  return {
    giftCents,
    optionalSupportCents,
    processingCents: 0,
    totalCents: giftCents + optionalSupportCents,
    currency: "USD",
  };
}
