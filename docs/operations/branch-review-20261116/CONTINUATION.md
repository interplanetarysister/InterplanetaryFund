# Remaining branch source integration — November 16, 2026

All 161 branches ahead of the original review baseline have been reconciled, plus the subsequently discovered `fix/live-route-chunk-recovery-20261115` branch. The latest reviewed route-completion head is recorded in `branches.json`. Every recorded head is an ancestor of this candidate. This includes deliberate retirement of incompatible historical implementations after porting useful behavior; ancestry alone is not evidence of feature implementation or production acceptance.

The original 149-head integration was merged through PR #290. This continuation implements the capabilities identified as missing in that review:

- One canonical four-stage campaign wizard with private saved setup, writing preferences, story snapshots, explicit guest transfer and permanently invalidated owner scopes. Campaign and setup saves retain actual receipts on partial failure. New cover uploads use R2, opaque public keys, byte digests/readback, confirmed active owners and existing atomic per-owner/global quotas. Existing public cover URLs remain readable; the Image Studio compatibility API now uses the same R2 uploader.
- Public `/shorts` with moderated public projections, strict YouTube/Vimeo URLs, explicit click-to-load players, swipe/keyboard/button navigation, feed failure states and stale-result isolation. Arbitrary direct media hosts remain disabled by default.
- Owner-authorized Strategy, Growth, Communications and Managed Connections contracts and saved-service panels, permanent allowlisted gateway addresses, current saved AI permission checks, bounded revision-aware bulk decisions, exact message review and stable uncertain-write retries. The service catalog advertises only accepted Story conversational service; supervised tools do not imply a new conversational or external provider integration.
- A CLI-created additive migration updates the four specialist member checks to current terms, verified nonanonymous active owners and explicit outreach opt-in. Communications refuses delivery against missing/old consent-contract versions. The original 55 hosted specialist function bodies were reconciled against source before this additive change. The new migration remains unapplied.
- A replacement transactional subscription RPC couples immutable economic receipt identity, owner/currency/environment/merchant identity, event journaling, parent-sale refund ceilings and monotonic entitlement/provider clocks. Historical incomplete provenance is rejected rather than guessed. Worker, Edge and database controls must independently permit execution; source defaults remain off. Old non-atomic accounting paths are retired. This migration also remains unapplied.
- Canonical city lookup uses confirmed owners, the existing service-only atomic rate limiter, a fixed city provider, coarse coordinates and explicit map consent. Necessary original fonts, licenses and verified bundled assets were preserved with a path-by-path disposition inventory. Stale deployment/bootstrap and paid legacy tooling were retired.
- Unsafe live-charge redirect experimentation was retired in favor of canonical provider-controlled checkout. Concurrent route fixes were retained for private document default-off availability, bounded orphan recovery, account-wide document-reference revocation, credential minimization, stale admin errors and explicit lazy-chunk reload. Provider-unknown payouts never submit another provider POST without independent reconciliation. The manual release preflight remains first.

## Verification performed

| Check | Result |
| --- | --- |
| Full root/security suite, including actual PGlite SQL/RLS | 887 passed, 0 failed |
| Full canonical web suite, 162 files | 837 passed, 0 failed |
| Subsequent concurrent credential-context repair and affected suites | 58 passed, 0 failed |
| Root and canonical web production builds | Passed locally |
| Cloudflare Pages Functions bundle, Wrangler 4.162.0 | Compiled successfully; no publication |
| Locked dependency production audits: root, web, mobile | Zero reported vulnerabilities |
| Actual compiled web artifact, 87 routes at two viewports | 174 checks, zero page errors or horizontal overflow |
| Four-stage guest wizard interaction/reload tests | Passed at 1440×1000 and 390×844; zero campaign database writes |
| Shorts interaction fixtures | Desktop/mobile player consent, keyboard/swipe navigation, teardown, refresh and error states passed; provider frames synthetic |
| Git whitespace check and branch ancestry reconciliation | Passed |

The final artifact index SHA-256 and compact route evidence are in `continuation-browser.json`. Browser route smoke is anonymous and local; it does not establish signed-in, hosted Pages Functions, provider, native-device or production acceptance. SQL tests run against synthetic PGlite fixtures and do not apply production DDL. The original historical phase report remains below in README; the continuation supersedes its twelve-unmerged-head and missing-cover-port statements.

## Remaining release blockers

The main source release gate still fails with **116 findings**. It was not weakened to make this integration pass. Production is **not certified**, and no preview, production, Worker, Edge, SQL, R2 or payment activation was performed by this continuation.

Read-only hosted checks confirmed that the private document relation, atomic subscription RPC and new communications consent-contract RPC remain absent. The document adapter still uses legacy Supabase Storage and conflicts with the canonical private R2 requirement; it remains disabled by default. Do not enable it or blindly apply pending migrations. Specialist service bindings, AI/provider permissions and independent runtime acceptance remain prerequisites. New cover uploads need approved R2/runtime bindings and live two-owner acceptance. Original branch claims do not satisfy any of these requirements.

The 18 hosted email-content policies inspected are **RESTRICTIVE**, correctly combined with owner policies. They are not an OR-based ownership bypass. No live policies were changed.

GitHub check annotation for job `133259997614` states: “The job was not started because your account is locked due to a billing issue.” It executed zero steps. Local checks do not resolve hosted CI billing. No paid upgrade, protected-check bypass or account change was attempted.

Immediately before publication, Cloudflare read-only inspection showed all Git deployment triggers still disabled: `deployments_enabled=false`, `production_deployments_enabled=false`, `preview_deployment_setting=none`. Another actor's production deployment was observed at `b19cc047-2d5c-4417-b232-d98eea76e79f`, revision `2de351258f7bf6d1e5a373e6153f749dd8de1bba`; it was not deployed or certified by this work. No actual charges, payouts, messages, OAuth grants, DNS/mail changes, destructive data operations or paid services were executed.
