# Connections icon hub — staging and acceptance

Target: existing Cloudflare Pages `interplanetaryfund-migration`, frontend `apps/web`, canonical Supabase `ssibsfmtodgximseeqsv`. Do not deploy to production until the full regression and sign-in tests have passed.

- Reference: Base44 Interplanetary Fund `6a67a778342a8fe05ee79cba` contains 46 platform choices, plus existing iFund Google Account added for 47 total.
- New user interface: actively connected, available to add, and saved-link counts, connected-account chips, filterable grid of 47 selectable platform icons, and one context-specific guide beneath the grid. Admin diagnostics are permission-gated.
- Connection behavior: verified OAuth only for supported accounts when enabled by the backend; saving a public profile URL is separate from account authorization. All URLs strip query strings and fragments.
- Owner-only storage: `20261113080000_ifund_member_connections_hub.sql`, with two RLS-protected tables and authenticated RPCs; no tokens, financial balances or passwords stored in public links.
- Sharing: per-platform private planning preferences (manual/draft/review/off), never grant posting permission or dispatch external posts automatically.
- Required checks: root PGlite security test, full frontend suite, Vite compile, preview render, signed-in saved-link and OAuth user journeys, admin diagnostics, live site regression across auth, payments, campaigns, Social Feed, finance and agent screens.
- **Release hold:** Production must remain on the previously verified deployment until every required check can be confirmed. External providers still require real consent; do not assert a connection succeeded from a URL bookmark.
