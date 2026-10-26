import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { subscriptionPrice, stripePriceFor } from './subscriptionCatalog.js';

export function verifiedStripePrice(price: any, expected: any): boolean {
  return Boolean(price && expected && price.object === 'price' &&
    price.active === true && price.livemode === true &&
    price.currency === 'usd' &&
    Number(price.unit_amount) === Number(expected.amount_cents) &&
    price.recurring?.interval === (expected.interval === 'annual' ? 'year' : 'month') &&
    Number(price.recurring?.interval_count || 1) === 1);
}
export async function stripeSubscriptionClient() {
  const key = String(secrets.get('STRIPE_SECRET_KEY') || '');
  if (!key.startsWith('sk_live_')) throw new Error('Existing live Stripe business credentials are unavailable.');
  const stripe = new Stripe(key);
  const account = await stripe.accounts.retrieve();
  if (!account?.id) throw new Error('Stripe business account identity could not be confirmed.');
  return { stripe, accountId: account.id };
}
export async function resolveStripeSubscriptionPrice(sr: any, stripe: any, accountId: string, tier: string, interval: string) {
  const expected = subscriptionPrice(tier, interval);
  if (!expected) return null;
  const rows = await sr.entities.SubscriptionPlanMapping.filter({
    provider: 'stripe', account_ref: accountId, tier, interval,
  }).catch(() => []);
  const matching = (rows || []).find((row: any) =>
    row.catalog_version === expected.version && row.currency === expected.currency &&
    row.amount_cents === expected.amount_cents && /^price_[a-zA-Z0-9]+$/.test(String(row.plan_id || '')));
  const id = matching?.plan_id || stripePriceFor(tier, interval);
  if (!id) return null;
  const price = await stripe.prices.retrieve(id).catch(() => null);
  if (!verifiedStripePrice(price, expected)) return null;
  if (matching && String(price.product || '') !== String(matching.product_id || '')) return null;
  return { expected, id, product_id: price.product, price };
}
