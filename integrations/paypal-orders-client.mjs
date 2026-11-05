/** Read-only PayPal Orders API adapter for server-side Cloudflare Workers.
 * Optional APIMatic-generated clients can replace this transport after contract verification.
 * Never expose an OAuth access token to browsers or logs.
 */
export function createPayPalOrderReader({ accessToken, environment = 'sandbox', fetchImpl = fetch } = {}) {
  if (typeof accessToken !== 'string' || !accessToken.trim()) throw new Error('Server-side PayPal OAuth token required');
  if (!['sandbox', 'live'].includes(environment)) throw new Error('Invalid PayPal environment');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const base = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  return Object.freeze({
    async getOrder(orderId) {
      if (typeof orderId !== 'string' || !/^[A-Za-z0-9]{8,32}$/.test(orderId)) throw new Error('Invalid PayPal order ID');
      const response = await fetchImpl(base + '/v2/checkout/orders/' + encodeURIComponent(orderId), {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('PayPal order lookup failed (' + response.status + ')');
      const order = await response.json();
      if (!order || order.id !== orderId || typeof order.status !== 'string') throw new Error('Invalid PayPal order response');
      return order;
    },
  });
}
