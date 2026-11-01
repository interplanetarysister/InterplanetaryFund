import { secrets } from 'base44:runtime';
import { IFUND_PAYPAL_ACCOUNT_REF } from './paypal.ts';
import { subscriptionPrice, providerPriceIsExact } from './subscriptionCatalog.js';

const BASE = 'https://api-m.paypal.com';
const PAYPAL_PLAN_PATTERN = /^P-[A-Z0-9]{20,32}$/;
const PAYPAL_SUB_PATTERN = /^I-[A-Z0-9]{10,30}$/;
export { IFUND_PAYPAL_ACCOUNT_REF };
// PayPal Button Factory's owner-supplied $12/month plan. This is only
// a candidate until the configured live PayPal REST app verifies it.
export const IFUND_OWNER_BASIC_MONTHLY_PLAN_ID = 'P-6YD2273006199630KNLDXBLA';
export function isPayPalSubscriptionId(id: unknown): boolean { return PAYPAL_SUB_PATTERN.test(String(id || '')); }
export function isPayPalPlanId(id: unknown): boolean { return PAYPAL_PLAN_PATTERN.test(String(id || '')); }

// Reuse the short-lived OAuth token across the ten plan provisioning calls.
let tokenCache: { client: string; token: string; until: number; pending: Promise<string> | null } =
  { client: '', token: '', until: 0, pending: null };
async function liveBillingToken() {
  if (secrets.get('PAYPAL_MODE') !== 'live') throw new Error('Live PayPal billing is not enabled.');
  const client = String(secrets.get('PAYPAL_CLIENT_ID') || '');
  const secret = String(secrets.get('PAYPAL_CLIENT_SECRET') || '');
  if (!client || !secret) throw new Error('Business PayPal REST credentials are unavailable.');
  if (tokenCache.client === client && tokenCache.token && tokenCache.until > Date.now()) return tokenCache.token;
  if (tokenCache.client === client && tokenCache.pending) return await tokenCache.pending;
  const pending = (async () => {
    const auth = await fetch(BASE + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(client + ':' + secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!auth.ok) throw new Error('PayPal business authorization failed.');
    const data = await auth.json();
    if (!data?.access_token) throw new Error('PayPal business authorization failed.');
    const until = Date.now() + Math.max(10000, Math.min(300000, (Number(data.expires_in) || 300) * 1000 - 60000));
    tokenCache = { client, token: data.access_token, until, pending: null };
    return data.access_token as string;
  })();
  tokenCache = { client, token: '', until: 0, pending };
  try { return await pending; } catch (error) {
    tokenCache = { client: '', token: '', until: 0, pending: null };
    throw error;
  }
}
export async function paypalBillingRequest(path: string, options: any = {}) {
  const token = await liveBillingToken();
  const response = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.requestId ? { 'PayPal-Request-Id': options.requestId } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Keep provider response bodies private; they can contain account details.
    const err: any = new Error('PayPal billing request failed.');
    err.status = response.status;
    throw err;
  }
  return data;
}
export async function getPayPalBillingSubscription(id: string) {
  if (!isPayPalSubscriptionId(id)) throw new Error('Invalid PayPal subscription identifier.');
  return await paypalBillingRequest('/v1/billing/subscriptions/' + encodeURIComponent(id));
}
export async function getPayPalBillingPlan(id: string) {
  if (!isPayPalPlanId(id)) throw new Error('Invalid PayPal plan identifier.');
  return await paypalBillingRequest('/v1/billing/plans/' + encodeURIComponent(id));
}
export async function verifiedPayPalPlan(sr: any, tier: string, interval: string) {
  const expected = subscriptionPrice(tier, interval);
  if (!expected) return null;
  const rows = await sr.entities.SubscriptionPlanMapping.filter({
    provider: 'paypal', tier, interval, account_ref: IFUND_PAYPAL_ACCOUNT_REF,
  }).catch(() => []);
  const row = (rows || []).find((r: any) =>
    r.catalog_version === expected.version && r.amount_cents === expected.amount_cents &&
    r.currency === 'USD' && isPayPalPlanId(r.plan_id));
  if (!row) return null;
  const plan = await getPayPalBillingPlan(row.plan_id).catch(() => null);
  if (!providerPriceIsExact(plan, expected) || plan.product_id !== row.product_id) return null;
  return { row, plan, expected };
}
export function permittedPayPalCheckoutOrigin(origin: unknown) {
  try {
    const value = new URL(String(origin || ''));
    const allowed = new Set([
      'https://interplanetaryfund.com',
      'https://www.interplanetaryfund.com',
      'https://interplanetaryfund.base44.app',
      'https://interplanetary-fund2.interplanetary-fund.workers.dev',
    ]);
    return value.protocol === 'https:' && value.username === '' && value.password === '' &&
      allowed.has(value.origin) && value.pathname === '/' && !value.search && !value.hash ? value.origin : null;
  } catch { return null; }
}
