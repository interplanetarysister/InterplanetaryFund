# Saved payment methods — implementation note (2026-11-27)

Status: **built and tested in source on `feature/saved-payment-methods`; NOT deployed.**
No migration has been applied, no Worker or Edge Function has been deployed, and no
production build has run. Live acceptance (signed-in member adds a real card in the
real UI) remains **BLOCKED / UNVERIFIED** until the deploy steps below are executed
under a separate release authorization.

## What was built

Members can save a card to their account and manage it from the existing
**Plans & subscriptions** page (`/subscriptions`, Plans tab → "Saved payment
methods" section — no new page). The section lists saved cards
(brand •••• last4, expiry, cardholder name, Default badge) and supports
Add card, Remove, and Set default, with signed-out, empty, loading, and
error/retry states. Adding a card renders PayPal-hosted card fields
(Name / Number / Expiry / CVV) in a dedicated PayPal JS SDK namespace
(`ifundVaultPayPal`, `components=card-fields`), reusing the loader pattern
from the Premium one-time checkout.

## Token-only storage rule (non-negotiable)

A raw card number (PAN) or CVV **never** enters iFund's frontend, Worker,
Edge Function, database, or logs:

- Card details are typed only into PayPal-hosted fields (PCI-scoped iframes).
- The browser receives only a one-time **setup token id** and, after approval,
  sends that id back — never card data.
- The Worker exchanges the setup token with PayPal server-to-server; only the
  resulting **payment token id**, optional PayPal customer id, brand, last4,
  expiry month/year, and cardholder name are stored
  (`public.ifund_saved_payment_methods`). The table has no column capable of
  holding a full card number or CVV, enforces `last4 ~ '^[0-9]{4}$'`, a unique
  `paypal_payment_token_id`, and at most one default per member (partial
  unique index). RLS is enabled with owner-scoped policies
  (`auth.uid() = user_id`); authoritative writes go through the signed
  `ifund-payment-ledger` broker with the service role.
- Member-facing API responses contain **descriptors only**. The payment token
  id never leaves the server (it crosses only the signed Worker→ledger
  channel, and from the ledger back to the Worker solely so the Worker can
  ask PayPal to delete the token on removal).

## PayPal Vault v3 endpoints used

- `POST /v3/vault/setup-tokens` — Worker creates a setup token
  (`payment_source.card`) after verifying the member session.
- `POST /v3/vault/payment-tokens` — Worker exchanges
  `{payment_source:{token:{id:<setup_token>, type:"SETUP_TOKEN"}}}` for the
  reusable payment token and card descriptors.
- `DELETE /v3/vault/payment-tokens/{id}` — best-effort provider cleanup on
  removal. **Order decision:** the ledger marks the method `removed` FIRST
  (authoritative — iFund can never reference the token again), then the
  Worker attempts the PayPal delete; a provider failure leaves an orphaned
  PayPal token that nothing in iFund can reach or charge.

## Worker routes (same gates/CORS/error style as neighboring routes)

- `POST /api/payments/saved-methods/setup-token`
- `POST /api/payments/saved-methods/exchange`
- `GET  /api/payments/saved-methods`
- `POST /api/payments/saved-methods/delete`
- `POST /api/payments/saved-methods/default`

All require `IFUND_PAYMENTS_ENABLED=true` and `IFUND_PAYPAL_MODE=live`;
POSTs additionally require an allow-listed Origin. Identity mirrors the
existing authenticated flows exactly: the Worker takes the Supabase Bearer
access token (`memberToken(req)`), forwards it as `member_access_token` in
the signed ledger call, and the ledger resolves it with
`resolveVerifiedDonor()` (Supabase Auth `/auth/v1/user`; non-anonymous,
email-confirmed). Ledger ops: `saved_method_record`, `saved_method_list`,
`saved_method_delete`, `saved_method_set_default` — each validates the
caller owns the method; the first saved card becomes the default, and
removing the default promotes the newest remaining card.

## What is NOT yet wired

- **Charging a saved token is not implemented.** Donation checkout and the
  Premium one-time checkout still create fresh Orders v2 checkouts exactly as
  before; no route charges a vaulted payment token yet. Wiring "pay with a
  saved card" (Orders v2 with `payment_source.card.vault_id` / stored
  credential) is the follow-on step and must reuse the same verified-ledger
  receipt contract before any money moves.
- The recurring Basic subscription flow is unchanged (PayPal billing
  agreements are a separate mechanism from Vault card tokens).

## Blockers / owner actions for live use

- **PayPal account entitlement:** Vault v3 ("Save payment methods") must be
  enabled on the live PayPal merchant account by PayPal; if it is not, the
  setup-token call fails closed (`paypal_vault_unavailable`). Only the
  account owner can confirm/enable this with PayPal.
- Card Fields eligibility is decided by PayPal per merchant/browser; the UI
  fails closed with an explanatory message when fields are not eligible.

## Deploy steps that remain (NOT executed)

1. Apply the additive migration
   `supabase/migrations/20261127190000_ifund_saved_payment_methods.sql`
   to the production Supabase project (source-only until then).
2. Deploy the updated Edge Function `supabase/functions/ifund-payment-ledger`.
3. Deploy the updated `workers/ifund-payments` Worker.
4. Build and release the updated `apps/web` frontend through the normal
   controlled release workflow.
5. After deployment, run role-based live acceptance: a signed-in member adds
   a card in the real UI, sees descriptors only, sets default, removes it,
   and confirms a second member cannot see or affect the first member's
   methods.

## Tests

- Worker: `workers/ifund-payments/saved-methods.test.mjs` — 11 tests
  (route gating, origin rejection, auth requirement, setup-token member
  verification, exchange→record mapping, descriptor-only responses,
  unverifiable vault response records nothing, delete ordering incl.
  PayPal token deletion, set-default, malformed references).
- Web: `apps/web/tests/saved-payment-methods.test.mjs` — 7 tests
  (descriptor validation/formatting/sorting, hosted-fields + setup-token
  source contract, page consolidation, worker/ledger contract, migration
  token-only contract).
