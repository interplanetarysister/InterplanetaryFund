# Project memory — InterplanetaryFund

Durable facts for agents working in this repository. Details in daily logs.

## Layout
- Two frontends. **`apps/web/` is the branded public site** (React 18, react-router-dom 7,
  Tailwind + shadcn, `@/` -> `./src`). Root `src/` is an older/parallel app (react-router-dom 6,
  plain CSS) with a campaign editor talking to the optional Worker API. Which one the Pages
  project `interplanetaryfund-migration` actually builds is unverified (B19).
- Backend: Supabase (`ssibsfmtodgximseeqsv`) Postgres/Auth/Storage/Edge Functions; Cloudflare
  Workers (`worker/`, flag-gated) and Pages. Wix keeps the marketing site.
- Migrations: `supabase/migrations/` (applied) and `supabase/migrations/pending/` (NOT applied).

## Build and test
- Root: `npm test` (`node --test tests/*.test.js`) + `npm run build`. Web: same under `apps/web`.
- CI `Frontend production build and tests` runs both; it is the authoritative check.
- `apps/web/vite.config.js` fails the build on circular chunk imports — keep page imports acyclic.
- Prettier is NOT clean repo-wide (~106 files fail `prettier --check`). Never run
  `prettier --write` broadly; match surrounding style instead.

## Conventions
- `src/api/*` and `src/lib/*` in `apps/web` use **relative** imports (`../lib/x.js`), not `@/`,
  so `node:test` can import them without a bundler. Pages/components use `@/`.
- Tests are `node:test` + `assert/strict`. Two styles: source-contract (regex the file text) and
  real unit tests with hand-written fake Supabase clients (`tests/universal-inbox.test.js`).
- A fake Supabase client must implement `.single()`/`.maybeSingle()` AND `then()` for list queries.
- `apps/web` test glob is `tests/*.test.js`; helpers in `tests/helpers/` are not suites.
- **Component render tests**: `tests/helpers/render.js` bundles one component with the
  already-installed `esbuild` and renders it via `react-dom/server` (stubs a minimal `window`
  because `src/components/ui/image.jsx` reads `window.self` at import time). Reuse it rather
  than adding a test-runner dependency.

## Non-negotiable safety rules
- Campaign status is `draft | active | paused`; constraint `ifund_publish_complete` requires
  complete content + goal > 0 before `active`.
- **Delete only drafts.** Published campaigns may have donors; pause them instead. Mirrors
  `worker/campaignWrites.js`.
- Publishing changes visibility only — never wire it to donations, ledger rows, or payment calls.
- Never put a service-role key in browser code. RLS is the security boundary; client checks are UX.
- `apps/web/src/lib/useFundraisingMode.js` returns `false` (campaign donations paused). Keep it.
- No deployment, DNS, live SQL, or payment-provider change without explicit owner authorization.

## Owner campaign surface (apps/web)
- Every owner campaign read/write goes through `src/api/ownerCampaigns.js`. Never inline
  `client.from("ifund_campaigns")` in a page — that skips the confirmed-email check,
  `verifyAccountLifecycle`, owner-scoped row validation, UUID validation and the session re-check.
- Status writes are compare-and-swap on `status` (`.eq("status", existing.status)`); a zero-row
  result is a concurrency conflict (`isCampaignConflict`), and pages must reload the stored row.
- `CampaignCard` links: draft -> `/create?draft=<id>`, paused -> `/campaigns`, active ->
  `/campaign/<id>`. A paused card must never link to `/campaign/<id>` (only active rows are served).
- `src/lib/campaignShare.js` only ever emits `https://interplanetaryfund.com`, never
  `window.location.origin`.
- **Community posting** goes through `src/lib/socialPosts.js` (confirmed email +
  `verifyAccountLifecycle`, 1-2000 chars, verify returned row). Never insert into `ifund_posts`
  directly (B16). `/social` and `/community` are public reads — do NOT wrap them in `MemberAccess`.
- **Deploy**: `.github/workflows/deploy-web-pages.yml` publishes `apps/web/dist` to Pages
  (`interplanetaryfund-migration`). Never on `pull_request`; preview by default; production needs
  explicit input. Needs secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` and vars
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (+ optional
  `VITE_SUPABASE_OAUTH_PROVIDERS`). No Cloudflare credentials here (B17).
- **Pages needs `apps/web/public/_redirects`** (`/* /index.html 200`) or deep links 404. `_headers`
  must keep `/embed/*` as `frame-ancestors *` or the embed card breaks in third-party iframes.
- **`src/index.css` has a global `.dark` layer** remapping `bg-white`, `bg-stone-*`, `text-stone-*`
  and light borders to theme tokens. Pages using those classes are NOT dark-mode bugs.
- **Committed migrations create 6 tables; the code queries 11** (B18).
  `supabase/migrations/pending/20261102_ifund_member_schema_completion.sql` supplies the missing
  5 + `ifund_profiles.account_status`/`account_deletion_pending` +
  `ifund_current_account_is_active()`, and closes B16. NOT APPLIED. `ifund_profiles` RLS is
  owner-only, so `/u/:id` needs a public-read policy. Donors/ledger/withdrawals/subscriptions have
  no table; the financial ones must not be faked.
- **Auth in apps/web**: email/password + Google/Facebook OAuth (`src/lib/oauthProviders.js`,
  gated on `VITE_SUPABASE_OAUTH_PROVIDERS`). Instagram excluded per AGENTS.md. The redirect stays
  canonical (`/login`) with the destination in `returnTo` — Supabase validates the redirect URL.
- **Deployed bundle = repo ROOT, not apps/web** (owner-confirmed 2026-11-02). The Pages
  project's GitHub source setting points at the read-only `interplanetary-fund2` while the
  last deploy came from `InterplanetaryFund`; auto production deploys are off (B19).
  Anything shipped to `apps/web` is NOT live until the Pages root directory is switched.
- **B20 (live, fixed pending apply)**: the committed blog insert policy only checked
  `owner_auth_user_id = auth.uid()`, so any authenticated account could publish an entry
  under the official Reporter blog and `anon` could read it. Fix in
  `pending/20261102_ifund_blog_entry_ownership_fix.sql`; 8 tests in
  `tests/blog-entry-ownership.test.js`. Exploitable because the deployed root app holds the
  writer (`src/pages/MyBlog.jsx` via `src/lib/blogs.js`).
- **Reporter workspace parity**: `apps/web/src/lib/reporterWorkspace.js` +
  `pages/MyPublication.jsx`, routed at `/publication` and `/my-blog`. apps/web is now a true
  superset of the root app. Porting it needed no schema change.
- **B16 needed an UPDATE gate too**: gating INSERT alone left a bypass — a suspended owner could
  publish/edit by updating an existing draft. `ifund_campaigns_update` now carries the lifecycle
  check in `using` AND `with check`; DELETE stays owner-only by design. General rule: when adding an
  authorization gate, cover every mutating verb, not just insert.
- **Which Supabase project the deployed root app uses is unknown** — `VITE_SUPABASE_URL` is a Pages
  build variable and no URL is hard-coded in the repo. This decides where B20 is exploitable.
- **The live Pages site is the ROOT app of InterplanetaryFund, NOT fund2** — verified by probing
  the live bundle (0 base44 refs, has supabase; lacks /dashboard /inbox /notifications /profile
  /following; title+theme match this repo's root index.html). It is STALE (408KB vs 473KB fresh).
- **Route counts: fund2=60, apps/web=33, root=19.** apps/web is the most complete MIGRATION
  frontend but is NOT full Base44 parity (no admin/*, agents, ledger, withdrawals, donors pages).
  Do not claim parity.
- **Production schema can be reconciled WITHOUT credentials.** The Supabase URL + publishable/anon
  key ship in the deployed bundle (`curl` the Pages site, grep the /assets/index-*.js). Use
  `npm run reconcile` (scripts/reconcile-production-schema.mjs). PostgREST column oracle: 400
  "does not exist" = absent, 200/401/403 = present. Trap: a POST with a bad column returns 400
  before RLS, so it fakes "write allowed" — always use real columns.
- **Production project is ssibsfmtodgximseeqsv and the deployed bundle targets it** (extracted from
  the bundle). All 10 client tables exist under `ifund_` names; every client column exists; RLS is
  clean (anon sees no non-public rows, all writes 401).
- **Production's ifund_legal_acceptances has NO PRIMARY KEY** (no `id`, no `created_at`) because it
  was created out-of-band. `create table if not exists` silently cannot repair it. Fix shipped:
  pending/20261102_ifund_legal_acceptances_repair.sql (must sort BEFORE the member schema).
- **Base44 backend migration critical path = 68 MISSING TABLES, not handler code.** Inventory (measured):
  184 entrypoints, 95 entity schemas, 76 entities referenced, only 8 have tables here. 54 functions
  financial (gated). Entity->table naming is CURATED (DiscussionPost->ifund_posts, User->ifund_profiles)
  and fields rename (user_id/created_by_id->owner_id, username->handle), so entry.ts bodies cannot be
  ported blindly. Run `BASE44_SOURCE=/path node scripts/inventory-base44-functions.mjs`.
- **apps/web + root src talk DIRECTLY to Supabase (RLS) + RPCs + Edge Functions; they do NOT call
  worker/*.** The Base44 functions are a REPLACEMENT, so the frontend's own Supabase/RPC calls are the
  real contract to satisfy — not the 184 functions.
- **Production withholds account-uuid columns from anon** (ifund_posts.author_id, ifund_campaigns.owner_id,
  blog owner cols) but the COMMITTED migrations grant anon table-wide select => repo was LOOSER than prod;
  fixed in pending/20261102_ifund_public_read_hardening.sql. 401 on one column while others 200 = grant
  denied (column exists). Column-level grants beat the row policy.
- **Two client RPCs had no migration**: ifund_public_blog_entries_read (404 in prod => Stories broken) and
  ifund_my_post_ids (401 in prod, absent from repo). Both now defined. A test that greps source TEXT for
  `rpc("name")` passes even when the function is missing — tests/public-blog-entries-read.test.js now
  compares client rpc names against supabase/**.sql definitions.
- **`ifund-campaign-draft-preview` Edge Function EXISTS in prod** (returns its own 422 validation error)
  even though supabase/functions/ is absent from the repo — deployed out-of-band. Don't assume "not in
  repo" means "not deployed".
- **No Supabase or Cloudflare credentials exist in this environment.** Live schema reconciliation,
  migration application, preview deploys and the DNS switch are all impossible from here. Verify DB
  work against PGlite (tests/helpers/pglite.js) only, and never claim live results.
- **apps/web is cleanly deployable standalone** (`git archive HEAD apps/web` -> npm ci -> build
  succeeds). Cloudflare Pages: root_directory=apps/web, output dist.
- **react-router advisories span all of 6.x** (`>=6.0.0 <7.18.0`) — a 6.30.x patch bump does NOT
  clear them; only 7.18.5 does. Root app is now on ^7.18.5; apps/web already was on 7.x.
- **A green build + green unit tests do NOT prove the router renders.** After any router major bump,
  render a real component. Root-app render harness: `tests/helpers/render.js` (`loadModule`).
- **NEVER `prettier --write` apps/web/src/App.jsx** — it reflows every `<Route>` to
  multi-line and breaks 5 pre-existing single-line route assertions. Edit routes with a
  targeted insert. More generally, do not run a formatter over files with source-contract tests.
- **`ifund_campaigns` has no location columns**, so the Earth map and city search are
  schema-blocked, not UI work. Maps also need an external tile provider (a vendor decision).
- **SQL can be verified for real here** with PGlite (PostgreSQL 16 in WASM), a root devDependency.
  Harness `tests/helpers/pglite.js`; example `tests/member-schema-migration.test.js`. Gotchas:
  no `pgcrypto` (strip `create extension`); `set local role` is a no-op outside a transaction, so
  use session-level `set role`; RLS is enforced, so seed server-owned rows as role `postgres`;
  `create policy` is NOT idempotent — prefix with `drop policy if exists`.

## Known state / blockers
- `ssibsfmtodgximseeqsv` has zero Auth users and zero published campaigns, so cross-user RLS and
  the publish -> Discover round trip are unverified at runtime. See `docs/migration/BLOCKERS.md` (B14).
- Public-site-port branch is NOT the deployed production branch (`apps/web/DEPLOYMENT-GATES.md`).
- Authority for migration policy: issue #137 and `AGENTS.md`.
