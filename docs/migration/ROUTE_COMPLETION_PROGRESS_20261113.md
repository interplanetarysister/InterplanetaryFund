# Interplanetary Fund full-route completion ledger — source-only increment

**Checkpoint:** 2026-11-13 UTC  
**Canonical implementation:** `interplanetarysister/InterplanetaryFund`, `apps/web`  
**Working branch:** `feature/route-completion-20261113`  
**Owner release condition:** Do **not** compile or publish another preview until every route is implemented, source-reviewed, and accepted in the route matrix. Production promotion remains separately gated by preview, identity, provider, ledger, and RLS acceptance.

## What changed in this increment

- Added actual `/onboarding` account profile editing, verified via existing `ifund_my_profile_settings` / `ifund_save_my_profile` RPC wrappers and explicit public-profile consent.
- Added `/devices` using only current authenticated Supabase browser session and supported local/other-session revocation. It deliberately does not manufacture a multi-device inventory or promise immediate invalidation of outstanding JWT access tokens.
- Reused verified member components for `/mission` (Agents), `/donors` (owner supporter engagement), `/analytics` (owner engagement + verified finance + public opt-in Atlas), and `/connect` (Connections).
- Added `/ops` and `/platform` behind verified super-admin guards, with read-only operational snapshot and the existing `ifund_admin_workflow_registry` server-authorization RPC. No dispatch, retry, deployment, provider action, or payout was enabled.
- `/activate` legacy token links are rescued through the existing credential-safe callback; ordinary stale links go to login, never to an unimplemented screen. Added a redirect-loop negative case.
- Replaced unknown `/admin/*` placeholder with an intentional not-found screen. This does not certify the **known** missing admin routes.
- Added `apps/web/tests/route-completion-increments.test.js` for route permissions and referenced backend contracts.
- Added `/admin/sustainability` with verified-admin access, real public environmental-campaign data, and provider-verified fundraising totals; no invented carbon/impact outcomes. Browser and RLS acceptance still pending.
- Restored the working Story/AI Team navigation entry, removed duplicate Institutions and retired founding-member navigation, and removed the unfinished AI Image Studio entry from active navigation. The `/ai-images` deep link remains tracked as unimplemented and still blocks preview.
- Updated the bundled Help Center instructions to describe actual navigation, provider consent and saved-state checks without blanket unfinished-migration warnings; removed the homepage advertisement for an unsupported cryptocurrency payment action.
- Environmental campaign summary now aggregates confirmed fundraising **only in integer cents**, with safe-integer overflow checks. Its isolated mathematical helper passed 13/13 representative amounts (including $1, $2.50, $3.33, $5, $10, $25) and malformed/overflow cases. These are **not** PayPal captures or a Node test-suite result.
- Added `apps/web/ci/route-acceptance.json` with **77 route patterns** (74 explicit plus three mapped legacy placeholders), each initially `not_verified` or `not_implemented`, so no untested route is silently accepted.
- Added `apps/web/ci/verify-route-readiness.mjs` as a fail-closed manual release preflight. The existing `workflow_dispatch` release workflow runs the source preflight **before** npm dependency installation/build/Cloudflare deployment. Automatic Git-connected builds must stay disabled.

## Current blockers, verified boundaries

| Scope | Finding | Required acceptance |
|---|---|---|
| `/community/:id` | Live destination `public.ifund_community` and `public.ifund_community_member` each have **zero rows**; no public/member grants or row policies, and no `ifund%communit%` public RPC was present in the read-only catalog check. These legacy-staging tables are **not** an authorization or publishing source. | Verify canonical community ownership, design public/member read RPCs with negative RLS tests, reconcile source records, then build the real community-detail experience. No fake community data. |
| `/ai-images` | Base44 image studio uses its former media/provider service. Current independent website has campaign cover/writing tools but no independently accepted zero-cost image-generation/provider and object-store round trip. | Authorize one free execution path, confirm exact R2-bound handler, licensing and owner rights; test upload/generate/improve and failure states. Do not label a sample as generated artwork. |
| `/oauth/consent` | Original Base44 MCP OAuth consent uses an opaque server context. Current `worker/oauth.js` implements **different** third-party provider OAuth flows; it is not a verified replacement for MCP-client consent. | Replace only with an independently registered, server-authenticated MCP consent request/approve/deny flow or explicitly retire route after protocol audit. Never approve opaque contexts in client-only code. |
| `/admin/integrations` | Dedicated 47-platform Connections implementation is already being developed in **PR #286**; staged provider grants/SQL and conflicts with main remain. | Reconcile with its owner; verify authorized provider scopes/grants, migrations, revoke and failure paths before merging. Avoid duplicate implementation. |
| `/admin/audit`, `/admin/help` | Sidebar still advertises these destinations, but no explicit independently accepted implementation is registered. | Implement purpose-built admin pages with server-verified role gates, scoped data, and tests; or remove only if owner formally retires their functionality. |
| Full-site source and runtime | This branch is **source-staged only**. No complete Node/Vite suite, authenticated multi-user RLS browser test, mobile 320px test, provider acceptance, or build passed in this increment. | Complete all 77 acceptance records with source+test evidence and reconcile canonical main, then run **one** consolidated build and preview first. |
| Finances | Sandbox captures and test receipts cannot establish live provider success or production isolation. | Preserve verified sandbox/live separation, 7% fee only at real owner withdrawal, signed webhooks, idempotent ledger, no payouts without provider gates. |

## Evidence and next actions

1. Read-only Supabase catalog check: `ifund_community` and `ifund_community_member` contained zero rows, no `anon`/`authenticated` grants or policies, and no public community RPC. `ifund_admin_workflow_registry()` exists with explicit verified-admin check and returns read-only migration registry rows.
2. JavaScript-level execution of the release preflight using actual branch `App.jsx`, `Layout.jsx`, and acceptance JSON yielded **86 blocking reasons** at the earlier 76-route checkpoint. The new guarded sustainability route replaces one missing navigation destination with a new, still-unverified acceptance entry. The retired founding-members waitlist admin link and unimplemented AI-image navigation entry were also removed. A previously hidden but implemented Story/AI Team section is now available. Duplicate Institutions navigation was removed. Re-run the gate after each source change. This is a logic check in an isolated V8 context, **not** `node --test` or a Vite build. It is expected to fail until completion.
3. New targeted source-level Node tests were committed, **not executed** against a full checkout. Do not mark them PASS.
4. Source checked and changed only; **no** Cloudflare Pages preview/production build, Worker deploy, database write, R2/media mutation, PayPal transaction, GitHub Actions dispatch, DNS change, or Base44 mutation was performed.
5. Keep issue #203 as the parent migration coordination issue; avoid overlapping PR #286 Connections work. Source-ready entries in the 77-row matrix must name their specific automated tests and negative-case evidence. Neither a green static gate nor a preview HTTP 200 can prove all pages bug-free.

**Read-only Cloudflare configuration evidence:** Pages project `interplanetaryfund-migration` has `deployments_enabled=false`, `production_deployments_enabled=false`, and `preview_deployment_setting=none`; the recent successful previews listed belong to the **separate** `feature/connections-icon-hub-20261112` branch, not to this route-completion branch. No build was triggered by this work.

**Updated preflight:** 77 route records, 3 ComingSoon paths, 3 unresolved navigation paths, and 1 residual ComingSoon component => **84 blocking findings** in an isolated JS-level gate evaluation. No actual Node/Vite or browser-suite execution was claimed.

**Release decision: HOLD.** No unverified route is accepted. Source implementation and consolidated QA continue before preview.

## Additional release-gate hardening — 2026-11-13

- The source preflight now rejects unknown route roles and invalid `source_status` values. For each `member`, `admin`, or `super_admin` route, it additionally requires non-empty `backend_evidence` documenting server-side authorization and negative-case RLS/provider checks. Browser-only source evidence cannot be used to certify a protected route.
- Added `apps/web/tests/route-readiness-auth-evidence.test.js`. Six isolated Node tests passed against the preflight in a temporary route fixture. These tests do **not** exercise the full application, a real Supabase identity, Cloudflare Pages, or live payment providers.
- The route register still holds 77 unaccepted entries; of those, 29 are protected routes with empty backend-authorization evidence. With the unchanged three placeholder routes, three missing admin navigation routes, and one residual placeholder component, the new **strict** source preflight is expected to report **113 findings** (84 previous findings + 29 independently required backend evidence findings). This is an increased evidence standard, not 29 newly broken product features. No route has been marked accepted.
- No Pages preview, production deploy, Worker change, database migration, PayPal transaction, or PR reconciliation is authorized by these tests. **Release remains on HOLD** until independent source, backend, and runtime acceptance is complete.


### Concurrent route registration verification (pinned SHA `98963a27547b139ee84df79f3d097e470b8ebb28`)

- The operational audit and Help Center editor routes were subsequently registered by the active admin workstream. The manifest now has **79** tracked route records. These pages remain *unverified* and the audit-feed SQL remains source-staged, not applied.
- An isolated read of the pinned branch's `App.jsx`, `Layout.jsx`, and route register using the same fail-closed conditions reports **115 blockers**: 79 missing source/test acceptance records, 31 protected routes missing backend authorization evidence, three placeholder routes, one placeholder component reference, and one missing explicit navigation route (`/admin/integrations`, owned by draft Connections PR #286).
- The higher count follows the additional admin route declarations and strict authorization evidence requirement; it is not proof of 115 user-visible defects. There has been no complete Vite or authenticated-browser acceptance for this branch.
- Cloudflare Pages read-only API reconfirmed both Git-connected automatic deployment flags disabled. No preview for this route-completion branch was present in the five most recent Pages deployments; those were Connections-branch previews.

## Follow-up: verified-source admin audit and editable Help Center — 2026-11-13

**Implemented in branch source:**

- `/admin/audit`: bounded, chronological, cursor-paginated super-admin audit view with strict response parsing, no private event details or actor identifiers in the UI. `AdminAudit.jsx` prevents stale account responses from being shown after a session change.
- `supabase/migrations/pending/20261113_ifund_super_admin_audit_feed.sql`: **NOT APPLIED**. Uses the existing verified super-admin database function and restricted `SECURITY DEFINER`; revokes `PUBLIC`/`anon` execution, returns only a sanitized event class, date, and opaque hashed reference. Sources are existing workflow execution, administrative mail audit and platform incident records; this is not represented as a complete payment/account audit.
- `/admin/help`: real authoring view for answers to the canonical bundled Help topics, using the existing super-admin-only Website Studio draft/publish/versioned API. A previously published answer remains public until the revision is explicitly published. `/help/:slug` reads a published override or shows bundled guidance without displaying a draft.
- `GET /api/public/help/index`: one read-only, published-only same-origin Worker request returns validated Help answer overrides for searchable results. Never returns raw Studio row metadata, draft revisions or credentials; member-specific writes remain authenticated.
- Navigation now checks the server-verified super-admin role before displaying Audit, Help Editor, Ops, Platform and Website Studio links.
- Existing `/admin/integrations` work remains assigned to PR #286; no duplicate provider code or migration was added.

**Verification without a build:**

- **8/8** isolated exact-helper JavaScript checks passed for published/draft Help overrides and audit response validation, duplicate rejection, ordering, and opaque-field stripping.
- **7/7** isolated Worker Help-index cases passed against mocked upstream data, including draft rejection, unknown slugs, duplicate rejection, disabled runtime, and method denial. Additional Node test files are source-staged (`apps/web/tests/admin-help-audit.test.js` and `apps/web/tests/public-help-index.test.js`), but **the complete Node test suite has not been executed**.
- A read-only zero-row query on production Supabase confirmed the three-source audit union is structurally valid without retrieving any events or applying a migration.
- The current repository tree resolves imports for **11** modified application, Worker and test entrypoints; **0 broken local imports** found in that targeted scan. This does not prove Vite JSX compilation or authenticated behavior.
- The 79-route stringent acceptance gate currently produces **115 findings** (79 route evidence, 31 backend authorization evidence, 3 placeholders, 1 unknown admin integrations destination, 1 residual ComingSoon reference). It correctly blocks all Pages builds. No route was marked accepted solely because source code exists.

**Deferred to integrated release:** apply the audit migration only after the complete release dependency audit, run authenticated negative-case RLS tests for non-admin/admin/super-admin identities, run full Node/Vite and browser E2E, reconcile PR #286 and PR #240, and only then trigger the single compiled preview. Live payments and withdrawals remain separately protected.
