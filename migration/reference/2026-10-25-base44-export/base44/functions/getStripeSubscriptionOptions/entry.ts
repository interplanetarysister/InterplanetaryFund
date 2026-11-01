// Historical compatibility: Stripe payment offers have been retired.
export default async function() {
  return Response.json({ provider: 'stripe', available: false, plans: [],
    day_pass: { available: false }, retired: true },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
