// Stripe day-pass purchases are retired. Historical paid passes remain readable.
export default async function() {
  return Response.json({ error: 'Stripe day-pass checkout is retired.' }, { status: 410 });
}
