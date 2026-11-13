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
2. JavaScript-level execution of the release preflight using actual branch `App.jsx`, `Layout.jsx`, and acceptance JSON yielded **86 blocking reasons** at the earlier 76-route checkpoint. The new guarded sustainability route replaces one missing navigation destination with a new, still-unverified acceptance entry. The retired founding-members waitlist admin link was also removed. Re-run the gate after each source change. This is a logic check in an isolated V8 context, **not** `node --test` or a Vite build. It is expected to fail until completion.
3. New targeted source-level Node tests were committed, **not executed** against a full checkout. Do not mark them PASS.
4. Source checked and changed only; **no** Cloudflare Pages preview/production build, Worker deploy, database write, R2/media mutation, PayPal transaction, GitHub Actions dispatch, DNS change, or Base44 mutation was performed.
5. Keep issue #203 as the parent migration coordination issue; avoid overlapping PR #286 Connections work. Source-ready entries in the 77-row matrix must name their specific automated tests and negative-case evidence. Neither a green static gate nor a preview HTTP 200 can prove all pages bug-free.

**Read-only Cloudflare configuration evidence:** Pages project `interplanetaryfund-migration` has `deployments_enabled=false`, `production_deployments_enabled=false`, and `preview_deployment_setting=none`; the recent successful previews listed belong to the **separate** `feature/connections-icon-hub-20261112` branch, not to this route-completion branch. No build was triggered by this work.

**Updated preflight:** 77 route records, 3 ComingSoon paths, 4 unresolved navigation paths, and 1 residual ComingSoon component => **85 blocking findings** in an isolated JS-level gate evaluation. No actual Node/Vite or browser-suite execution was claimed.

**Release decision: HOLD.** No unverified route is accepted. Source implementation and consolidated QA continue before preview.
