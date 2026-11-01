# Original Interplanetary Fund platform — authoritative parity baseline

**Reference repository:** `interplanetarysister/interplanetary-fund2`  
**Reference branch:** `main`  
**Reference App.jsx blob:** `2c7926c47f5469c834d5d0f044181bd7255d8b84`  
**Reference model:** the original Base44-backed Interplanetary Fund platform and its exported source, not the reduced independent migration preview.  
**Purpose:** prevent the newer/reduced migration implementation from silently redefining the product.

## Authority and comparison rules

1. Treat the original `interplanetary-fund2/main` source and the original Base44 export as the product-behavior, page, content, interaction, and visual reference.
2. Treat `interplanetarysister/InterplanetaryFund` as the independent replacement implementation. Its current UI is not the definition of parity.
3. Do not delete, simplify, replace, or mark an original feature as obsolete merely because it is absent from the migration preview.
4. A port is complete only when the replacement demonstrates equivalent page purpose, layout/content, responsive/mobile behavior, interactions, authorization, persistence, and integration behavior. A route placeholder or static page does not satisfy functional parity.
5. Keep original product behavior separate from platform-specific implementation. Replace Base44 services with Supabase/Cloudflare equivalents while preserving user-visible behavior and documented business rules.
6. Where source behavior depends on secrets, provider accounts, production data, or owner/legal decisions, mark it blocked and preserve the behavior contract. Do not invent substitute behavior.
7. Any later product change must be separately identified and authorized; it must not be smuggled into migration parity work as an assumed new source of truth.

## Original route inventory

The original router declares **58 explicit routes**, plus a catch-all not-found route. This is a route inventory, not a claim that each route has been runtime-tested.

### Public and account entry
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/globe`
- `/embed/campaign/:id`
- `/oauth/consent`
- `/activate`
- `/`
- `/about`
- `/founding-members`
- `/terms`
- `/privacy`
- `/contact`

### Public discovery and community
- `/discover`
- `/campaign/:id`
- `/community`
- `/community/:id`
- `/u/:id`
- `/social`
- `/blogs`
- `/blogs/:id`
- `/publications/:id`
- `/help`
- `/help/:slug`

### Signed-in member workspace
- `/onboarding`
- `/dashboard`
- `/create`
- `/giving`
- `/communications`
- `/mission`
- `/ai-images`
- `/institutions`
- `/institutions/:id`
- `/profile`
- `/my-blog`
- `/devices`
- `/connections`
- `/inbox`
- `/following`
- `/notifications`
- `/donors`
- `/ledger`
- `/subscriptions`
- `/withdrawals`
- `/agents`

### Administrative and integration surfaces
- `/admin/organization-mail`
- `/ops`
- `/platform`
- `/analytics`
- `/connect`
- `/admin/external-accounts`
- `/admin/integrations`
- `/admin/audit`
- `/admin/agent-api`
- `/admin/sustainability`
- `/admin/help`
- `/admin/founding-members`

The router also has a `*` catch-all. It includes public routes, authenticated routes, and routes nested under the admin authorization boundary; route existence must not be mistaken for unrestricted access.

## Original source inventory

The migration status/inventory recorded against the read-only source includes:
- 95 entity contracts.
- 184 backend function entrypoints.
- 11 connectors/integrations.
- 10 agents.
- 17 workflows.
- 364 frontend files statically inventoried.
- A 57-page page-parity ledger.

These are inventory counts, not proof that all runtime behavior has been ported. Each entity, function, connector, agent, workflow, and page needs its own contract and verification evidence.

## Original user-facing behavior evidenced in source pages

### Home / landing
The original Home page includes the Interplanetary Fund story and product proposition, brand/hero artwork, founding/prelaunch context, PayPal donation CTA, fundraising-mode messaging, quick actions, mobile bottom navigation, and legal footer. The original page's composition and content must be compared directly; a generic hero/feed is not an equivalent replacement.

### Campaign discovery
The original Discover page includes campaign search, category filtering, recommended campaigns, comparison selection, help-center access, pull-to-refresh, loading skeletons, and page-level error handling. A plain list of active campaigns is only a subset.

### Campaign detail
The original CampaignDetail composes donation dialog, campaign translation, funding card, sharing kit, cross-platform totals, Cash App and crypto settings, campaign health, imported-campaign sync, AI coach, updates, edit dialogs, deletion, outreach agent, distribution panel, follow controls, and mobile pull-to-refresh. Each function requires a replacement contract and appropriate authorization/payment safety. Merely showing a title, story, and goal is not parity.

### Community
The original Community page includes a live activity feed, joinable communities, membership state, community-type filtering, search, tabs (including feed/communities/stories), create-community flow, cards, page tips, and guest-vs-member behavior. A public text-post feed alone is not parity.

## Current independent preview comparison (observed from source)

The independent migration `src/App.jsx` currently declares these **12 explicit routes**, plus a catch-all:
- `/`
- `/discover`
- `/campaign/:id`
- `/create`
- `/edit/:id`
- `/mine`
- `/login`
- `/connections`
- `/community`
- `/blogs`
- `/blogs/:id`
- `/my-blog`

That is **12 explicit routes versus 58 original explicit routes**. It is a reduced preview, not the original platform. The 57-page parity ledger is a separate page inventory count, not the route count. The earlier Phase 5 parity ledger independently recorded 3 static ports, 10 partial equivalents, and 44 not ported (57 page entries); those categories are not functional-parity signoff.

## Required parity gates

- **Routes/navigation:** every original route, route parameter, protected/admin boundary, deep link, not-found behavior, and navigation entry is accounted for.
- **Visual/content:** compare original source and original Base44 live UI screenshots/content against the independent site at desktop and mobile breakpoints; retain brand, page hierarchy, copy, controls, empty/loading/error states, and accessible interactions unless a documented authorized change says otherwise.
- **Campaigns/donations:** create/edit/draft/publish, public discovery, campaign detail, funding totals, follow/share, import/sync, donor journeys, PayPal, crypto/Cash App behavior, receipts, ledger, disputes, subscriptions, and withdrawals are individually verified without real financial transactions.
- **Identity/access:** sign-up, login, recovery, OTP/OAuth, account status, roles, owner mapping, admin boundaries, consent, and deep-link return behavior.
- **Community/social/content:** community creation/membership, stories, feed, comments/updates where present in source, blogs/publications, profiles, messaging, notifications, and moderation.
- **Agents/workflows/integrations:** all source definitions mapped; trigger contracts, permissions, schedules, execution, retries/idempotency, audit logs, OAuth, provider callbacks, and external sync verified safely.
- **Data/media:** source row counts, IDs, digests, ownership, references, media assets, and cross-feature relations reconciled before production promotion.
- **Mobile/accessibility:** original mobile navigation and touch behaviors, responsive layouts, keyboard/screen-reader semantics, captions/transcripts, and supported app packaging verified.
- **Release:** tests/build/CI on the exact proposed merge commit, free capacity verified before any runner/deployment, reviewed diff, rollback point retained, and live route/runtime smoke tests after authorized deployment.

## Current branch relationship

At the latest comparison, `fix/public-column-projections-main-20261101` was **8 commits ahead and 0 behind** `main`, with merge base `471bbe73b6ca6bf0c6173a85d655c9f6b35e4793`. Recheck this immediately before opening/merging a PR; do not force-push or rewrite main. If main advances, incorporate it using a normal merge/rebase on the repair branch and re-run exact-head validation. This branch is a narrow permission hotfix, not a full parity implementation.

## Verification status

This document is a source-code comparison baseline. It does not claim that the original Base44 runtime was accessible in this session, that all pages were visually inspected, that all route handlers are live, or that the replacement has achieved parity. The public production site could not be fetched from the current network environment; authenticated access was not available. Record those as verification blockers, not as passes.
