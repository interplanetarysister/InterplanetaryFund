// Stripe catalog writes are retired. Existing records remain for audit history.
export default async function() {
  return Response.json({ error: 'Stripe catalog management is retired in IFund.' }, { status: 410 });
}
