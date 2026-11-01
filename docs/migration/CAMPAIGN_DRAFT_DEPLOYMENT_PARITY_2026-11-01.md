# Campaign draft preview — source/deployment parity gate (2026-11-01)

**Status: SOURCE STAGED; LIVE PARITY NOT VERIFIED; NO RELEASE AUTHORIZATION.**

## Independent evidence

- Canonical target: Supabase project `ssibsfmtodgximseeqsv`.
- Existing live Edge Function: `ifund-campaign-draft-preview`, ACTIVE version 2, `verify_jwt=true`, observed SHA-256 `b0c7c22b2ee2d70f81961cacd349c17a6acd780fce169d59246fab0ea48e4120` (read-only Supabase function inspection, 2026-11-01).
- The live function still uses a bearer-prefix check inside the handler, `req.json()` without streamed byte enforcement, and does not independently check confirmed email and active account. Gateway JWT verification is useful but is **not** proof of these additional controls.
- The audited replacement is now staged at the **actual invoked slug path** `supabase/functions/ifund-campaign-draft-preview/index.ts`. The prior `supabase/functions/ifund-campaign-draft/index.ts` remains temporarily for migration history; the non-deploying Node contract test requires both staged files to be byte-for-byte identical.
- Source-only behavior: bounded 0–4 deterministic variations, five unique title suggestions, two unique summaries, one fact-grounded story, signature image **prompt only**. No model inference, rendered image, payment, outbound posting, or workflow execution.
- The browser calls the existing deployed slug. A legacy deployment without a variation echo is accepted for the initial preview only; requests for a different set fail visibly without replacing the user's edited story. **This is not evidence that new variations are live.**
- Live database campaign mutation RLS still lacks current Terms acceptance checks. The source correction in `supabase/migrations/pending/20261101_ifund_campaign_terms_rls.sql` is **unapplied** and must not be represented as live protection. Live legal acceptance has column-level authenticated INSERT grants for `owner_id`, `terms_version`, `explicit_consent`; a table-level INSERT check alone is misleading.

## Review and release gates

1. Verify staged exact-head tests (including variation/legacy fallback, hostile payloads, request concurrency, source-path parity) and full migration replay. A passing focused contract suite is not a browser/Android or deployment test.
2. In a controlled environment, independently exercise valid, expired, forged, unconfirmed, inactive and cross-account JWTs; CORS, oversized chunked body, invalid variation, duplicate results and non-destructive retries. Verify the **actual deployed slug, source hash and runtime settings**.
3. Separately verify legal acceptance and direct PostgREST campaign writes with two distinct accounts, rollback-safe transactions, current/stale Terms and denied cross-owner attempts before considering any RLS migration.
4. Review Cloudflare Pages/Worker routing and secrets without changing DNS, payment/provider activation, production SQL or Base44 status.
5. Obtain independent reviewer and owner approval before any production deployment, SQL apply, merge, or Base44 retirement.

Source commits and focused test outcomes must be attached to draft PR #168; do not claim production parity until the live function's observed version/hash and end-to-end behavior are reconciled.
