# Historical route end-to-end repair queue — 2026-10-29

Authority: issue #137 and source repository `interplanetarysister/interplanetary-fund2` (read-only). This queue is a work record, not a completion claim.

## Source-to-target findings confirmed during continuation

### Device activation: `/activate`
- Original source: `src/pages/DeviceActivation.jsx`.
- Required backend contract: `deviceAuthorization` modes `inspect` and `decide`; source function and shared helper are in `base44/functions/deviceAuthorization/entry.ts` and `base44/shared/deviceAuthorization.ts`.
- Security invariants to preserve: hash-only stored device/user/access tokens; 10-minute short-code expiry; rate limits fail closed; explicit per-scope approval; device token is not a user session; only `identity:read` and `campaigns:read`; revoke/deny/expiry honored.
- Target finding: route still resolves to `MissingFeaturePage`; no target worker handler or canonical device authorization table was found in the target route/source search. Do not port the form alone or claim activation works before the service, schema, expiry/replay checks, owner checks and revoke path exist.

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

These are groundwork only. The migration remains unapplied, the worker endpoint and atomic rate-limit RPC are not implemented, and `/activate` still does not provide a working authorization journey. The schema test has not been executed. The server-only Supabase service-role secret must be configured and validated before any worker handler can use this table. Do not expose that secret to the browser, and do not enable the route until the server handler and its tests exist.

### Device authorization implementation continuation

- Added `worker/deviceAuthorization.js` and wired `/api/device-authorization/*` through `worker/index.js`. The worker is restricted to the canonical Supabase project, requires the independent `MIGRATION_API_PREVIEW=enabled` gate, uses server-only service-role access, and fails closed if the required configuration or database/RPC is unavailable.
- Implemented temporary request creation, authenticated code inspection, approve/deny compare-and-set, device-code polling, read-only scoped resource reads, owner-scoped device listing, and revocation checks on every resource request. Credential hashes use domain-separated SHA-256 values; visible approval codes match the source's ten-character format; approvals preserve only the scopes requested by the device.
- Restored `/activate` and `/devices` as dedicated pages and mounted them in the web router. The pages call the independent API, never the legacy Base44 function route.
- Added worker regression tests for configuration fail-closed behavior, hash-only credential storage, unsupported-scope rejection, no scope escalation, approved identity reads, and revoked-token denial. Added staged SQL assertions for the atomic rate-limit RPC.

**Still not certified:** these commits have not been executed through the Node test suite, browser/device QA, or production build. The schema and RPC migration remains unapplied. No production server secrets have been confirmed/configured, and the route must remain fail-closed until the migration, worker environment and runtime checks are independently verified. The `campaigns:read` device resource currently returns only active campaign metadata; public raised-progress totals are deliberately not fabricated or inferred from unavailable donation data.
