// Retired Stripe endpoint kept as a tombstone for older client builds.
// Historical Stripe webhooks and reversal accounting remain separately available.
export default async function() {
  return Response.json({ error: 'Stripe checkout is retired. Use IFund PayPal billing.' }, { status: 410 });
}
