# IFund: provider login -> AI authorization -> verified connection

Status: implemented in Base44 source. Source, mocked handler and build tests
must pass. Each provider also requires an actual app-user OAuth connector,
approved developer redirect URI, permissions approved by the provider, and
an authorized real account for its first end-to-end test.

## Customer journey

1. Connect on a listed platform opens its authorized provider OAuth sign-in
   in the same browser tab. IFund saves a short-lived resume hint before any
   redirect so mobile browsers and provider callbacks cannot race that save.
2. The provider owns password, MFA, OAuth state and tokens. IFund localStorage
   stores only a non-secret, short-lived resume hint: platform, signed-in IFund
   user ID, start time, flow step and a relative same-site return path.
3. Once the provider completes login, IFund resumes on Connections and shows
   a NEW AI permission prompt for that account. No AI access is inferred from
   provider sign-in or a global user grant.
4. ALLOW AI explicitly authorizes that account for requested AI posting,
   editing, commenting, replies/messages and connection maintenance where
   the provider grants suitable API capabilities. It does not authorize
   money movement, invent unavailable scopes or bypass user intent.
   CONNECT WITHOUT AI is always an option.
5. The server stores the per-connection choice. IFund makes a real provider
   verification call. Only successful verification is displayed as Connected.
   A failed live probe shows needs-attention/reconnect, never a green state.
6. The app returns to the SAME IFund relative route where Connect was clicked,
   when safe. Otherwise it stays on Connections with an explanation.
7. AI may be turned off for that account without unlinking it. Disconnect
   removes local delegated authority and requests provider revocation when
   the connector exposes a revocation operation.

## Persistent connection

- Connection metadata persists in the PlatformConnection entity. The Base44
  app-user connector owns and refreshes credentials as supported by that
  provider. IFund never stores OAuth tokens in the browser or plain entity
  credentials.
- Returning to Connections silently checks older OAuth connections again
  through the authorized provider transport. Successful checks retain live
  status. Revoked/expired provider grants need official reauthorization.
- No software can guarantee permanent access independent of a provider:
  users may change passwords, revoke grants, lose provider eligibility, or
  have an account suspended. Show needs-attention rather than falsely claim
  forever-connected access.
- Shared service connectors (e.g., one platform-owned bot connection) do NOT
  establish per-user OAuth grants. Provider app-user connectors are separate.
- For each external platform, direct publish and private-message operations
  also require actual granted provider permissions, a functioning provider API,
  consent and entitlement checks. Publishing via unsupported providers must
  remain pending/manual, not report a successful automated post.

## Platform rollout certification before calling an individual integration ready

- Confirm the configured App User connector ID exists in Base44 runtime, with
  a provider-authorized client, callback URI, reviewed permissions and (when
  supported) offline/refresh authorization.
- Test one first-time OAuth login, the AI YES and NO branches, reopening the
  tab, a denied/revoked grant, expired OAuth access, and a reconnect.
- Verify accepted AI grant is shown only for this account; a later global
  consent change must never override a declined per-account permission.
- Verify real read-only provider identity, capability reports and then each
  promised post/edit/message ability under an owner-authorized test account.
- Verify posts do not run after AI revoke, disconnect or provider revocation.
- Confirm return-route behavior on Android/mobile WebView and desktop,
  including browser back, expired callbacks, and cross-origin redirects.
- For Facebook specifically, an IFund account sign-in is separate from
  Facebook Pages authorization. Require Meta Page grants for pages_show_list,
  pages_read_engagement, and pages_manage_posts and a Page creation task before
  showing posting access as verified. Personal profiles are not Page targets.
- Verify Base44/host provider refresh behavior with real expiring tokens.
- Test release with no provider secrets or user passwords exposed in logs,
  frontend state or response payloads.

## Important limitations

An OAuth grant cannot manufacture permission to publish or send messages on
provider APIs that prohibit it. Login forms at unsupported providers require
approved OAuth/API integrations or separately audited permitted browser
sessions. The existing browser-connection transport in this app is still
deferred. Those providers must not be labeled live-verified until an actual
secure method works. Real provider authorization and credential configuration
require an authorized account owner or provider administrator and cannot be
substituted with simulated tokens.
