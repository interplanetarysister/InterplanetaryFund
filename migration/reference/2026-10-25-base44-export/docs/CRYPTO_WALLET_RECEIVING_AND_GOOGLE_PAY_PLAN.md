# IFund — cryptocurrency donation receiving plan
Reviewed 2026-10-16. Status: research and safe preparation only; **not enabled for live crypto donations**.

## Separate Google Pay from Google-managed logins
- Google Pay/Google Wallet API returns card-payment tokens. It does not issue a cryptocurrency receiving address for campaign owners. Source: https://developers.google.com/pay/api/web/overview
- Google sign-in can potentially be an authentication option for compatible embedded crypto wallets, but it is not a Google-operated crypto wallet, nor does it establish blockchain custody or payment verification.
- The existing IFund Google Pay button is a fiat payment rail via the PayPal integration, not crypto.
- Avoid describing any new integration as a Google crypto wallet or Google/PayPal partnership unless a provider independently verifies that statement.

## Existing IFund implementation
- `src/lib/reownWallet.js`: wallet-connect modal configuration, not money receipt.
- `src/components/payments/CryptoDonateOption.jsx`: explicit Coming soon; connecting transfers no money.
- `src/components/campaigns/CryptoCampaignSettings.jsx`: persists owner opt-in only.
- `src/pages/CreateCampaign.jsx`: saves `accept_crypto_donations`; never implies verification is complete.
- Canonical campaign donation accounting is Base44 backend-owned. Never use UI-only, user-reported, or unconfirmed on-chain activity to increment totals.

## Option A — PayPal Pay with Crypto; settle merchant in fiat
1. Check the actual PayPal Business account's merchant eligibility, geographic availability, API documentation/permissions, and whether this product/fundraiser category is allowed.
2. If approved, integrate the merchant's provider-supported crypto checkout path, using provider-created payment/order IDs rather than constructing payment addresses.
3. Verify settlement/capture with PayPal server-to-server, using signature-checked webhook or verified API query, idempotency and duplicate protection.
4. Attribute donation to exactly one campaign and ledger entry; correctly disclose conversion/processing fees and the gift-first campaign crediting rule.
5. Handle declines, expiration, invalid callbacks, network mismatches, reversals, refunds, provider downtime, and unsupported currencies; display truthful availability.
6. Test provider sandbox (if provided), small authorized real payment and reconciliation before enabling. PayPal fiat settlement **does not** provide recipient ownership of on-chain coins.
Reference: https://www.paypal.com/us/business/accept-payments/crypto

## Option B — actual crypto received into a campaign owner's wallet
1. Select a supported network and asset pair from a small explicitly verified allowlist; never treat chain names, token tickers, or copied addresses as interchangeable.
2. Owner connects wallet using existing wallet-neutral Reown flow **and proves ownership** by an EIP-4361/SIWE-style domain-bound, nonce-bound, expiry-bound signature where applicable. Receiving address is not an IFund-managed private key.
3. Persist a verified address separately for each owner, chain and asset, with change history. Re-verify on account or wallet switch. Never collect seed phrases or wallet private keys.
4. Show the donor the exact chain, token contract, address, and whether it is owner-custodied; provide explicit unsupported-network warnings and a verified payment request.
5. Observe the on-chain transaction through a verifiable indexed/RPC receipt, chain ID, token-contract event and transaction hash (not a screenshot). Handle finality thresholds and blockchain reorganization/replacement.
6. Deduplicate on a stable network + transaction hash + log-index/payment intent key. Associate each payment with the campaign using a safely verifiable intent, dedicated address, or supported contract attribution mechanism; **do not credit by matching the owner's shared address alone**.
7. Validate donations are final before campaign totals rise, and keep gross gift, gas/processing, optional 10% support, and later withdrawal fees separate. Test network outages and rollback/reconciliation.
8. Owners control their own direct wallets, so IFund cannot unilaterally charge its 3% withdrawal fee on direct self-custodied transfers. A distinct transparent contractual/payment approach must be designed before that product path goes live.
9. Assess money transmission, custody, AML/sanctions, crowdfunding/payment-platform terms, tax receipts and consumer protection obligations, including state-specific rules, with qualified counsel before receiving or holding third-party crypto.
10. Do not release the receiving switch until signing, watcher, attribution, RLS, compliance and end-to-end EVM/Solana-specific tests pass. Keep unverified tokens and chains off.

## Wallet adapter/licensing research
- Existing Reown components already support connecting multiple external wallets. Reuse code with an explicit supported-chain allowlist rather than assuming Google Wallet is a blockchain wallet.
- WalletConnect monorepo: https://github.com/WalletConnect/walletconnect-monorepo — **WalletConnect Community License**, not an ordinary blanket MIT grant; review the exact package license, trademarks and hosted gateway requirements before upgrading or distributing. https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/providers/ethereum-provider/LICENSE.md
- Google's card API: https://developers.google.com/pay/api/web/overview — separate from blockchain wallets.
- Do not embed or copy someone else's wallet UI/source without license/security review.

## Release criteria and rollback
A real payment is never recorded on wallet-connect or OAuth success alone. Enable with a per-provider, per-chain, server-verified capability switch only after test donations, user-visible payment confirmation, idempotent ledger reconciliation, network safety and customer support help updates. In case of error disable new checkout requests, keep transaction verification/reconciliation intact and preserve previous ledger entries.
