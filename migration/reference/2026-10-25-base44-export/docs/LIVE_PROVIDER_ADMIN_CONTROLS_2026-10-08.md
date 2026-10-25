# IFund — live-provider controls and provider connection record (2026-10-08)

## Implementation completed in code
- Admin > Platform Foundation opens **Live providers** first; includes server-reported provider status, admin feature switches and a collapsible diagnostic list of provider registry connections.
- Server function `getLiveProviderStatus` requires an active authenticated admin and returns only read-only, sanitized readiness facts. It never returns API tokens, crypto wallet secrets, merchant access credentials, or private personal data.
- Shared `liveProviderReadiness` verifies PayPal live REST authorization and PayPal payout ability separately; checks Stripe live account, enabled webhook events and callback ownership; supports verification of PayPal subscription plans against current provider prices and billing webhook.
- The provider checks distinguish crypto wallets (Reown), approved payment checkout (Stripe stablecoin), and a **potential** broader provider (NOWPayments). A configured API key alone is not provider approval or successful money movement.
- `manageFeatureFlag` now enforces server-side readiness before **enabling** an external feature. **Disabling** a new feature remains allowed, and already-started payment reconciliation and account records must continue.
- Each runtime-wired feature can have an admin switch; missing switches can be initialized individually **off**. Unimplemented routes remain locked and cannot be made live by creating an arbitrary flag.
- Provider verification is checked again when the admin enables a feature. A stale frontend indicator cannot bypass the server gate.
- A default no-credentials test verifies the critical fail-closed properties, stale evidence handling, role restrictions and switch behavior.

## Connected Base44 catalog snapshot (verified in the authorized account)
- Connector linked: Facebook Pages (Interplanetary Fund Page), LinkedIn, Discord, Slack bot, Wix, GitHub.
- Connector not yet linked: Instagram Business and TikTok.
- The Base44 connector catalog does **not** include native Reown, Coinbase Business or NOWPayments integrations; these require separate authorized provider registration and API integration.
- OAuth connector status is not sufficient proof that publishing, donations, financial settlement or AI actions function end to end.

## Remaining outside-account dependencies
- A Reown AppKit project owned by IFund, with production domains on its origin allowlist, and the Vite-side Project ID configuration.
- Stripe Stablecoin and Crypto merchant approval for the IFund account (USD settlement); provider methods and signed webhooks must be verified end to end.
- If support for hundreds of coins is required rather than Stripe's supported stablecoins, provider eligibility and pooled third-party campaign fund administration must be approved. NOWPayments is a **candidate**, not connected. BitPay's donation tooling is limited to qualifying nonprofits and is not an automatic fit for IFund's individual fundraisers.
- Any provider registration/KYC, external account owner acceptance, business bank linking, settlement-wallet confirmation, and OAuth consent must be performed or explicitly approved in the external provider's supported flow.
- Signed paid invoice receipts, settled receipt classification, idempotent canonical accounting, proper campaign attribution and appropriate payout compliance must be proven before transfers or campaign crediting go live.
- Do not create fabricated live connections, unsupported direct deposit addresses, or use browser-side private keys.

## Local verification
`node scripts/test-live-provider-controls.mjs`
`node scripts/verify-crypto-wallet-option.mjs`
`node scripts/verify-fundraising-mode.mjs`
`node scripts/verify-donor-total-contract.mjs`
`node node_modules/vite/bin/vite.js build`
