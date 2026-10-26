// Wallet connection is not payment acceptance. Crypto checkout remains blocked
// until a non-Stripe provider can verify on-chain settlement and credit campaigns.
export default async function() {
  return Response.json({ crypto: {
    wallet_provider: 'reown_appkit', settlement_provider: null,
    configured: false, verified_checkout_live: false,
    settlement_ready: false, status: 'awaiting_verified_settlement_gateway',
    reason: 'A compatible crypto payment provider and IFund settlement reconciliation are not yet verified.',
  }}, { headers: { 'Cache-Control': 'no-store' } });
}
