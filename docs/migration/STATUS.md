# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

## Current Phase 6 update — October 25, 2026

**Private cached-data transfer completed; full migration remains incomplete.**
741 newly copied cached records plus 27 previously staged campaigns now give
**768/768 exact destination payload SHA-256 matches**. Nine campaign serialization
differences were repaired under semantic-equality and source-digest guards.
No users were claimed, no public rows published, and no financial authority set.
See [the transfer report](CACHED_SNAPSHOT_TRANSFER_20261025.md) for counts,
provenance, repeatable tooling, and remaining runtime gates.
Local install, **77 tests**, and Vite build passed. A rollback-only RLS probe was
prepared but its tool execution failed with expired request state; it is not
runtime test evidence. All temporary-fixture counts remained zero on recheck.
Earlier sections below are historical evidence; the transfer report supersedes
their statements that destination content/source snapshot tables are empty and
that the Pages frontend still points at the old project.

- [ ] Phase 1 — clean scaffold, decision, complete inventory: **in progress**. 95 entity contracts, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, all 364 frontend files statically inventoried. Dynamic callers, detailed authorization maps, and dynamic cross-feature parity remain; build proof is recorded below.
- [ ] Phase 2 — migrate 95 entities and full RLS: **not started**; 4-table illustrative staging SQL only.
- [ ] Phase 3 — Supabase Auth identity mapping + role gates: **not started**.
- [ ] Phase 4 — function and integration parity (184 function entrypoints): **not started**.
- [ ] Phase 5 — full frontend port: **not started**; scaffold only and editor load guard.
- [ ] Phase 6 — live data and media export/import reconciliation: **blocked** by missing authorized test export and row counts.
- [ ] Phase 7 — Pages/Workers cutover runbook, DNS preservation, staging QA: **not started**. No deployment or DNS changes.

Verified: branch derived from README-only current main; #136 is obsolete; read-only inventory from interplanetary-fund2; 25 applied Supabase migration history entries. **Tests:** local `npm test` against the copied `validation.js` and test file passed **9/9 Node tests** (campaign validation and editor loaded-ID save gate), Node v22.16.0. **Not verified:** end-to-end browser app, Vite bundle, dependencies installed through npm, schema against staging, OAuth, RLS, payments. Npm registry access failed with EAI_AGAIN. A **dependency-metadata assembled** lockfile is now committed (210 entries, includes Tailwind/PostCSS, no Base44 packages; root pins and dependency path metadata checked), but `npm ci` and `npm run build` remain UNVERIFIED. See B7. No production schema/data/provider mutations.

## Verified internet-connected build — 2026-10-24 local / 2026-10-25 UTC
**PASS** — [GitHub Actions run 40156868430](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40156868430), standard `ubuntu-latest` runner with Node **v22.23.3**, npm **10.9.9**. This is a public repository's standard free runner, not a paid larger runner. Steps reported success:
- `npm install --save-dev --save-exact prettier@3.6.2 --package-lock-only --ignore-scripts --no-audit --no-fund`: **PASS** — regenerated true npm lock from accessible npm registry.
- `npm ci --no-audit --no-fund`: **PASS** — 152 installed packages.
- `npx --no-install prettier --write "src/**/*.{js,jsx,css}"`: **PASS**; generated multiline code committed to PR head as `b62e726`.
- `npm test`: **PASS — 9 tests, 0 failures**.
- `npm run build`: **PASS — Vite 6.4.3, built in 2.08s**.
- `npx --no-install prettier --check "src/**/*.{js,jsx,css}"`: **PASS**.

**Scope and caveats:** this validates an actual npm dependency install, Node tests and frontend bundle for the tested head, not Supabase runtime login, cross-account RLS, schema execution, provider OAuth, media/financial parity, or deployment. Separate CodeRabbit latest-head review findings and owner approval gates remain. No production service was changed.

## Secret-hand-off inventory — 2026-10-25
**Inventory complete; transfer NOT STARTED.** The Base44 owner supplied 20 secret names. No values were requested, accessed, imported or committed. [SECRET_DESTINATIONS.md](SECRET_DESTINATIONS.md) maps PayPal (3), Buffer (4), Eventbrite (1), Cloudflare (1), Browserbase (1), Convex (8) and Stripe (2) to target owners/retirement gates. Read-only Cloudflare checks found no Worker secret bindings on current `interplanetary-fund2` or `ifund-oauth`. Payment PR #145 now supports modern Supabase `sb_secret_...` keys, but its provider webhook, database ledger, end-to-end and production configuration remain UNVERIFIED. See B12 in [BLOCKERS.md](BLOCKERS.md). No production change or new credential transfer was made.


## Phase 1 merge readiness review — 2026-10-25

- Rechecked the phase source against current review findings. Dependencies for Tailwind/PostCSS and the null-client auth guard are present. Campaign editor inputs are now disabled until the exact owner campaign read completes; community textarea is disabled while its submitted content is saving. Existing owner campaign/post foreign keys use `ON DELETE RESTRICT`, not cascading deletion.
- Restricted proposed browser grants for the four-table preview schema: client inserts/updates may touch owner identifiers and content columns only, not `created_at`, `updated_at`, record IDs (except self profile ID) or provider verification columns. Added `tests/phase1-privilege-policy.test.js` to check this security property.
- [Phase 1 latest-head CI #40260130979](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40260130979) **PASS**: Node tests, npm resolution, Vite build, source formatting. Prior out-of-date CI failures are superseded.
- **Review scope:** This is a code-only integration-branch candidate. It is NOT a finished migration, does not establish actual cross-user Supabase RLS runtime, and must never be deployed as a full Base44 replacement. Source SQL grant corrections are **not applied** to the live Supabase database; any previously applied broader grants must be separately reconciled through an approved migration.


## Integration branch verified merge record — 2026-10-25 (supersedes earlier in-progress section labels)

**Integration source code merged, NOT released or cut over.** The following PRs merged into `migration/supabase-cloudflare`: #138 (Phase 1 scaffold, security grants and build), #149 (owner-only actions), #150 (Phase 4 gated nonfinancial Worker endpoints), and #151 (Phase 5 gated campaign/community editor). These merges do not mean full Phase 4 or 5 parity.

- **Phase 1**: baseline merged. Initial four-table SQL, RLS and browser-column-grant restrictions are present in Git; validate/repair the already-existing destination project grants separately before live activation.
- **Phase 2**: 95 source entities inventoried and private typed staging is present in the designated Supabase project, but complete runtime RLS/foreign-key/default parity remains unverified; PR #139 has requested review changes and post-merge conflicts.
- **Phase 3**: Supabase Auth user migration/owner links remain unverified. Live project `ssibsfmtodgximseeqsv` has **zero Auth users** at this check. PR #140 remains blocked.
- **Phase 4**: [independent API route matrix](INDEPENDENT_API_ROUTE_MATRIX.md) merged and [PR #150 CI](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40261185306) succeeded. Code includes read-only public feeds, verified-owner draft/profile/connection reads, owner-scoped campaign/content writes, safe draft-only deletion, and bounded JSON requests. **Other 184 source function parity, provider callbacks, agent workflows and financial behavior are not complete.** Worker preview gate remains off.
- **Phase 5**: gated, signed-in campaign and community UI improvements merged via #151; [CI](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40261349005) succeeded. Both `VITE_IFUND_CAMPAIGN_API` and `VITE_IFUND_COMMUNITY_API` default disabled; remaining original 57-page functionality and legal-policy review are incomplete.
- **Phase 6**: live destination `public.ifund_campaigns` and `public.ifund_posts` have **zero rows** at this check, with no Auth users. Private staged legacy records are not published user campaigns or proof of owner consent. PR #143's export verifier remains unmerged.
- **Phase 7**: Cloudflare still has **16** active domain Worker routes assigned to `interplanetary-fund2`; that deployed legacy Worker may proxy Base44. Pages project `interplanetaryfund-migration` has production branch `migration/phase7-offline-cutover-gate` and production deployments disabled. **No cutover was activated.**

Remaining integration blockers are recorded in `BLOCKERS.md` below and in #137. PRs #139–#143 became conflicted after the clean Phase 1 merge; they require per-phase reconciliation and review. Original PRs #141/#142 contain overlapping stacked changes: use merged #150/#151 as the baseline instead of merging their obsolete overlapped code wholesale. PRs #144–#148 need their separate gates. **Do not deploy, enable migration flags, switch DNS/API traffic or perform financial writes based solely on code merges.**


## Provider OAuth foundation — 2026-11-09

A focused integration branch `migration/provider-oauth-foundation-20261109` now documents provider-specific registration, OAuth security, token storage, Cloudflare secret placement, test gates and owner/provider blockers in [PROVIDER_OAUTH_FOUNDATION.md](../integrations/PROVIDER_OAUTH_FOUNDATION.md). Direct native Cloudflare/Supabase inspection found no configured secrets on the inspected IFund Workers and no provider OAuth Edge Function in either active project's current function inventory. The managed-connections preview worker still reports provider execution disabled. No provider credentials were retrieved, created, copied or deployed. No TinyFish automation was used and no metered credits were consumed. This is documentation groundwork, not a verified OAuth implementation or release.


## Provider OAuth follow-up — 2026-11-09

- Meta registration evidence found in the connected IFund mailbox: official Meta developer onboarding email for the existing **iFund** app (App ID `1427538482140267`, Business ID `1881031393302767`). This is an app registration identifier only; the email does not contain the client secret, redirect URI, permissions approval, or review status.
- Targeted mailbox searches did not locate LinkedIn, X, TikTok, Google OAuth client credentials, or GoFundMe Pro developer approval. No secret values were found or copied.
- The OAuth foundation branch remains documentation-only. The updated commit `19b96cc491a1e52dcd2ef196997307bfb065ec55` passed GitHub Actions run [42611128356](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/42611128356): real npm install, lockfile resolution, unit tests, Vite production build, and formatting check all passed. This does not test OAuth runtime or deploy either app.
- Base44 direct file/shell access was rejected by the connected workspace because its sandbox bridge requires the Builder plan. The alternative Base44 AI-builder edit consumes workspace credits, so it was not invoked without explicit approval. No Base44 app files or deployment were changed.
- Bulk actions are not yet implemented; the Connections page currently has only static provider cards and the independent API has read-only connection status. Confirm whether bulk actions should apply to multi-provider connect/disconnect on Connections or to another part of the app before wiring state-changing controls.


## Dual deployment clarification — 2026-11-09

The owner clarified that the end goal is to deploy the provider-connection capability to **both** the Base44 app and interplanetaryfund.com. Base44 must not be treated as documentation-only or as an abandoned target. Keep secrets in each platform's server-side secret manager and keep per-user tokens encrypted and owner-scoped; do not put raw secrets in Base44 entities or browser code. The Base44 direct source/shell bridge remains unavailable on the connected workspace without its Builder plan, and the AI-builder alternative consumes workspace credits; no credit-consuming edit was started. Continue the independent repo work in parallel, then complete Base44 parity once a no-credit authorized source path is available or the user approves the required Base44 builder credits.


## Provider OAuth implementation and Base44 source reconciliation — 2026-11-09

- The Base44 user-facing application is maintained in `interplanetarysister/interplanetary-fund2`; its canonical Connections tracker is issue #479. The current Base44 source already contains a per-user connector initiation/finalization/verification flow. Do not duplicate that flow or treat the app-scoped social connections as user-scoped connections.
- Base44 app-user connection references are controlled by `APP_USER_CONNECTOR_*_ID`. The current connected Base44 secret inventory has the Eventbrite reference but no LinkedIn, X, TikTok, Meta, Google/YouTube social connector references. The workspace connector list contains Eventbrite and GitHub only. Social provider per-user connection is disabled until the relevant provider OAuth workspace connectors/credentials are configured. X is shared-only in the Base44 connector catalog.
- The Base44 account has app-scoped Instagram and Facebook Pages connections; LinkedIn's app-scoped connection record is pending. These do not enable users to connect their own accounts and must not be reused as user tokens.
- The independent Cloudflare Worker now supports provider adapters for Google identity, YouTube channel, LinkedIn, X (read scopes only), TikTok, Facebook Pages and Instagram Business. It uses fixed provider endpoints, one-use state, PKCE where the provider's web flow supports it, server-side token exchange, provider identity/capability probes, AES-GCM token encryption and service-role-only Supabase storage. Provider scopes are recorded only when returned or independently verified; requested scopes are never assumed granted.
- Supabase secret-key compatibility is hardened: modern opaque secret API keys are sent only in `apikey`, not as `Authorization: Bearer`; legacy service-role JWT keys retain the Bearer header. OAuth enablement is controlled by `OAUTH_API_ENABLED`, independent of the preview-only migration flag, and the owner connection-status endpoint is enabled only when that flag is active.
- GoFundMe Pro is not a per-user OAuth provider in the same sense. Its API uses an organization-level client-credentials grant at `https://api.classy.org/oauth2/auth`; it requires an API app's client ID, client secret and organization ID. The member authorization-code/Classy Login path is separately documented but not established as the production API flow. No credentials were found; a separate server-only connector remains a provider gate.
- The standalone branch still has no provider secrets, applied Supabase migration, registered exact callbacks, or real provider handshakes. Base44 source changes are not required yet because its existing user connector path is present; configuration is the blocker. Continue source work through the canonical ifund2 GitHub repo and avoid Base44 AI-builder/paid operations under the zero-credit directive.
