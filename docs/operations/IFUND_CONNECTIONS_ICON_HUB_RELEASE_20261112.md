# Connections icon hub — staging and acceptance

Target: existing Cloudflare Pages `interplanetaryfund-migration`, frontend `apps/web`, canonical Supabase `ssibsfmtodgximseeqsv`. Do not deploy to production until the full regression and sign-in tests have passed.

- Reference: Base44 Interplanetary Fund `6a67a778342a8fe05ee79cba` contains 46 platform choices, plus existing iFund Google Account added for 47 total.
- New user interface: actively connected, available to add, and saved-link counts, connected-account chips, filterable grid of 47 selectable platform icons, and one context-specific guide beneath the grid. Admin diagnostics are permission-gated.
- Connection behavior: verified OAuth only for supported accounts when enabled by the backend; saving a public profile URL is separate from account authorization. All URLs strip query strings and fragments.
- Owner-only storage: `20261113080000_ifund_member_connections_hub.sql`, with two RLS-protected tables and authenticated RPCs; no tokens, financial balances or passwords stored in public links.
- Sharing: per-platform private planning preferences (manual/draft/review/off), never grant posting permission or dispatch external posts automatically.
- Required checks: root PGlite security test, full frontend suite, Vite compile, preview render, signed-in saved-link and OAuth user journeys, admin diagnostics, live site regression across auth, payments, campaigns, Social Feed, finance and agent screens.
- **Release hold:** Production must remain on the previously verified deployment until every required check can be confirmed. External providers still require real consent; do not assert a connection succeeded from a URL bookmark.

## Preview QA round 1
- Preview build `197c0361-2a48-478c-a2d5-1447a31ec0c9`: 3/3 PostgreSQL-compatible integration tests passed, 410/413 web tests passed. Three failures were assertions against the former provider-list page. Their root causes were reviewed; legacy provider aliases are now recognized and the tests assert real statuses and selected-icon behavior.
- The rebuilt page now includes active-account chips, a filterable platform icon grid, an inline selected-platform guide, safe link/campaign pairing, member sharing preferences, campaign share actions, and recent connection activity.
- Continue **preview only**. Database changes are staged in source but not applied to canonical production; link-saving on a preview against production will therefore remain gated until the approved release migration.

## Preview QA round 2 and provider readiness
- Second targeted preview `a01725fd-f9be-4a73-a9c1-cbc69bd34d48`: 3/3 root database integration tests, 414/415 frontend tests. Final failed assertion was a newly added test with a doubled regex escape; repaired. No application/runtime defect indicated by this failure.
- Existing Base44 provider aliases (`facebook`, `instagram_business`, `youtube_channel`, `google_account`, `twitter`) are recognized alongside canonical OAuth IDs.
- Live production endpoint probes returned HTTP 200 with no redirect loop for home, Connections, Social Feed, Globe, Plans, and Hackathon. This is route availability, not a real signed-in test.
- **Verified provider-auth blocker**: `interplanetary-fund-api-migration` Worker is missing the required enabled flag, frontend origin allowlist, Supabase URL/service storage binding and third-party provider credentials. The separate `ifund-oauth` Worker routes to `/admin/agent-api`, not member provider authorizations. Do not claim secure account sign-in works from a saved public page.
- Automated curl requests to Cloudflare are challenged (HTTP 403), although independent edge probes return HTTP 200. Do not disable bot protection to satisfy probes.
- Mandatory release blocker: provider-backed member OAuth acceptance, a live authenticated end-to-end session and remaining site-wide checks before production.

## Latest source-only corrections — November 12 Pacific

- Built `/admin/integrations` as a read-only, server-role-protected connection readiness screen. Previously, member Connections linked to a nonexistent admin page. The new admin page shows configuration binding **names only**, status of the same-origin member gateway and per-provider readiness; no secret values are exposed. Added a route-level access-control source test.
- Improved application-only tiles: members see a positive, truthful official-site sign-in guide, rather than provider failure or developer instructions. Opening an application is not represented as an iFund account authorization.
- The latest **deployed** preview commit `0b6ac59c083b1963831409f7bf40e2c634f84b32` passed 415/415 frontend and 3/3 PGlite integration tests. Subsequent admin-route edits are source-only and still need a consolidated re-run; never count the prior preview as testing newer commits.
- Six core live public routes returned HTTP 200 with no redirect loops in independent edge tests. Browser sign-in, payment/refund/payout, media, publish and provider authorizations were NOT certified through an authenticated journey.
- Main continues to change through concurrent builder actions; the feature branch is intentionally not merged because of overlapping `Connections.jsx` modifications and the owner's production hold. Resolve against current main and run new validation before promotion.
- OAuth prerequisite remains a blocker: `interplanetary-fund-api-migration` Worker is missing member provider registrations, secure token vault storage readiness, origin allowlist and service credentials. Base44 connector/legacy tokens are NOT copied or treated as access grants.
- **Production auto-deploy disabled and verified** after unrelated main pushes triggered queued production jobs during a branch-only preview. Those two queued jobs were confirmed idle and removed without touching successful production releases. Never enable deprecated Git auto-deploy solely to test a preview.
