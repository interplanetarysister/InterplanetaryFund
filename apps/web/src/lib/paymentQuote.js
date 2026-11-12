// This mirrors the production payment Worker's integer-cent fee gross-up.
// The backend remains authoritative; PayPal must display the charge to approve.
export function paymentQuoteCents(giftCents, optionalSupportCents = 0, channel = "paypal") {
  if (!Number.isSafeInteger(giftCents) || giftCents < 100 ||
      !Number.isSafeInteger(optionalSupportCents) || optionalSupportCents < 0 ||
      optionalSupportCents > Math.round(giftCents * 0.1)) return null;
  const wallet = channel === "googlepay" || channel === "applepay";
  const rate = wallet ? 0.0289 : 0.0349;
  const fixed = wallet ? 29 : 49;
  let totalCents = Math.ceil((giftCents + optionalSupportCents + fixed) / (1 - rate));
  while (totalCents - Math.round(totalCents * rate + fixed) <
         giftCents + optionalSupportCents) totalCents += 1;
  return {
    giftCents,
    optionalSupportCents,
    processingCents: totalCents - giftCents - optionalSupportCents,
    totalCents,
    currency: "USD",
  };
}
