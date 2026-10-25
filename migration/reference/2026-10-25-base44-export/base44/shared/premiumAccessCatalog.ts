// Live IFund Stripe merchant: acct_1TxdGsGg5Dyxp347.
// These fixed-price IDs belong only to IFund premium services, never campaign donations.
export const PREMIUM_MONTHLY_PRICE_ID = 'price_1UOFDfGg5Dyxp347qGlvjDcY';
export const PREMIUM_DAY_PASS_PRICE_ID = 'price_1UOFDgGg5Dyxp347qHsT4r7m';
export const PREMIUM_DAY_PASS_PRODUCT_ID = 'prod_VP3KECQ9qWJlnJ';
export const PREMIUM_WELCOME_COUPON_ID = 'eTE4pUPM';
export const DAY_PASS_DURATION_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DURATION_MS = 3 * DAY_PASS_DURATION_MS;

export function verifiedDayPassPrice(price: any): boolean {
  return Boolean(price && price.id === PREMIUM_DAY_PASS_PRICE_ID &&
    price.object === 'price' && price.active === true && price.livemode === true &&
    price.currency === 'usd' && Number(price.unit_amount) === 100 &&
    price.type === 'one_time' && !price.recurring &&
    price.product === PREMIUM_DAY_PASS_PRODUCT_ID);
}

export function introductoryCouponIsValid(coupon: any): boolean {
  const products = coupon?.applies_to?.products || [];
  return Boolean(coupon && coupon.id === PREMIUM_WELCOME_COUPON_ID &&
    coupon.valid === true && coupon.livemode === true &&
    coupon.duration === 'once' && Number(coupon.percent_off) === 50 &&
    Array.isArray(products) && (products.length === 0 || products.includes('prod_VP3KJb28HZaO5P')));
}
