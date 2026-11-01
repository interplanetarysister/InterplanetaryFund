// Deprecated Stripe donation handler: no new customer charge sessions are permitted.
// Existing Stripe payment and dispute webhooks must remain available for reconciliation.
export default async function() {
  return Response.json({ error: 'Stripe donations are retired. Use PayPal for campaign gifts.' }, { status: 410 });
}
