# Historical route end-to-end repair queue — 2026-10-29

Authority: issue #137 and source repository `interplanetarysister/interplanetary-fund2` (read-only). This queue is a work record, not a completion claim.

## Source-to-target findings confirmed during continuation

### Device activation: `/activate`
- Original source: `src/pages/DeviceActivation.jsx`.
- Required backend contract: `deviceAuthorization` modes `inspect` and `decide`; source function and shared helper are in `base44/functions/deviceAuthorization/entry.ts` and `base44/shared/deviceAuthorization.ts`.
- Security invariants to preserve: hash-only stored device/user/access tokens; 10-minute short-code expiry; rate limits fail closed; explicit per-scope approval; device token is not a user session; only `identity:read` and `campaigns:read`; revoke/deny/expiry honored.
- Initial target finding: the route resolved to `MissingFeaturePage` and had no canonical service/schema. The continuation below now adds a dedicated page and worker service, but the schema remains staged and the end-to-end flow is still unverified. Do not certify it until expiry/replay, ownership, revocation, runtime configuration and browser/device tests pass.

### OAuth consent: `/oauth/consent`
- Original source: `src/pages/OAuthConsent.jsx`.
- Original page calls `/api/apps/{appId}/mcp/consent-info` and `/api/apps/{appId}/mcp/authorize-grant` with an opaque single-use context handle.
- Target finding: route still resolves to `MissingFeaturePage`; PR notes that legacy domain routes still point to the old worker for MCP/OAuth. Reusing that worker would restore a screen without completing the canonical migration. Replacement must bind context to the correct client/resource, verify the active session, revalidate grants at decision time, consume handles atomically, and constrain redirects.

### Communications: `/communications`
- Original source: `src/pages/Communications.jsx`; tabs are Compose, History and Preferences.
- Source dependencies include `ComposeMessage`, `MessageHistory`, and `CommPreferences`. Source preferences are loaded from `User.comm_prefs`; message delivery and history are not equivalent to a local form.
- Target finding: no target page or canonical communications service/table was found by targeted search. A UI-only port would risk implying messages were sent or preferences saved when neither is true.

### Universal inbox: `/inbox`
- Original source: `src/pages/Inbox.jsx`.
- Original inbox merges owner-scoped `InboxItem`, `Notification`, and campaign donation records obtained through `getCampaignDonations`; source also includes verification and admin approval panels.
- Target finding: no explicit `/inbox` route exists in `apps/web/src/App.jsx`; it currently falls through the historical pending-route renderer. Canonical equivalent schemas, donation reader, notification reader, and privileged approval behavior must be reconciled before replacing it.

### Blogs / My Blog
- Public story reads currently use `apps/web/src/lib/editorial.js` against `ifund_blog_entries`, `ifund_user_blogs`, and `ifund_official_publications`.
- The corresponding target migration is under `supabase/migrations/pending/20261029_ifund_editorial_readers.sql` and is not applied. It intentionally grants no browser writes pending subscription-entitlement, owner, and publication audit work.
- `/my-blog` is still pending. Do not enable draft/publish buttons until server-authorized create/update/publish operations and subscription entitlement are implemented and cross-account RLS tests pass.

## Acceptance rule

A route only leaves the pending queue after (1) original UI/route semantics are restored, (2) every action maps to a canonical service, (3) authorization is server-enforced and cross-account tested, (4) loading/empty/error/retry states work, (5) mobile/Android behavior is verified, and (6) automated and browser evidence is attached. Source inventories, a rendered shell, or a staged migration alone are not proof of completion.

## Current status

No new route is certified by this audit. No migrations, tests, builds, or deployments were run as part of this source review.

## Additional implementation work (2026-10-29 continuation)

- Staged `supabase/migrations/pending/20261029_ifund_device_authorization.sql`: canonical table contract for device-code grants, SHA-256-only credential storage, short-lived pending codes, constrained read scopes, revocation states, and rate-limit buckets. RLS is enabled with all browser grants revoked and no client policies.
- Added `apps/web/tests/device-authorization-schema.test.js` to assert those schema safety properties.

At the time of the initial schema-only checkpoint, the worker endpoint and UI were missing. The continuation below records subsequent partial implementation. The migration remains unapplied and tests have not been executed; `/activate` and `/devices` are not certified end to end. The canonical server-only Supabase service-role secret and preview gate must be configured and validated before the handler can access the tables. Never expose the service-role secret to the browser.

### Device authorization implementation continuation

- Added `worker/deviceAuthorization.js` and wired `/api/device-authorization/*` through `worker/index.js`. The worker is restricted to the canonical Supabase project, requires the independent `MIGRATION_API_PREVIEW=enabled` gate, uses server-only service-role access, and fails closed if the required configuration or database/RPC is unavailable.
- Implemented temporary request creation, authenticated code inspection, approve/deny compare-and-set, device-code polling, read-only scoped resource reads, owner-scoped device listing, and revocation checks on every resource request. Credential hashes use domain-separated SHA-256 values; visible approval codes match the source's ten-character format; approvals preserve only the scopes requested by the device.
- Restored `/activate` and `/devices` as dedicated pages and mounted them in the web router. The pages call the independent API, never the legacy Base44 function route. Ported the device-pairing self-test to issue a temporary identity-only grant, poll the canonical token endpoint, perform one scoped identity read, and attempt automatic revocation.
- Added worker regression tests for configuration fail-closed behavior, hash-only credential storage, unsupported-scope rejection, no scope escalation, approved identity reads, and revoked-token denial. Added staged SQL assertions for the atomic rate-limit RPC.
- Account authorization currently verifies the Supabase Auth identity and requires a matching canonical profile, but the source's separate `account_deletion_pending` and `account_status` flags are not represented in the canonical profile schema. This remains a parity/security gate; do not certify device authorization as production-ready until the account lifecycle state is migrated and enforced.

**Still not certified:** these commits have not been executed through the Node test suite, browser/device QA, or production build. The schema and RPC migration remains unapplied. No production server secrets have been confirmed/configured, and the route must remain fail-closed until the migration, worker environment and runtime checks are independently verified. The `campaigns:read` device resource currently returns only active campaign metadata; public raised-progress totals are deliberately not fabricated or inferred from unavailable donation data.

### My Giving: /giving

- Read the original `src/pages/MyGiving.jsx` and `base44/functions/getMyGiving/entry.ts`. Source financial truth is restricted to provider-verified donations; manual or pending gifts are excluded. Campaign gift amount excludes optional platform support; source recurring-plan data is also present but is not represented in the current canonical donation schema.
- Added `worker/givingReads.js`, routed `GET /api/giving/mine`, and mounted a dedicated My Giving page. The worker uses the verified Auth user, checks a matching canonical profile, filters server-side to that donor and `status=captured`, validates ownership/currency/cents/timestamps, joins campaign titles, and never returns PayPal order/capture IDs.
- The page shows confirmed campaign gifts, separately recorded optional IFund support, supported-campaign count, and retry/empty states. It does not invent recurring amounts, processing fees, or total charged because those fields are not available in the canonical donation schema.

**Still partial:** canonical donation RLS currently has no donor SELECT policy, so this path relies on a server-only service-role query with strict donor filtering and response validation. The route tests were added but have not been executed; the API, captured-only truth boundary, RLS/ownership behavior, browser rendering and Android behavior remain unverified. No financial writes were added.