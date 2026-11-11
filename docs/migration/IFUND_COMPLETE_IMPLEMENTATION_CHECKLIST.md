# IFund complete implementation and acceptance checklist

**Canonical tracker:** [GitHub issue #203](https://github.com/interplanetarysister/InterplanetaryFund/issues/203) · **Target:** https://interplanetaryfund.com · **Reference:** original Base44 application and interplanetary-fund2 main · **Last baseline:** 2026-11-10.

**Legend:** `- [ ]` not independently accepted; `- [x]` independently verified with recorded evidence; 🟠 = corresponding Base44 version also needs implementation, repair, or parity verification. Orange marks scope, **not** proof that Base44 is broken. The route list is grounded in `apps/web/src/App.jsx` and `Layout.jsx`; root `src/App.jsx` is a second frontend to reconcile. Named route patterns may share one acceptance task. **No task is pre-checked solely because source code exists.**

**Update protocol:** Work top-down by dependency, but unblock payment sandbox first for hackathon. After each tested implementation, change only its checkbox to `[x]`, append a dated evidence line with SHA/deployment/test output, and link issue #203. If a test fails, leave unchecked and document blocker. Do not claim production-ready without real capture and ledger reconciliation. Financial release, DNS and Base44 retirement remain separately gated. No TinyFish, paid Base44 builder/agents, live buyer funds for sandbox tests, fabricated receipts or credit-spending operations.

**Total acceptance tasks:** 71. **Initial checked:** 0; this is a prospective acceptance matrix, not a claim that all 71 are broken.

## 01 — Baseline, inventory and release controls

- [ ] **01.01** Inventory every route in apps/web/src/App.jsx, nav links, redirects, and root src/App.jsx; reconcile the actual Pages build target
- [ ] **01.02** Inventory all Base44 pages, functions, workflows, feature flags and original interplanetary-fund2 assets; map to Cloudflare/Supabase equivalents 🟠
- [ ] **01.03** Create route-by-route acceptance matrix with owner, component, backend endpoint, RLS policy, automated test, and screenshot evidence 🟠
- [ ] **01.04** Confirm Cloudflare Pages production/preview build source, custom domains, redirects, environment separation and rollback
- [ ] **01.05** Establish preview-first CI gates, test fixtures, secrets inventory, $0 cost guardrails and release checklist

## 02 — Global design, navigation and accessibility

- [ ] **02.01** Restore cosmic homepage background, polished icons, typography and mobile-first responsive shell 🟠
- [ ] **02.02** Verify every header, sidebar, bottom tab, drawer, back button, deep link and loading/error/empty state 🟠
- [ ] **02.03** Verify legal/footer, subtle separate platform-support link and no misleading donation calls to action 🟠
- [ ] **02.04** Test keyboard focus, screen readers, contrast, safe areas, swipe, long content, reduced motion and 320px viewport 🟠

## 03 — Public and marketing routes

- [ ] **03.01** / — homepage: campaign discovery, AI messaging, background, platform donation and correct calls to action 🟠
- [ ] **03.02** /about, /contact, /terms, /privacy — real content, forms, policy links and responsive layout 🟠
- [ ] **03.03** /founding-members, /download — valid membership/app content, download links and safe states 🟠
- [ ] **03.04** /help and /help/:slug — searchable help content, real article routes, no dead links 🟠
- [ ] **03.05** /hackathon — evidence of real AI feature and verified PayPal sandbox checkout, not visual-only demo
- [ ] **03.06** /p/:slug — published Studio pages render only authorized public content

## 04 — Identity, accounts and permissions

- [ ] **04.01** /login, /register, /forgot-password, /reset-password, /auth/callback — password and OAuth redirect flows 🟠
- [ ] **04.02** /onboarding, /activate, /oauth/consent — replace ComingSoon with real consent/onboarding flows 🟠
- [ ] **04.03** /profile, /u/:id — owner editing, public profile visibility and privacy controls 🟠
- [ ] **04.04** /dashboard — correct authenticated member data, navigation and owner summaries 🟠
- [ ] **04.05** Verify Google/GitHub OAuth, email delivery, password reset return URL, session refresh and logout 🟠
- [ ] **04.06** Verify verified super-admin and admin RBAC server-side; never bypass authentication or expose private data 🟠
- [ ] **04.07** Allow guests to browse and explore campaign wizard; require login only for save/post, restore draft afterward 🟠

## 05 — Campaign creation, discovery and ownership

- [ ] **05.01** /create — mobile-first step wizard, guest preview, save draft, resume, edit, preview and publish 🟠
- [ ] **05.02** AI story forge — five titles, two short descriptions, one full story at a time; section regeneration; AI output minimum two paragraphs/1000 characters only 🟠
- [ ] **05.03** AI image upload, improvement and new artwork with futuristic/interstellar/cyberpunk/comic styles and secure storage 🟠
- [ ] **05.04** /campaigns and /campaigns/:id/edit — owner-only management, pause, resume, publish, delete, moderation 🟠
- [ ] **05.05** /campaign/:id — story, images, organizer, donation near top, progress, follow/share and accessible states 🟠
- [ ] **05.06** /discover — search, category filters, location, pagination, empty states and correct public RLS 🟠
- [ ] **05.07** /globe — replace ComingSoon with interactive Earth campaign map and location consent 🟠
- [ ] **05.08** /embed/campaign/:id — accessible embeddable campaign card and copyable iframe 🟠
- [ ] **05.09** Import Base44 campaigns with verified owner mapping, deduplication, media, status and audit trail 🟠
- [ ] **05.10** Validate campaign ownership and non-owner denial with negative tests against production-equivalent RLS 🟠

## 06 — PayPal and financial integrity

- [ ] **06.01** Inspect sandbox-compliance branch and exact deployed Worker/Pages bindings; do not infer secrets from saved client IDs
- [ ] **06.02** Verify sandbox isolation migrations, grants/RLS and real database schema before any sandbox write
- [ ] **06.03** Configure sandbox OAuth, Orders v2 create/approve/capture and verified signed webhook ID on isolated preview runtime
- [ ] **06.04** Verify sandbox order, capture and event idempotency; refunds, reversals, retries, invalid signatures and failure recovery
- [ ] **06.05** Run real PayPal sandbox buyer checkout; verify isolated receipt without changing real campaign totals
- [ ] **06.06** Audit live Worker route, real merchant bindings, PayPal webhook IDs, capture verification, reconciliation and recovery
- [ ] **06.07** Run controlled real-money transaction only after explicit financial release authorization; match PayPal capture, donation, ledger, totals and dashboard
- [ ] **06.08** /giving and /ledger — member receipts, transaction history, refunds and correct private visibility 🟠
- [ ] **06.09** /admin/finance — verified admin reporting, audit, reconciliation and no sandbox/live mixing 🟠
- [ ] **06.10** /donors — supporter visibility and privacy; replace ComingSoon 🟠
- [ ] **06.11** /withdrawals — owner-only requests, 7% platform fee at real withdrawal, processor checks; no activation before gates 🟠
- [ ] **06.12** /subscriptions — plans, entitlement enforcement, PayPal recurring webhooks, cancellations and refunds 🟠
- [ ] **06.13** Keep live payment gateway fail-closed until verified; never fake successful captures or activate withdrawals

## 07 — Community, publishing and communications

- [ ] **07.01** /social and /community — public feed, posting, reactions, moderation and permissions 🟠
- [ ] **07.02** /community/:id — replace ComingSoon with working community detail 🟠
- [ ] **07.03** /blogs, /blogs/:id, /my-blog, /publication, /publications/:id — authoring, draft, publication and public read 🟠
- [ ] **07.04** /following — followed campaigns list, persistence and swipe browsing 🟠
- [ ] **07.05** /notifications, /inbox, /communications — delivery, unread state, sync and member-only data 🟠
- [ ] **07.06** /connections and /connect — provider OAuth, consent, encrypted credentials and revoke/disconnect 🟠
- [ ] **07.07** /institutions and /institutions/:id — working public directory and institutional profile 🟠

## 08 — AI, automation and integrations

- [ ] **08.01** /agents, /mission, /ai-images — replace placeholders and implement actual specialist AI chat, job lifecycle and media tools 🟠
- [ ] **08.02** /devices, /ops, /platform, /analytics — functional scoped pages and data, not ComingSoon 🟠
- [ ] **08.03** Cloudflare Worker handoffs, workflows, triggers, queues, retries, observability and idempotent scheduling 🟠
- [ ] **08.04** Replace every remaining Base44 runtime dependency with independent Cloudflare/Supabase service 🟠
- [ ] **08.05** Implement consent-aware distribution, QR/sharing, universal inbox, and external account rate-limit handling 🟠
- [ ] **08.06** Validate volunteer/grant forms, email ingestion, records, and honest failure/success responses 🟠

## 09 — Administration and Studio

- [ ] **09.01** /admin/studio — editor, draft/publish, permissions and public /p/:slug rendering 🟠
- [ ] **09.02** /admin/integrations, /admin/audit, /admin/sustainability, /admin/help, /admin/founding-members — real admin modules 🟠
- [ ] **09.03** /admin/* — replace catch-all ComingSoon with explicit authorized routes or intentional 404 🟠
- [ ] **09.04** Audit super-admin identity mapping, audit logs, moderation, abuse controls and operational incident recovery 🟠

## 10 — QA, release and Base44 parity

- [ ] **10.01** Unit/integration tests: auth, every page, Supabase RLS, payment ledger, webhook negative tests and workflow failure paths 🟠
- [ ] **10.02** Browser E2E on phone/tablet/desktop for guest/member/owner/admin, including deep links and refresh 🟠
- [ ] **10.03** Check every placeholder and nav route; no broken links, misleading success notices or unimplemented action buttons 🟠
- [ ] **10.04** Compare representative pages and original Base44 flows side by side; repair deviations 🟠
- [ ] **10.05** Confirm Base44 counterpart items marked 🟠 work independently without consuming builder/message credits 🟠
- [ ] **10.06** Deploy preview, inspect logs and smoke-test all critical journeys; document screenshots and evidence
- [ ] **10.07** Review DNS, payment toggles, secrets, backup/rollback and security; obtain release authorization for financial activation
- [ ] **10.08** Deploy production, re-run live smoke tests and monitor error rates; retain Base44 until parity and cutover sign-off
- [ ] **10.09** Publish final report: commit SHA, deployed URLs, migrations, test evidence, unresolved blockers and release decision

## Evidence log

- **2026-11-10 baseline:** Route inventory inspected from `apps/web/src/App.jsx`, `apps/web/src/components/Layout.jsx`, and root `src/App.jsx`. Numerous `ComingSoon` route patterns remain. Cloudflare production Pages deployment at commit `08ce8eef48416bcdd5d4d6d2f92f31a2e296c15b` reported success; Base44 build reported ready; Supabase payment ledger Edge Function active. **These observations do not complete the above acceptance tasks.** Live payment Worker was observed disabled, and live donation/payment intent/ledger counts were zero. Direct Base44 sandbox-bridge editing is blocked by Builder plan; avoid spending builder/message credits.

## Cross-conversation handoff

Say: **“Continue the IFund implementation checklist in `docs/migration/IFUND_COMPLETE_IMPLEMENTATION_CHECKLIST.md` under GitHub issue #203. Update checkboxes only after verification, and append evidence.”** This file on the repository default branch is the durable source of truth, not chat memory. Update it whenever work is completed or requirements change.
