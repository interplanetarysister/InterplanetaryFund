# iFund UX/UI Audit — November 18, 2026

**Target:** independent Interplanetary Fund on Cloudflare Pages + Supabase, [successful preview deployment](https://ad7c4a64.interplanetaryfund-migration.pages.dev); Base44 is reference-only.
**Scoring:** [88-route CSV](./ifund-88-route-provisional-scorecard-20261118.csv). Each route has four provisional 1–10 scores (organization, connective/live-readiness, style/imagery/branding, innovation/technology) and a total out of 40.
**Evidence limitation:** This is a **guest browser and code audit**, not a verified authenticated member/admin acceptance or complete visual accessibility audit. Image screenshots were not retained or individually inspected. Styles are therefore provisional; do not treat scores as certified visual quality.

## Scope and results

- 88 registered route patterns, covering 53 public, 23 member, 5 admin, and 7 super-admin routes. One route can represent many resource-specific URLs.
- Preview browser routes were loaded in Chromium for public and protected routes, including sample invalid identifiers. All browser visits returned HTTP 200 because of SPA routing; **HTTP 200 alone does not imply feature success**.
- Guest gates appeared on the member/admin/super-admin areas. Protected content was not exposed to an unauthenticated visitor. Role elevation/authorization checks **remain untested**.
- Live exercises: homepage link to /create, three-stage creator UI, Help Center search input, registration consent UI, legacy redirects to their target pages, public feeds, Discover, Globe, news, blogs, institutions and policies. No campaign was published, donation captured, account created, or admin change performed.
- Initially empty /discover, /create, /social renders became populated after ~2 seconds of hydration; **not persistent blank pages**, but worth investigating as a loading/performance UX issue.
- The /plans page showed a real error: **"Provider-verified subscription catalog is temporarily unavailable."** The UI calls /api/payments/subscriptions/plans and correctly refuses to invent verified pricing. The backend obtains provider data via signed ledger API; investigate preview Worker routing and provider/ledger readiness before enabling purchases.
- Routes with fake IDs (e.g. /blogs/123, /community/123, /publications/123, /u/123) displayed controlled unavailable/error states. Those are **negative-path tests only**; real-record loads remain unverified.
- Home/About had invalid nested link+button CTAs; candidate fixes replace them with a single interactive anchor through Button asChild, and add the missing main content landmark. Added apps/web/tests/landing-cta-semantics.test.mjs.
- 67 lazy imports exist, 88 router declarations agree with inventory, and source guards for the 35 protected routes were structurally present. These are compilation/source checks, not proof of operational readiness.
- Successful earlier preview build of this candidate (commit e4277e0) passed 34 root tests, 886 web tests, Vite and Pages Functions compilation. The later accessibility improvements require their own build.

## Scorecard interpretation

The full CSV records **provisional assessment estimates**, not 88 personally exercised visual/style ratings. A low connectivity score for a protected screen represents **missing authenticated verification**, **not a demonstrated failed admin page**. Redirect aliases are rated for navigation structure rather than unique screens, and invalid-ID pages for their defensive fallback. No brand/image score should be interpreted as independently verified screenshot quality.

**Mean provisional scores** (route-weighted): organization **6.7/10**; connective/live-readiness **5.0/10**; style/imagery/branding **6.6/10**; innovation/technology **5.5/10**. These depend on the explicit scoring assumptions in the CSV, and should be replaced with measured scores after real member/admin, mobile and screenshot review.

## Highest priority defects and follow-up tests

1. **P1 — Plans integration failure:** confirm HTTP status/body of /api/payments/subscriptions/plans on preview and the ifund-payments Worker, inspect signed ledger dependency and provider readiness; no fake catalogue or payment simulation.
2. **P1 — Authenticated functional coverage:** run account login, save/edit/publish campaign, media upload, guest-to-owner draft transition, socials, giving history, and agents against a real authorized test user with nonfinancial fixtures.
3. **P1 — Admin acceptance:** sign in as actual super-admin; verify navigation, roles, audit feed, moderation actions, content publishing/drafts, integrations, deletion queue and operations metrics; ensure role scoping/denial for ordinary users. No admin session was available during this run.
4. **P2 — Loading states:** /discover, /create, /social initially showed empty shell before hydration; add explicit accessible loading feedback and measure startup performance.
5. **P2 — Accessibility:** repair Home/About interactive nesting and main landmarks (committed); run automated keyboard/focus and accessibility scans on desktop and mobile, inspect actual screenshots and media contrast.
6. **P2 — Page-level dynamic data:** test legitimate campaign/article/member IDs, not only invalid-ID fallbacks, including publication and partner links.
7. **P2 — Route inventory:** 14 source-ready, 74 source-unverified at the last check; do not automatically upgrade the remaining routes merely because a component exists.

## Release discipline

- Source branch: `integration/ux-release-candidate-20261118`.
- Do not modify Base44 or the hackathon judging artifact.
- Keep Cloudflare production untouched pending approved preview/browser and authenticated acceptance.
- No production donation/payment/payout tests are authorized by this audit.
