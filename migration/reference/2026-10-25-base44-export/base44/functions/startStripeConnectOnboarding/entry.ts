// New Stripe Connect onboarding is retired. Existing historical payout account
// records are left intact for tracing and dispute review.
export default async function() {
  return Response.json({ error: 'Stripe Connect onboarding is no longer offered.' }, { status: 410 });
}
