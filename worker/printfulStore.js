/**
 * Server-only Printful connection probe for an iFund-managed Manual/API store.
 * Deliberately read-only: this module cannot create orders, products, payments,
 * shipping labels, or merchant accounts. It must never run in the browser.
 *
 * Official endpoint: GET https://api.printful.com/stores/{id}
 */
export const PRINTFUL_STORE_API_ORIGIN = "https://api.printful.com";
export function printfulConfigured(env = {}) {
  const id = Number(env.PRINTFUL_STORE_ID);
  return typeof env.PRINTFUL_API_TOKEN === "string" &&
    env.PRINTFUL_API_TOKEN.length >= 16 &&
    Number.isSafeInteger(id) && id > 0 &&
    String(id) === String(env.PRINTFUL_STORE_ID);
}
export async function inspectPrintfulStore(env = {}, fetcher = fetch) {
  if (!printfulConfigured(env)) return { configured: false, connected: false };
  const storeId = Number(env.PRINTFUL_STORE_ID);
  try {
    const response = await fetcher(PRINTFUL_STORE_API_ORIGIN + "/stores/" + storeId, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + env.PRINTFUL_API_TOKEN,
        Accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { configured: true, connected: false };
    const payload = await response.json();
    const result = payload?.result;
    if (Number(result?.id) !== storeId) return { configured: true, connected: false };
    return {
      configured: true, connected: true,
      storeId, storeName: String(result?.name || "").slice(0, 80),
    };
  } catch {
    return { configured: true, connected: false };
  }
}
/**
 * LINK owns periodic health checks and provider capability verification.
 * Actual order creation must remain on a separately audited, explicit,
 * provider-confirmed purchase path with idempotency and reconciliation.
 */
