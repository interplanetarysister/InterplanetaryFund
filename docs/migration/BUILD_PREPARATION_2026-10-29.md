# Interplanetary Fund — build-preparation implementation ledger (2026-10-29)

Authority: [owner issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).
Target branch: `migration/build-completeness-gates-20261029`.
**NO BUILD, DEPLOYMENT, PAYMENT ACTIVATION, DNS CHANGE, CRON ENABLEMENT OR PRODUCTION SQL WRITE PERFORMED.**

## Grounded, recorded structural coverage

| Original contract | Source definitions | New machine-readable mapping | Verification |
| --- | ---: | --- | --- |
| Historical web/app routes | 59 | `docs/migration/role-platform-evidence.json` + `apps/web/src/lib/historicalRoutes.js` | All 59 URL definitions registered; 23 partial screens, 36 explicit not-yet-ported screens; 0 route-level parity approvals |
| Entity schemas | 95 | `docs/migration/contracts/entities.json` | **95/95** source-named tables located in canonical private schemas; **95/95** table RLS flags enabled; **1,126/1,126** original field names matched. Column types/defaults, authorization-policy semantics, migrated records and runtime access are NOT verified |
| Backend functions | 184 | `docs/migration/contracts/functions.json` | 184/184 source entrypoints enumerated; **236** direct frontend call sites located across inventory; **123** distinct function names directly referenced in the scanned frontend. Indirect/agent/provider callers remain to be verified |
| Agents | 10 | `docs/migration/contracts/automations.json`, `worker/automationRegistry.js` | Source IDs registered; no executor, tooling or provider permission established |
| Workflows/triggers | 17 | Same contracts and Worker registry | 11 schedule definitions and six entity-event definitions mapped. All referenced source handlers exist in function inventory. None are verified live or enabled |
| Connectors | 11 | Same contracts | Original names retained; grants, consent, credentials and revocation are not verified |

### Implemented preparatory source changes

- Replaced indiscriminate wildcard/ComingSoon routing with exact original-path registry and member/admin UI guards. A visible reserved URL is **not** counted as a restored page.
- Recovered a standalone active-campaign embed, reading only RLS-visible canonical public campaigns; unknown funding totals are never represented as zero and embedded payments never execute.
- Restored the original browser-managed app install page; no fabricated Android APK is shown.
- Mounted original ten-agent identity catalog and read-only status API. Execution remains disabled.
- Corrected independent campaign draft editor to save incomplete drafts, use source-aligned field limits, and offer all 11 original campaign categories; corrected independent Worker category validation and added synthetic tests.
- Added fail-closed release/inventory check `scripts/verify-migration-readiness.mjs` and `apps/web` prebuild gating. Production `main` Cloudflare builds cannot pass until all required evidence entries are verified. Local/dev build may be run for testing after authorization without implying release eligibility.
- Added source/contract regression tests; **those tests and the next Vite/Android builds have not yet been executed on this branch**.

### Release blockers still present

1. 36 named pages remain explicit nonfunctional reservations; 23 others are partial, not full source/visual parity. All 59 require desktop/tablet/mobile, light/dark, role and Android evidence.
2. Each of the 184 backend handlers needs a verified replacement or a recorded owner retirement. 10 agents, 17 triggers and 11 connectors need trusted independent execution, consent, idempotency, budget and audit tests.
3. Canonical `public.ifund_campaigns` was observed empty. Historical source vs staged campaign count and owner identity associations are unresolved; no old gift ledger or campaign record was silently changed.
4. Canonical private 95-table staging is not the complete public/API runtime. SQL types, foreign keys, policies, permissions and live data migration must be independently reconciled.
5. PayPal client/configuration, webhook signature + idempotent durable receipt, captured settlement, donation attribution, fee-on-withdrawal and payout workflows require provider sandbox and real persistence proof before activation. Preserve original ledger accounting.
6. Cloudflare production browser URL is canonical Supabase; server/JWKS configuration remains on legacy Supabase, and 16 domain Worker routes still point to old `interplanetary-fund2`. No cutover is safe on those mixed bindings.
7. The original Android Gradle/Capacitor project exists only in read-only source. Its historical application identifier still references its original provider; an independent, signed, verified Android build with matching app identity, manifest and deep links has not been produced.
8. `apps/web` lacks a committed app-specific npm lockfile. The original off-Base44 staged HTTP/PayPal boundary archive named in the uploaded readiness checkpoint was not available as bytes in this workspace, and its code has not been merged into runtime.
9. Production launch remains blocked by the 19 explicit product/security/provider/app/UX gates in `docs/migration/contracts/launch-evidence.json`. No build result should be represented as a zero-bug assurance.

### Non-deploy checks configured for next authorized local verification

```sh
cd apps/web
npm test
npm run check:inventory
npm run check:release
npm run build
```

`check:inventory` verifies the source census and direct route/trigger contract alignment; `check:release` **must fail** until complete runtime proof is recorded. Production Pages `prebuild` additionally checks release evidence when `CF_PAGES_BRANCH=main` or `IFUND_RELEASE_MODE=production`.

No production services were changed. Rollback is to discard the preparation branch. Do not activate runtime jobs, move existing DNS/Worker routes, apply financial schema updates, or claim Android/browser parity from these source-only contracts.
