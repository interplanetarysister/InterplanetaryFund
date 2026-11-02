# Migration status — 2026-10-24
Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137)

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

## Owner campaign lifecycle implemented in apps/web — 2026-11-02

**Code only. Nothing deployed, no SQL applied, no DNS or payment change.**

- **Gap closed:** `apps/web` could save a private campaign draft but had no way to publish, pause, resume, edit, or delete one. `CreateCampaign.jsx` only ever wrote `status: "draft"`, so a member could never make a campaign reach `/discover`. The database already supported the full lifecycle (`ifund_campaigns.status in ('draft','active','paused')`, constraint `ifund_publish_complete`, owner-scoped update RLS), so no schema change was required.
- **Added:** `src/lib/campaignLifecycle.js` (status transitions, publish readiness mirroring `ifund_publish_complete`, field limits matching `worker/campaignWrites.js`, payload builder that never emits `owner_id` or server-owned columns), `src/api/ownerCampaigns.js` (owner-scoped list/load/save/status/delete with post-write verification and session-change detection), `src/pages/MyCampaigns.jsx`, `src/pages/EditCampaign.jsx`, `src/hooks/useAuthSession.js`, and three new routes (`/campaigns`, `/campaigns/:id/edit`; `/create` unchanged).
- **Shell fix:** `components/Layout.jsx` hardcoded `user = null`, so a signed-in member never saw member navigation. It now reads the session through `useAuthSession` (client hint only; RLS stays authoritative).
- **Deletion policy preserved:** only drafts can be deleted, matching the audited `worker/campaignWrites.js` rule; a published campaign is paused instead because it may already have donors.
- **Tests:** `apps/web/tests/campaign-lifecycle.test.js` (6) and `apps/web/tests/owner-campaigns.test.js` (12). `npm test` in `apps/web` reports **58/58 pass** (40 pre-existing + 18 new). Root `npm test` reports **96/96 pass** (unchanged). `npm run build` in `apps/web` succeeds; new `MyCampaigns`, `EditCampaign` and `ownerCampaigns` chunks are emitted and the cyclic-chunk guard passes.
- **Browser smoke test:** preview server rendered `/campaigns` and `/discover` without a blank screen or crash. `/campaigns` correctly fails closed with "Account verification unavailable" because no Supabase publishable key or session is configured in this environment.
- **UNVERIFIED (not claimed):** no test has run against a real Supabase session. Cross-user RLS, the live `ifund_publish_complete` constraint, and the publish→Discover round trip remain unproven at runtime. The destination project still has zero Auth users and zero published campaigns. Publishing is visibility only; donations remain paused.

## PR #186 review fix — campaign status concurrency (2026-11-02)

**Code only. Nothing deployed, no SQL applied, no DNS or payment change.**

The PR #186 review found a real race: `saveOwnerCampaign` and `setCampaignStatus` read `status`, checked `canTransition`, then updated by `id` + `owner_id` only. Two tabs could therefore both pass the check and the loser would overwrite the winner — e.g. a stale draft save reverting a campaign another tab had just published.

- **Fix:** every status-changing mutation now carries the status it validated as a compare-and-swap condition (`.eq("status", validatedStatus)`) and reads the affected row back through `.maybeSingle()`. Zero affected rows, or a returned row whose status is not the one written, is treated as a lost race and fails closed with "This campaign changed in another session." RLS remains the authorization boundary; this is an integrity control, not a security control.
- **UI:** `MyCampaigns.jsx` and `EditCampaign.jsx` detect the conflict via the exported `isCampaignConflict` predicate and reload the stored state instead of leaving a stale row or form on screen.
- **Schema compatibility (source-checked, not runtime-verified):** the guard needs no new SQL. `grant update(title,...,status)` already covers the `status` column, and the `status` filter is a WHERE clause covered by `grant select`. The `ifund_publish_complete` constraint is still mirrored client-side.
- **Tests:** 8 new cases (66 total in `apps/web`). Five of them — the CAS filter assertion, stale draft save vs. concurrent publish, stale publish applied twice, stale resume vs. concurrent publish, and conflict-vs-generic-failure — were confirmed to **fail against the pre-fix code** and pass after it. Root `npm test` still 96/96; `apps/web` build still succeeds.
- **UNVERIFIED:** still no authenticated Supabase session, so cross-user RLS, the live constraint and the publish → Discover round trip remain unproven at runtime. The migration `supabase/migrations/20261025011400_initial.sql` is in the applied directory in Git, but whether the destination project actually has these grants and policies is not verified from here.

## Campaign sharing implemented in apps/web — 2026-11-02

**Code only. Nothing deployed, no SQL applied, no DNS or payment change.**

- **Gap closed:** `CampaignDetail.jsx` listed a "share kit" among the features it deliberately did not port, so a published campaign had no share affordance at all — only the blog article page could copy a link. Campaign sharing is a listed product requirement ("discovery, search, following, and sharing") and needs no new infrastructure: it is a browser action, so it works for anonymous visitors.
- **Added:** `src/lib/campaignShare.js` (canonical link builder, share text, encoded third-party targets for X/Facebook/LinkedIn/email, Web Share payload, capability check — all pure functions) and `src/components/campaigns/CampaignShareButton.jsx` (collapsible share panel). Rendered in the `CampaignDetail` sidebar above the follow button.
- **Safety properties:** only the canonical production origin is used for the public link, so a preview or hostile origin cannot be shared as canonical; non-UUID ids and non-`active` campaigns render nothing; every dynamic value is percent-encoded so a title containing `&`, `"` or `%` cannot break out of a query string; a denied clipboard is reported as unavailable rather than as a successful copy. No tracking parameters, no network call to IFund, no account connection required.
- **Tests:** 12 new cases in two suites — `tests/campaign-share.test.js` (8, pure logic and wiring) and `tests/campaign-share-render.test.js` (4, real server-side renders of the component). `apps/web` is now **78/78 pass**; root `npm test` still 96/96; `apps/web` build succeeds; preview server resolves `/campaign/:id` and fails closed with no Supabase env.
- **Note:** `tests/campaign-share-render.test.js` introduces the first real component-render harness in `apps/web`, bundling a single component with the already-installed `esbuild` and rendering it through `react-dom/server`. No new dependency was added.
- **UNVERIFIED:** the share panel has not been exercised in a real browser against a live published campaign (no Supabase credentials in this environment — see B15). Browser clipboard and `navigator.share` behaviour on real devices is unproven here.

## Two owner-surface defects fixed — 2026-11-02

**Code only. Nothing deployed, no SQL applied, no DNS or payment change.**

- **Defect 1 — Dashboard bypassed the verified owner transport.** `Dashboard.jsx` ran its own inline `client.from("ifund_campaigns").select(...).eq("owner_id", …)` query. That skipped everything `listOwnerCampaigns` enforces: the provider-confirmed-email check, `verifyAccountLifecycle`, owner-scoped row validation, UUID validation and the session-changed re-check. A member whose account was suspended or scheduled for deletion could still enumerate their campaign rows from the dashboard, and a row returned for a different owner was rendered unchecked.
  - **Fix:** added `listMyCampaigns(client)` to `apps/web/src/api/ownerCampaigns.js` — it delegates to `listOwnerCampaigns` and only reshapes rows for `CampaignCard` (funding totals stay `null`, never `0`, because this schema carries no totals). `Dashboard.jsx` now calls it and has no direct campaign query left.
- **Defect 2 — a paused campaign's card linked to a dead public page.** `CampaignCard` sent every non-draft campaign to `/campaign/:id`, but the public detail read only serves `status = 'active'` rows and Discover hides paused ones. An owner viewing a paused campaign was sent to "We couldn't load this campaign."
  - **Fix:** `CampaignCard` now routes a paused campaign to `/campaigns` (owner management) and labels it "Paused · Hidden from Discover". Drafts still open the editor; active campaigns still open the public page.
- **Tests:** `apps/web` is now **84/84 pass**; root `npm test` still 96/96; build succeeds.
  - `tests/owner-campaigns.test.js` +2: the dashboard list keeps the verified transport, rejects unverified email / suspended accounts, and returns no fabricated funding totals; and `Dashboard.jsx` no longer queries the campaign table inline.
  - `tests/campaign-card-render.test.js` (new, 4 cases) renders the card for real through the shared harness. The paused case was verified to **fail before the fix** and pass after.
  - `tests/helpers/render.js` (new) is a shared component-render harness built on the already-installed `esbuild` + `react-dom/server`; it stubs the few `window` globals that presentational modules read at import time. No new dependency.
- **UNVERIFIED:** neither fix has been exercised against live data (no Supabase credentials in this environment — see B15). The Dashboard change is only proven at the transport and source level, not in a signed-in browser session.

## Community posting now requires verified member access — 2026-11-02

**Code only. Nothing deployed, no SQL applied, no DNS or payment change.**

- **Gap:** `/social` and `/community` are public pages (correctly, so anonymous visitors can read), but the composer inserted posts straight into `ifund_posts`. A signed-in user was enough to post; the account was never checked for a confirmed email or a live status. The Worker's `worker/communityWrites.js` already validates these writes server-side, and its 1–2000 character body rule was being bypassed by the direct browser insert.
- **Added:** `apps/web/src/lib/socialPosts.js` — `validatePostBody` (trim, 1–2000 chars), `canMemberPost` (confirmed email + `verifyAccountLifecycle`), `publishPost` (gate, validate, insert only `author_id` + `body`, verify the returned row). `SocialFeedPage.jsx` now gates its composer on `canMemberPost` and publishes through `publishPost`; the raw insert is gone and the `maxLength` uses the shared constant.
- **Tests:** 8 new cases in `tests/social-posts.test.js`. `apps/web` is now **92/92 pass**; root `npm test` still 96/96; build succeeds. The source-contract assertions were checked against the pre-fix file and fail there.
- **Still open, recorded as B16:** this is a browser-side fix only. The `ifund_posts_insert` RLS policy checks `author_id` and nothing else, so a suspended account can still post by calling PostgREST directly. Closing that needs a policy/trigger that consults `ifund_profiles`, which is a schema change requiring independent review and staging tests before application. It is not applied here.
- **UNVERIFIED:** not exercised against live data (no Supabase credentials — B15).

## Deployment readiness for the branded frontend — 2026-11-02

**Code and config only. Nothing deployed; no DNS change; no SQL.**

- **`public/_redirects`:** the frontend is a single-page app served by Cloudflare Pages, which has no built-in SPA fallback. Without a rewrite every deep link (`/discover`, `/campaign/<id>`, `/campaigns/<id>/edit`) and every refresh returned a 404. Added `/* /index.html 200` — a 200 rewrite, not a redirect, so the URL is preserved and React Router can resolve it. Real files and hashed assets still win because Cloudflare matches existing files first.
- **`public/_headers`:** added `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, and a baseline CSP (`object-src 'none'; base-uri 'self'; frame-ancestors 'self'`). A full `default-src`/`script-src`/`connect-src` policy is deliberately **not** set: it cannot be verified against a live Supabase session from this environment, and a wrong policy white-screens the site. `/embed/*` overrides `frame-ancestors` to `*` because the embed card is designed to be framed by third-party sites. `/assets/*` is cached immutably; `/index.html` revalidates so a deploy is picked up.
- **`.github/workflows/deploy-web-pages.yml`:** publishes `apps/web/dist` to Cloudflare Pages. It never runs on `pull_request`, defaults to a **preview** branch, and only targets production when explicitly requested. It refuses to deploy if `VITE_SUPABASE_URL` is unset (no backend-less bundle), re-runs the tests, and asserts `dist/_redirects` and `dist/_headers` survived the build. Secrets are read from `secrets.*`; the Supabase publishable key from `vars.*`. No credential is written into the workflow.
- **Tests:** `tests/deployment-readiness.test.js` (6 cases) pins the SPA rewrite, the header set, the embed framing exception, the preview-default rule, the absence of hardcoded credentials, and the no-backend refusal. `apps/web` is now **98/98 pass**; root 96/96; build succeeds.
- **Verified by running it:** a local server that honours `_redirects` like Pages returns 200 + the app shell for `/campaign/<uuid>`, `/campaigns/<uuid>/edit`, `/discover` and `/about`, and the browser renders the About page and client-side routes from a deep link. The built `dist/` contains both files.
- **UNVERIFIED:** no Cloudflare credentials exist in this environment, so nothing has actually been published. See B17.
