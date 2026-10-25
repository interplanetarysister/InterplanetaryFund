# IFund cryptocurrency donation integration — 2026-10-08

## Implemented now
- Added an opt-in setting (`accept_crypto_donations`, default false) to the Campaign schema.
- New and saved draft campaigns preserve that setting; existing campaign managers can change it.
- Added a Reown AppKit wallet-connection component for opted-in campaigns and for the **separate IFund platform-support** donation section.
- Installed Reown AppKit with Ethereum/EVM, Solana and Bitcoin wallet adapters.
- Wallet initialization is lazy and requires `VITE_REOWN_PROJECT_ID` from an IFund-owned Reown project. The publicly exposed Project ID must be origin-allowlisted in the Reown dashboard for `interplanetaryfund.com` and the actual Base44 production domain.
- Both donation routes call `getCryptoDonationReadiness`, which currently refuses live checkout by returning `verified_checkout_live: false`.
- No address, QR code, unsigned transaction, or self-reported wallet transaction is treated as proof of received funds.

## Unimplemented and REQUIRED before enabling live donation transfers
1. Select a licensed/approved crypto processing, custody/settlement and compliant payout provider. Reown is the *wallet connection* layer, not this provider.
2. Configure IFund receiving / campaign beneficiary separation with provider-side transaction metadata. Decide whether incoming assets settle to USD immediately, or are held by a licensed custodian pending withdrawals. Never expose or store private keys in frontend code.
3. Add a server-owned quote/intent endpoint with fixed campaign_id or IFund-only beneficiary; quote expiry; exact asset/chain/recipient; optional 10% contribution; processing fee; campaign share; 3% fee at payout only when applicable; and immutable idempotency key. Never trust donated amount, campaign_id, receiver or exchange rate from the browser.
4. Add an authenticated webhook or chain-indexer/confirmation endpoint that validates signed provider events or independently verifies chain transaction network, token contract, receiving address, amount, receipt status, confirmation threshold and non-reuse of tx hash/event index.
5. Post **only verified settled** transactions to the existing canonical financial ledger and Donation mirror, using a USD conversion value and auditable receipt. Wallet connections or user-submitted hashes must never increase totals.
6. Handle reorgs, refunds/reversals, chain mismatch, underpayment, overpayment, expired quotes, duplicate notifications, failed swaps, and assets without available liquidity. Show clear transaction states and donation receipts.
7. Test by donating tiny testnet amounts to two different campaign IDs and to IFund-only; verify funds, attribution, balances, donor counts, fees and one-time crediting through the settlement and withdrawal paths. Complete compliance and partner acceptance review before mainnet activation.

## Current UI behavior
A campaign creator can opt into crypto. Donors can see an accurately labeled cryptocurrency section only if the campaign opted in; platform support has its own section. When a Reown Project ID is configured donors may open a wallet connection dialog, but **no payment transfer can be initiated** through this feature until the separate verified-settlement gateway is developed. The wallet cannot be mistaken for financial authorization or proof of donation.

## Validation
`node scripts/verify-crypto-wallet-option.mjs`, `node scripts/verify-fundraising-mode.mjs`, and Vite production build.
