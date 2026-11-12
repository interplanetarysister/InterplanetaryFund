# IFund PayPal AI Hackathon 2026 — verification ledger

## Independent judge build — November 12, 2026

The independent judge environment is now linked from the canonical frontend's
`/hackathon` companion page:
https://ifund-hackathon-demo.interplanetary-fund.workers.dev/hackathon.
Its separate public source and dated acceptance evidence are maintained at
https://github.com/interplanetarysister/paypal-ai-crowdfunder/blob/main/docs/RELEASE.md.

This is a separate demo deployment with fictional campaigns, separate demo
accounts and isolated sandbox accounting. Its verified captures and AI execution
must **not** be represented as production IFund donations or proof that this
repository's older Pages sandbox flow, production financial views or Base44
runtime have passed the same checks. Existing Pages sandbox configuration and
current production payment settings are preserved. The sections below describe
the earlier Pages sandbox implementation and its verification gaps; they are
historical evidence, not current production payment status or the standalone
demo's acceptance results. The separate source repository's dated release record
is the authority for that demo's verified captures, AI runs and remaining gates.

Canonical frontend source: `apps/web` in this repository; the original Base44
app/source is the read-only visual and workflow reference. The standalone demo
has its own public source, deployment and isolated sandbox financial records.

**Official rules:** https://paypalaihackathon.devpost.com/rules
**Submission deadline:** November 12, 2026, 12:00 PM Pacific.
**Earlier Pages sandbox implementation:** `InterplanetaryFund` Cloudflare Pages/Workers + Supabase. **No Base44 runtime fallback.**

## What actually exists

- An existing live *hosted PayPal platform-support button* is separate from campaign donations and **does not prove the PayPal sandbox REST integration**.
- The independent app has a real Supabase-backed Story writing assistant and a seven-agent identity selector; seven full independent conversational agents are not yet verified.
- `/hackathon` is the demo journey. `/api/paypal/sandbox/status`, `/orders`, `/capture`, and `/webhook` are additive Cloudflare Pages Functions.
- Orders use `api-m.sandbox.paypal.com/v2/checkout/orders`; capture receipts must be confirmed by PayPal and saved before success is shown. The webhook listener uses PayPal's `verify-webhook-signature` API. Repeated webhook IDs are idempotent.
- Demo receipts reside ONLY in `ifund_paypal_sandbox_orders` and `ifund_paypal_sandbox_events`, with RLS and service-role-only access. They are **never** real `ifund_donations`, financial ledgers, withdrawals, or public donation totals.
- Code has fail-closed tests; **no end-to-end sandbox capture or signed webhook has been verified yet**. The feature must stay off until setup and tests are complete.

## Deploy and verification (only in an authorized preview)

1. On the **existing** Cloudflare Pages project `interplanetaryfund-migration` preview environment, set `IFUND_PAYPAL_SANDBOX_ENABLED=enabled` (after other keys are ready) and configure `PAYPAL_CLIENT_ID` plus matching `PAYPAL_CLIENT_SECRET` from the **same sandbox REST app**. Use encrypted secret bindings. Do not create a second PayPal app merely because a client ID is missing from this Pages environment.
2. Keep the existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in secure server-only bindings. The browser only receives public configuration/status; never expose the secret in Vite variables or Git.
3. Apply the additive migration `supabase/migrations/20261109_ifund_paypal_hackathon_sandbox_isolation.sql` to the current Supabase project after review. Confirm the RLS policies deny anonymous and ordinary authenticated clients.
4. In the *sandbox* PayPal REST app, subscribe the actual HTTPS preview URL `https://<preview-host>/api/paypal/sandbox/webhook`, record its **assigned webhook ID** as encrypted `PAYPAL_WEBHOOK_ID` (not as a webhook secret), and subscribe the appropriate Orders/Capture/Refund/Dispute events. Live webhook subscriptions do not configure the sandbox application. Never invent webhook IDs.
5. Open `/hackathon` on that exact preview host. An active owned/public demo campaign must exist; do not invent real fundraiser facts. Select a sandbox amount, approve with a provider-controlled sandbox buyer, return, and click verify/capture. Confirm exactly one isolated captured receipt, a corresponding verified PayPal order, and no change to real campaign totals.
6. Verify duplicate capture requests do not create second captures; unsigned/tampered webhooks are rejected; verified duplicate events are deduplicated; provider errors display no false success; unauthenticated browsers cannot read sandbox order/event tables directly.
7. Keep all live campaign donations and owner withdrawals disabled until separately verified and approved. The 7% platform fee is due at **real withdrawal**, not per sandbox checkout.

## Submission must be verifiably complete

- [ ] Working PayPal sandbox checkout, authorization, capture and verified webhook with screenshots/log receipts
- [ ] Live working AI assisted campaign drafting demonstrated, distinct from placeholders
- [x] Public repository and AGPL-3.0 license recognized by GitHub REST repository metadata on 2026-11-10 (`private=false`, `visibility=public`, `license.spdx_id=AGPL-3.0`); repository root `LICENSE` previously documented. Evidence: https://api.github.com/repos/interplanetarysister/InterplanetaryFund
- [ ] Reproducible setup/build instructions and safe judge test login, with no secrets committed
- [ ] Hosted functional demo with working sandbox test account OR exact local build instructions
- [ ] Public YouTube demonstration <3 minutes showing the actual product (no static-only demo)
- [ ] English text description of functionality, PayPal and AI and significant post-Oct 1 updates
- [ ] Confirm actual Devpost registration/submission before Nov 12 noon Pacific
- [ ] If AWS is represented, show the actual integration; AWS is not required by the official rules

**Security:** A PayPal client ID is publicly identifiable; the matching client secret and webhook validation are essential. Never publish sandbox buyer passwords, PayPal secrets, credentials or service keys in README, public repository, screenshots, logs, or demo submissions. Give judge access via a test environment with controlled credentials transmitted securely.

**Architecture:** Existing Base44 app publishes at `interplanetaryfund.base44.app`; Cloudflare/Supabase owns `interplanetaryfund.com`. No Base44 dependency or domain reintroduction is permitted.

## Cloudflare authenticated deployment provenance — 2026-11-10 06:29 Pacific

Cloudflare Pages project `interplanetaryfund-migration` is connected to `interplanetarysister/InterplanetaryFund`, with configured `root_dir=apps/web`, `build_command=npm ci --no-audit --no-fund && npm test && npm run build`, and `destination_dir=dist`. `production_deployments_enabled=false` at inspection time. The most recent inspected **preview** deployment was `16cfa7ed-4151-4d22-9cc5-6f0a4ed76161` (`https://16cfa7ed.interplanetaryfund-migration.pages.dev`), commit `0a9b0e1fd5287616dcc6a1e308ed9a33efc8f585` on the sandbox-compliance branch, Cloudflare stage `deploy/success` ending 2026-11-10 14:02:40 UTC. This verifies deployment metadata **only**; it does not verify public DNS reachability, `/hackathon` rendering, Pages Functions, PayPal capture/webhooks, or live AI generation. Those gates remain unchecked until direct functional evidence exists.

## Supabase authenticated table inspection — 2026-11-10 09:33 Pacific

Connected Supabase project `ssibsfmtodgximseeqsv` reports `public.ifund_paypal_sandbox_orders` and `public.ifund_paypal_sandbox_events` **both present with RLS enabled and 0 rows each**. `public.ifund_donations` likewise has 0 rows. This verifies the isolated sandbox table structures exist in the target project; it does **not** verify the exact migration history, individual RLS policies, PayPal provider calls, webhook signature validation, or an end-to-end capture. No successful sandbox receipt is recorded in these tables at inspection time. Keep payment compliance unchecked pending genuine provider-backed evidence. The campaign table contains 4 rows, but no campaign was verified as an authorized, accurately labeled showcase campaign. No publication or payment action was taken during this inspection.

## Supabase authorization catalog check — 2026-11-10 12:19 Pacific

Authenticated, read-only inspection of project `ssibsfmtodgximseeqsv` confirms that `public.ifund_paypal_sandbox_orders` and `public.ifund_paypal_sandbox_events` both have RLS enabled. `pg_policies` returned **zero policies** for either table, and PostgreSQL privilege checks returned **false** for `anon` and `authenticated` roles for both SELECT and INSERT on each table. Both tables still contain **zero rows**; the campaign table contains **four rows**. This is positive catalog-level evidence of deny-by-default isolation for ordinary API roles, **not** a substitute for an actual anonymous/authenticated API negative test or service-role receipt verification. PayPal provider capture and webhook signature validation remain unverified; do not check off payment compliance.

## Cloudflare sandbox credential binding acceptance — 2026-11-10 Pacific

Authenticated operational evidence from Cloudflare + live HTTPS probes through Supabase `pg_net`:

- Pages preview project `interplanetaryfund-migration` has `IFUND_PAYPAL_SANDBOX_ENABLED=enabled`, `PAYPAL_WEBHOOK_ID=51B35522F66392518`, `SUPABASE_URL=https://ssibsfmtodgximseeqsv.supabase.co`, and a service binding `IFUND_SANDBOX_BROKER` to `ifund-sandbox-broker` (production Worker environment). The separate production payment Worker remains `IFUND_PAYMENTS_ENABLED=false`.
- Dedicated Cloudflare Worker `ifund-sandbox-broker` securely binds `PAYPAL_CLIENT_ID` to account Secrets Store `Paypal_sandbox_app_id`, `PAYPAL_CLIENT_SECRET` to `paypal_sandbox_app_secret`, and `IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK` to the existing corresponding store secret. The other stored pair, `paypal_sandbox_client_id` and `paypal_sandbox_client_secret`, successfully authenticated but **did not own webhook** `51B35522F66392518`; do not revert these bindings without another identity audit.
- Pages Function obtains short-lived sandbox OAuth through the broker service binding, not a Pages-visible client secret. Sandbox records route through signed `ifund-sandbox-receipts` Supabase Edge Function and only `ifund_paypal_sandbox_orders` and `ifund_paypal_sandbox_events`. The Edge Function requires the existing ECDSA-signed timestamp/body and refuses unsigned requests. It obtains its own Supabase server credentials internally, not via Cloudflare Pages.
- Verified actual HTTPS diagnostics on stable alias `https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/diagnostics` returned `configured=true`, `oauth_ready=true`, `database_ready=true`, `webhook_registration_ready=true`, `webhook_origin_matches=false`, and `live_payments_enabled=false` after selecting the correct app pair. This confirms both credential-binding and storage access, but does **not** prove payment capture.
- Actual unsigned webhook HTTP POST to `/api/paypal/sandbox/webhook` returned HTTP 400 with `Missing webhook signature headers`. This is one negative HTTP acceptance test, not signed webhook verification.
- Callback mismatch is due to PayPal's sandbox webhook ID being registered to the immutable `f69605aa` deployment hostname, while the active stable branch alias differs. Rotate only this known sandbox webhook URL to the stable preview alias, then recheck `status.enabled`, real provider capture, signed webhook, and receipt reconciliation before hackathon acceptance.
- Github CI's dedicated `ifund-sandbox-runtime-smoke` workflow run `42958976568` failed before any runner steps were recorded (no runner allocated); that run is **not** evidence of failed application logic. Cloudflare preview builds and direct `pg_net` HTTP responses are separate evidence channels.

**No secret values, OAuth tokens, buyer passwords or service credentials belong in this repository, documentation, issue comments or screenshots.**


## 2026-11-11 follow-up audit — direct connected-provider reads

**This supersedes older zero-order observations above; those remain historical snapshots.** Authenticated read-only SQL against canonical Supabase project `ssibsfmtodgximseeqsv` returned: `ifund_paypal_sandbox_orders` **4 rows**, all `status=created` and all containing PayPal order identifiers; `ifund_paypal_sandbox_events` **0 rows**; and `ifund_donations` **0 rows**. None of the four records is marked captured. These are not evidence of buyer approval, capture, provider-confirmed payment, or signed webhook delivery. Do not advertise completed PayPal sandbox end-to-end acceptance.

Cloudflare Pages deployment metadata (read via authenticated Cloudflare API) showed a successful **production** deployment `029a5a88-fd5f-402c-89d3-eab8237e12ce` from commit `b111cd4474fd50ad4f107ca07f00f47d46a7bc5f` and successful **preview** deployment `0d009d8a-b3ef-4172-9f07-39119bf08949` from commit `859d51cb39f9121a8497f7fae8f38e143e418b6b`. A newer production deployment `2537aad1-2c16-4fd7-ab50-2a591fe06f47` from `aff45a241ccfa404a5e44215b15ed719c4a53cd3` was **queued/idle at inspection**, not completed. Deployment metadata does not establish that the demo or Functions are accessible.

Repository change `470231e7d1d2d64ee0912a11b6e025533b72c0d3` tightens `scripts/hackathon-preview-smoke.mjs` so that an unrelated HTTP-200 JSON response, or a disabled sandbox status, cannot pass the readiness smoke check. Success from this check remains **configuration readiness only**, never proof of actual PayPal capture or webhook receipt.

The public Devpost project `https://devpost.com/software/interplanetary-fund-agkwlv` currently surfaces a different event in its public submission history; no directly verified PayPal AI Hackathon entry receipt or publicly viewable submission page was established by this audit. Do not claim the PayPal hackathon entry is officially submitted without a Devpost confirmation. The mandatory public YouTube video and evidence of real AI inference also remain unverified.

**Required acceptance:** approved sandbox buyer → PayPal Orders v2 completed capture → exactly one isolated captured order row → validated signed capture webhook event (idempotent) → no increment to live `ifund_donations`/campaign totals → real AI generation on judge-accessible build → publicly viewable under-3-minute video → verified PayPal Devpost submission. No real-money test is required to satisfy the hackathon sandbox requirement.
