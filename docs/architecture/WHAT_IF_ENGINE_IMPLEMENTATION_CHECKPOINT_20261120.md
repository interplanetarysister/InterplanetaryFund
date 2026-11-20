# What If? Engine — implementation checkpoint (2026-11-20 UTC)
Scope: owner-directed Mission-first experience. Do not confuse source commits, installed database, provider runtime and actual public deployment.

## Canonical integrated source
Branch: \`feature/what-if-engine-integrated-20261120\` in \`interplanetarysister/InterplanetaryFund\`.
Integrated from current \`main\` while preserving latest Dashboard/FollowFeed/agent-chat and speech-source changes; **do not use the older diverged** \`feature/what-if-mission-db-20261119\` branch for promotion.
Canonical web frontend: \`apps/web\`. Shared Worker router: \`worker/index.js\`. Bound standalone AI service: \`workers/ifund-agent-question/index.mjs\`.

Implemented source-level UI:
- When \`VITE_IFUND_WHAT_IF_ENABLED=enabled\`, homepage renders a prompt entry, dashboard and navigation link to Missions, and \`/create\` redirects to \`/what-if\` except \`?manual=1\` or \`?draft=<existing>\`.
- Guest prompt is transferred to the What If page via **React Router state**, never a query string. Explicit sign-in intent may put prompt into sessionStorage for <=24h; **no automatic account save**.
- \`/what-if\` — explore provisional planning, save private Mission after verified user and terms.
- \`/missions\` — private owner-scoped Mission list.
- \`/missions/:id\` — private editable title, reviewed plan and version history, first-plan checklist, task completion, manual task addition and optional fundraiser.
- \`/create?manual=1&mission=<owned ID>\` preserves old campaign creator and may prefill only a *blank* editor from same-owner Mission. After account save, \`ifund_mission_link_owned_campaign\` securely associates it. Fundraising, PayPal and provider-host checkout remain separate from private Mission notes.
- Direct routes remain gated off until the frontend launch flag is explicitly configured. All existing draft and manual editor routes remain reachable.

## Installed Supabase database
Production project ref \`ssibsfmtodgximseeqsv\`; 9 RLS-protected Mission tables. Exact checked-in migration versions:
- \`20261120042045\`: Mission schema
- \`20261120042253\`: query-optimized RLS and indexes
- \`20261120101807\`: atomic reviewed plan RPC
- \`20261120102004\`: same-owner campaign link RPC
- \`20261120102343\`: initial tasks populated when first plan saved
- \`20261120103337\`: draft -> planned transition on reviewed plan
- \`20261120103902\`: private audit triggers for creation, changes, plan/task and campaign link

Owner-reviewed plans are non-financial worksheets, not grant verification. Plan writes are atomic and idempotent on request UUID; stale revisions fail. Task progress is never overwritten by newer plans. Audit events have safe generic summaries, never raw private prompts.

Verification observed:
- 9/9 Mission tables have RLS; \`anon\` cannot select Mission data or call plan/campaign RPCs.
- Authenticated members may invoke those two \`SECURITY DEFINER\` RPCs; **each** derives \`auth.uid()\` itself, verifies current terms and active identity, and restricts Mission/campaign ownership. The Supabase security advisor flags authenticated definer calls as needing review **by design**; two-user negative browser/API tests remain mandatory.
- Mission rows: 0; task rows: 0; event rows: 0. No customer data was inserted as part of this build.
- Postgres migration SQL was transactionally checked before application; no financial or existing campaign tables were changed.

## Worker and platform connectivity
- \`POST /api/missions/explore\`: deterministic, provisional, no provider calls or persistence, gated by server \`IFUND_WHAT_IF_ENABLED=enabled\`.
- \`POST /api/missions/plan\`: verified bearer identity + active account + accepted terms + AI drafting permission + existing NEXUS usage-quota RPC; reads only owned Mission over JWT/RLS; calls Cloudflare Workers AI via bound \`IFUND_AGENT_SERVICE\`; emits **unreviewed** structured suggestions. Requires **server** \`IFUND_WHAT_IF_AI_ENABLED=enabled\` and a real \`env.AI\` binding in the standalone service.
- The frontend explicitly reviews/saves via \`ifund_mission_save_reviewed_plan\` instead of treating model output as a verified action.
- Cloudflare Pages \`interplanetaryfund-migration\` is attached to \`main\`, root \`apps/web\`, and has an existing \`IFUND_AGENT_SERVICE\` binding. The Pages project itself has **no direct Workers AI binding**. This was handled by routing to the existing standalone service. Source-only changes to the standalone worker are **not** an active deployed service.
- New features do **not** expose service-role keys to browser, create duplicate databases, activate provider OAuth, verify outside grants, publish to external platforms or move funds.
- Cloudflare Pages Git deployments remain disabled; no preview build or production publication was triggered by this feature.

## Tests and known release gates
Observed checks:
- JavaScript parser checks passed for shared Worker, standalone AI entry, Mission AI route and client API.
- Synthetic plan-model normalization checks passed: no provider-confirmed amount or action can be inferred from model text; invalid plan JSON rejected.
- Supabase read-only catalog confirmed table grants and 4 audit triggers.

Not yet proven:
- Full Vite/React JSX build; GitHub Actions minutes are unavailable this month. Do not infer successful build from source.
- Actual two-owner browser/API RLS tests, account-switch, guest-to-verified-account return, account cancellation, task/plan concurrent stale writes.
- Real Workers AI runtime binding, quota receipts and subscription tier checks.
- Preview role-based journey for guest, owner, campaign publisher, admin; external provider sandbox and mobile integration.
- End-to-end production feature publication and approved rollout.

**Release checklist:** reconcile with latest main, execute local Node 22/Vite/test suite plus Postgres/RLS tests (no Github Actions minutes); verify standalone Worker flags and AI binding in isolated preview, then one controlled Pages preview, run browser-role acceptance and rollback checks. Only after evidence-backed approval: merge and promote. Never enable the new frontend/server flags on production to skip QA.

## 2026-11-20 provenance and authorization hardening
- Applied **migration \`20261120105701_ifund_what_if_plan_provenance_and_verified_identity_guard.sql\`** to canonical Supabase. The owner-reviewed plan RPC now requires a genuinely confirmed, non-anonymous account from auth.users, in addition to active status and current terms.
- RPC canonicalizes plan JSON on the server. It retains only summary, limited steps with safe specialist names, and planning metadata; disregards arbitrary provider or financial claims even when an authenticated member sends them directly to PostgREST. Each saved step is marked \`suggested / not_checked\`; verified monetary amounts remain \`null\`; completed external actions remain \`false\`; evidence stays \`suggested_unverified\`.
- Idempotent retries compare the canonicalized JSON and still cannot create duplicate versions. No existing Mission rows needed backfill (observed 0 Mission rows before and after).
- Read-only Supabase verification: anon lacks RPC execution; member EXECUTE available under owner restrictions; installed function includes normalization and email confirmation checks. This does **not** replace an authenticated two-owner negative acceptance test, and Supabase flags intentional member-callable SECURITY DEFINER RPCs for continued review.
- Mocked member-client checks **6/6** passed: confirmed owner creation and denial for anonymous, unconfirmed-email, missing terms, foreign-owner receipt, and stale revision. Model normalization checks remain isolated source-level checks, not deployed AI acceptance.
- Latest inspected code branch \`feature/what-if-engine-integrated-20261120\` is ahead of \`main\`, with no behind commits at the last comparison. Do not assume this remains true indefinitely while agents continue parallel work.

