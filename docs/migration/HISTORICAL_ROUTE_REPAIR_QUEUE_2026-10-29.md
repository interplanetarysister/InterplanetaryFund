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