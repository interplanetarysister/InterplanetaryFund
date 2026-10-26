# Phase 5 — all source pages, independent frontend

Original canonical source: `interplanetarysister/interplanetary-fund2/src/App.jsx` (read-only). Target: `interplanetarysister/InterplanetaryFund` PR #156 on `migration/phase5-all-page-routes-20261026`, stacked on original-shell recovery PR #155. Authority: #137.

## Honest completion criteria

- **URL coverage:** 58 / 58 patterns mounted (when build passes) and accessible under correct guest/member/admin path-level guards.
- **Current independent user interface:** 10 previously implemented independent page patterns plus 11 additional independent UI patterns with narrow verified/safe functionality.
- **Incomplete backend/full visual parity:** 37 page routes have accessible, distinct, context-aware limited screens, **not fully ported source features**. The original functional 57-file page composition, 184 backend functions, 95 entities, agents/workflows, historical media and financial truth remain outside this PR.
- **Release:** NOT APPROVED for production; no automatic merging or DNS switching. All 7 gates from #137 still apply. Production funds, receipt and donor data must never be invented from cached snapshots.

## Full route-by-route ledger

| Source path | Access | Current implementation |
| --- | --- | --- |
| `/login` | public | Existing independent page (partial) |
| `/register` | public | Restored independent UI (provider/data gates pending) |
| `/forgot-password` | public | Restored independent UI (provider/data gates pending) |
| `/reset-password` | public | Restored independent UI (provider/data gates pending) |
| `/globe` | public | Independent limited page (original service unported) |
| `/embed/campaign/:id` | public | Restored independent UI (provider/data gates pending) |
| `/oauth/consent` | public | Independent limited page (original service unported) |
| `/activate` | public | Independent limited page (original service unported) |
| `/` | public | Existing independent page (partial) |
| `/about` | public | Existing independent page (partial) |
| `/founding-members` | public | Independent limited page (original service unported) |
| `/terms` | public | Existing independent page (partial) |
| `/privacy` | public | Existing independent page (partial) |
| `/contact` | public | Independent limited page (original service unported) |
| `/admin/organization-mail` | admin | Independent limited page (original service unported) |
| `/discover` | public | Existing independent page (partial) |
| `/campaign/:id` | public | Existing independent page (partial) |
| `/community` | public | Existing independent page (partial) |
| `/community/:id` | public | Restored independent UI (provider/data gates pending) |
| `/u/:id` | public | Restored independent UI (provider/data gates pending) |
| `/social` | public | Independent limited page (original service unported) |
| `/blogs` | public | Independent limited page (original service unported) |
| `/blogs/:id` | public | Independent limited page (original service unported) |
| `/publications/:id` | public | Independent limited page (original service unported) |
| `/help` | public | Restored independent UI (provider/data gates pending) |
| `/help/:slug` | public | Restored independent UI (provider/data gates pending) |
| `/onboarding` | member | Restored independent UI (provider/data gates pending) |
| `/dashboard` | member | Restored independent UI (provider/data gates pending) |
| `/create` | member | Existing independent page (partial) |
| `/giving` | member | Independent limited page (original service unported) |
| `/communications` | member | Independent limited page (original service unported) |
| `/mission` | member | Independent limited page (original service unported) |
| `/ai-images` | member | Independent limited page (original service unported) |
| `/institutions` | member | Independent limited page (original service unported) |
| `/institutions/:id` | member | Independent limited page (original service unported) |
| `/profile` | member | Restored independent UI (provider/data gates pending) |
| `/my-blog` | member | Independent limited page (original service unported) |
| `/devices` | member | Independent limited page (original service unported) |
| `/connections` | member | Existing independent page (partial) |
| `/inbox` | member | Independent limited page (original service unported) |
| `/following` | member | Independent limited page (original service unported) |
| `/notifications` | member | Independent limited page (original service unported) |
| `/donors` | member | Independent limited page (original service unported) |
| `/ledger` | member | Independent limited page (original service unported) |
| `/subscriptions` | member | Independent limited page (original service unported) |
| `/withdrawals` | member | Independent limited page (original service unported) |
| `/agents` | member | Independent limited page (original service unported) |
| `/ops` | admin | Independent limited page (original service unported) |
| `/platform` | admin | Independent limited page (original service unported) |
| `/analytics` | admin | Independent limited page (original service unported) |
| `/connect` | admin | Independent limited page (original service unported) |
| `/admin/external-accounts` | admin | Independent limited page (original service unported) |
| `/admin/integrations` | admin | Independent limited page (original service unported) |
| `/admin/audit` | admin | Independent limited page (original service unported) |
| `/admin/agent-api` | admin | Independent limited page (original service unported) |
| `/admin/sustainability` | admin | Independent limited page (original service unported) |
| `/admin/help` | admin | Independent limited page (original service unported) |
| `/admin/founding-members` | admin | Independent limited page (original service unported) |

## Functional replacements in this PR

- Home, discovery, community, existing campaign detail/editor and my campaigns retain their independent Supabase-backed implementations, with request-failure empty/error handling.
- Dashboard reads verified owned campaign rows. Profile reads and upserts account-owned handle and display name with input validation and readback verification. No fake balances, donor counts or AI output.
- Connections reads only the user's `ifund_connections` rows. Connected status needs both `status='connected'` and a non-null `verified_at`; no unverified connect or charge actions.
- Help Center has searchable independent introductory topics. Community post, public profile, and campaign embed pages read from RLS-scoped tables and do not fabricate missing legacy records.
- Account registration and recovery screens default to **off**; production enablement requires independent auth/email/RLS tests. OAuth consent and device activation remain inoperative without signed states and provider callbacks.
- Member/admin remaining pages explain the missing source data/provider capability rather than silently failing, 404-ing, exposing privileged data or reporting success.

## Next required implementation (not waived by a mounted route)

1. Port all source page components and their independent React service replacements; for each page verify visual parity on Android/mobile and desktop, accessibility, light/dark surfaces, and original brand assets.
2. Complete 95-entity schema migration, auth user ownership, 184 function entrypoints and real RLS testing against the canonical project; do not make private cached user records public.
3. Restore help content, media, institutional data, notifications, community discussions, messages, onboarding writes and AI specialist workflows only when their persistent APIs are verified.
4. Restore financial pages with real PayPal merchant identity, webhooks, fee rules, immutable verified ledger, approved Payouts, and sandbox tests before enabling real transactions.
5. Verify canonical Cloudflare Pages+Workers service deployment is independent of Base44 before live cutover; maintain DNS/mail and rollback procedures.

No Base44 SDK is imported into newly added page modules, no source repository was changed, and no database/payment/provider mutations are necessary for this code-only phase.

## Additional original frontend recovery (2026-10-26)

- Source narrative restored from read-only original `Home.jsx`: exact core hero text, all nine expandable story sections, full About text, founding members call to action, guest/member CTAs.
- Mobile header back arrow, notifications deep-link and original `AI Team | Profile | IFund Social | Forums` dock; signed-out private tabs route to sign-in. Responsive/light-dark card styling.
- Original local static SVG brand icon and nine platform logo SVGs copied from source; no Base44-hosted runtime image dependency added. The original binary JPG logo and remote historical nebula bitmap have **not** been copied (GitHub text connector does not transfer binary); CSS planetary graphic is a visual approximation, not pixel-identical.
- Founding membership fields and consent/referral handling ported. Its `ifund_join_founding_waitlist` RPC is a **required missing backend contract**: the form is disabled until `VITE_IFUND_FOUNDING_ENROLLMENT_ENABLED=true` and a verified server RPC with abuse limits/consent logging exists.
- Campaign editor now has four navigable stages (Your Details, Basics, Your Story, Launch) but retains existing draft and publish logic. Missing AI five-choice, Story Forge, upload/watermark services display disabled controls honestly.
- Campaign detail now includes public campaign link, native share, Facebook/X share and copyable iframe markup for active campaigns only. It does not authorize donations.
- Independent sign-in screen branded and default disabled via `VITE_IFUND_AUTH_SIGNIN_ENABLED` until provider configuration/identity linking; `shouldCreateUser:false` avoids implicit orphan account creation. Return-to redirects are restricted to same-origin app paths.
- These are **frontend-only** changes pending desktop/mobile screenshot comparison, live Auth/RLS data, and media/payment/provider verification. No production deployment.

### Verified original-logo asset recovery — 2026-10-26

- Recovered `public/ifund-logo.jpg` from the owner's original exported ZIP in the connected file library. Generated a lightweight 96×96 WebP derivative for IFund's small navigation and favicon, transferred it to GitHub without Base44 CDN dependence, and **verified exact Git blob SHA `4258c5409b39e248c4396219d24de29ca686a4bb`** against the local source-derived file before updating the repository.
- Independent navigation and favicon use `public/ifund-logo-small.webp`. The legacy source's full 1024×1024 JPG and remote hero bitmap have not been transferred; the CSS atmospheric hero remains a source-informed approximation.
- Replacement failed-length unverified JPG was deleted. No production deployment or provider change was made.

## Historical 59th route: Download IFund

A source maintenance branch `maintenance/ifund-install-brand-ci` added `/download` and `DownloadApp.jsx` ([original PR #533](https://github.com/interplanetarysister/interplanetary-fund2/pull/533)). Source main had 58 paths, while the maximum across inspected branches is 59; live deployment of the extra route is not verified. The migrated `/download` page now handles actual browser-provided web app installation prompts, documented manual installation, and an independent web manifest. Android APK distribution remains blocked until a signed public release is verified.
