# IFund connection dialogs and provider authorization audit — 2026-10-08

## Scope and change
The canonical Base44 app main branch now uses mobile-safe layout constraints in shared Dialog, AlertDialog, Sheet, Drawer and Select primitives, as well as the Connections dialog and terms/permissions popup. These fixes apply to web, PWA and browser-wrapped app surfaces sharing this React codebase. Changes are source-level until a published device/browser test proves the deployment contains them.

- Responsive dialog grid uses minmax(0, 1fr), viewport-limited width/height, vertical scroll and zero horizontal overflow.
- Long campaign titles remain readable in a wrapped, non-editable connection-title block rather than overflowing a single-line Input.
- Select triggers truncate only the selected value; opened menu entries wrap so users can read the full title. Menu content has viewport height/width limits.
- Primary connection buttons use the short provider name, not the entire campaign name, and grow vertically when needed.
- Confirm dialogs, sheets, drawers and the session-permissions popup use the same mobile bounds and scroll guarantees.
- The source regression contract is scripts/verify-mobile-layout-contract.mjs.

## All 41 catalog destinations: connection mode and truthfulness audit
The catalog currently has 24 OAuth-type integrations, 13 link-based, 2 token and 2 manual multi-field integrations. Catalog presence is NOT evidence of a working provider authorization. A shared Base44 connector is not an individual user's authorization.

**OAuth-type (24):** Facebook, Instagram, LinkedIn, TikTok, Discord, Eventbrite, Gumroad, Gmail, Google Drive, Google Calendar, Google Contacts, Google Photos, Google Sheets, Google Docs, Google Forms, Google Tasks, Slack, Notion, Outlook, Microsoft Teams, OneDrive, Dropbox, GitHub, GitLab.

For every OAuth-type destination, src/components/connections/ConnectDialog.jsx uses Base44's per-app-user connector authorization (connectAppUser), returns to IFund, finalizes against the authenticated IFund user and paired owned campaign, then performs a real provider check. The corresponding connector ID must be provisioned in Base44's runtime via the matching OAUTH_ENV mapping; this audit cannot verify that every ID exists or that the provider granted necessary scopes. Provider passwords, codes, and access tokens are not stored in the front-end resume hint. Unsupported/absent configuration fails closed rather than claiming a connection. When a provider revokes scope, reauthorization is required.

An `APP_USER_CONNECTOR_*` environment value proves only that IFund has a connector registration reference. It is not operational evidence. The preflight response separates `registration_reference_present`, `registration_verified`, `can_attempt`, `authorization_present`, and `provider_verified`; an environment value never sets `registration_verified`, and the provider remains unverified until the post-return provider-specific check succeeds. A reference-present-but-unverified connector may offer a Connect attempt, but the UI must describe the account as not connected and surface an actionable setup error if Base44 cannot return a secure authorization URL. Shared app connectors and app-user connectors remain separate capabilities and are never inferred from one another.

**Provider probe implemented (19 OAuth types):** Facebook Pages, Instagram, LinkedIn, TikTok (identity only, not upload), Discord, Eventbrite, Gmail, Google Drive, Google Calendar, Google Contacts, Google Tasks, Slack, Notion, Outlook, Microsoft Teams, OneDrive, Dropbox, GitHub, GitLab. Provider probes prove only their tested capability, never all requested capabilities.

**OAuth setup present in UI but no valid live probe available (5):** Gumroad, Google Photos, Google Sheets, Google Docs, Google Forms. The verifier intentionally fails closed; these are NOT live-certified connections merely because a token exists. This needs a provider-specific read-only probe with appropriate granted scopes and a real end-to-end test.

**Public-link checked (6):** GoFundMe, Kickstarter, Indiegogo, FundRazr, GiveSendGo, Spotfund. Only an approved HTTPS public URL and reachability are verified, not ownership, posting permission or provider-reconciled totals.

**Other link mode (7):** Patreon, Custom Campaign URL, Threads, X (Twitter), Pinterest, Reddit, YouTube. Treat these as references/tracking links, NOT OAuth or published-post permissions. Do not advertise auto-posting for these entries.

**Token (2):** Ko-fi and Buy Me a Coffee. Tokens/webhooks require their own positive server-side verification and campaign-specific accounting. A saved token alone is not proof of working integration.

**Manual credential (2):** Bluesky and Mastodon. Bluesky has a provider authentication probe; arbitrary Mastodon instances require a redirect/DNS-safe outbound verification mechanism before being live-certified. Do not use a connected state unless the real probe succeeds.

## Facebook Pages specific blocker
The Base44 app-level Facebook Pages connector is active, connected to Page "Interplanetary Fund", with scopes pages_show_list, pages_read_engagement, pages_manage_posts. This is a shared APP connection. The Facebook dialog reports the separate APP_USER_CONNECTOR_FACEBOOK_PAGES_ID is not configured for IFund's individual customer flow. These are not interchangeable; never expose the shared Page's token to users or silently bind every user to the IFund-owned Page.

Provider rollout must configure the app-user connector ID and redirect/permissions through Base44's supported admin/provider OAuth process, then prove independent IFund user A and B get their own grants without cross-account leakage. For Facebook, require Page grants and a Page CREATE_CONTENT/MANAGE task. Confirm posted content with a real provider result before saying published.

## Verification release gates
1. node scripts/verify-mobile-layout-contract.mjs
2. node scripts/test-oauth-delegation-flow.mjs
3. node scripts/test-facebook-page-oauth.mjs
4. node scripts/verify-managed-connections-contract.mjs
5. node scripts/verify-connection-catalog-contract.mjs
6. node scripts/verify-connect-dialog-safe-errors.mjs
7. Run the Node 22 build, then exercise user-facing dialogs and selectors at narrow Android, narrow iPhone, tablet and desktop viewport widths. Verify no horizontal clipping, readable buttons, focus traversal, scroll-to-bottom, and software keyboard behavior.
8. For each OAuth platform before advertising it as connected, perform first-time login, denied grant, return callback, refresh/revocation, owner isolation and provider-specific scoped capability check in an actual account. No actual provider login is implied by the source tests above.

No GitHub Action, external publishing, provider-account creation, financial movement or paid automation is required for the layout repairs.
