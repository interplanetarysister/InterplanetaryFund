# iFund Site-wide UX Score Uplift — implementation plan

Baseline: [88-route November 18 audit](./ifund-88-route-provisional-scorecard-20261118.csv). Its organization 6.7, connectivity 5.0, style 6.6, innovation 5.5 are **provisional route-weighted estimates**, not verified visual or authenticated acceptance. Do not rewrite the baseline or claim higher scores merely because code is present.

## Phased implementation

| Phase | Implemented target | Scope | Evidence required for completion |
|---|---|---|---|
| 1. Wayfinding | Shared skip-to-main, stable route identity, page-sensitive Help Center on both desktop and mobile, lower-distraction transitions | Member and admin layout | Browser navigation, tab focus, no double landmarks |
| 2. Perceived performance | Accessible branded skeleton for slow lazy-page loading | All router lazy routes | Slow-network browser check, no blank shell, no indefinite spinner |
| 3. Creator organization | Preserve exactly three essential steps; progressive-disclose agents, AI drafting, documents, external-platform handoff and optional location | /create | Guest tab/navigation, offline draft and owner save tests, preserve input data while expanding/collapsing |
| 4. Payment transparency | Bound subscription catalog fetch time; fail closed and provide clear retry/help/contact; never invent pricing or subscription eligibility | /plans | Provider-backed API restored and verified, live/sandbox separately checked |
| 5. Trust and branding | Theme-consistent route error recovery and accessible help links | Routed pages | Mobile + desktop visual comparison, keyboard navigation and error injection |
| 6. Release | New focused tests, complete root/frontend suites, Vite + Pages Functions build, preview smoke | Cloudflare preview | Green build and browser evidence; production deliberately unchanged |

## Follow-up work not silently declared complete

- Validate a real authorized ordinary-user login and admin/super-admin login, role boundaries and write paths, without test financial transactions.
- Verify /api/payments/subscriptions/plans and signed-ledger provider dependency end-to-end; no fabricated pricing or paid enrollment until verified.
- Visual screenshot review on 390px mobile and 1280px desktop, focus/keyboard tests, real-record campaign/article IDs, API response contracts, AG Charts rendering, media and AI agent jobs.
- Re-score every route based on actual runtime evidence; maintain `unverified` instead of assigning false success.
- Keep Base44 and judged hackathon artifacts read-only. All implementation targets the canonical Cloudflare/Supabase app.
