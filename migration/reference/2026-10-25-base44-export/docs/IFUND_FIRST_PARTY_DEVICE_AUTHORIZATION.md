# IFund first-party device authorization — initial release

## Goal

An IFund-owned device or agent starts a short-lived pairing request and shows
a 10-character code. A human signs in on IFund, reviews the requested
permissions, and approves or denies. An approved device can then use only
the read-only IFund resources explicitly authorized by that user.

This is a first-party device-code-style implementation modeled on OAuth 2.0
RFC 8628. It is not yet a general interoperable OAuth authorization server,
and does not grant third-party PayPal, Facebook or Google account access.

## Human workflow

1. The device calls the Base44 function deviceAuthorization:
   {"mode":"start","client_id":"ifund-cli-v1","device_label":"My laptop","scopes":["identity:read","campaigns:read"]}
2. The response has device_code, user_code, verification_uri,
   verification_uri_complete, expires_in (600 seconds) and interval (5 seconds).
   The DEVICE CODE is secret; only the short user code is displayed to the human.
3. The human opens https://interplanetaryfund.com/activate, signs in,
   enters the code, reviews the scope descriptions, and approves or denies.
4. The device polls the same backend function:
   {"mode":"poll","grant_type":"urn:ietf:params:oauth:grant-type:device_code","device_code":"<original secret>"}
   Before approval: authorization_pending or slow_down. Denied: access_denied.
   Expired: expired_token. Approved: scoped access_token.
5. A device calls {"mode":"resource","action":"identity"} or
   {"mode":"resource","action":"campaigns"} with HTTP header
   X-IFund-Device-Token: <approved bearer>. The token is NEVER an IFund account
   login token, payment permission, publishing permission or unrestricted agent.
6. The user lists and revokes grants at /devices, linked from /profile.

Never expose the raw device code or bearer in URLs, app analytics, log output,
the approval UI or unencrypted client storage.

## Initial scope whitelist

- identity:read — IFund screen name and display name only.
- campaigns:read — sanitized campaign summaries owned by the approving user.

No permissions for payments, withdrawals, campaign publishing, inbox/private
messages, external platform login, admin actions, or OBO operations.

## Safeguards

- Entity DeviceAuthorization has admin-only RLS; all public and user operations
  use controlled backend service role.
- Raw device code, user code, and access token are never persisted. Distinct
  domain-separated SHA-256 hashes are stored instead.
- Random 256-bit device code, human-readable 10-character code, 10-minute
  approval deadline, 30-day access grant.
- Strict server-persisted rate limits fail closed on DB errors.
- Human approval requires a currently active IFund user account.
- Pending-to-approved changes use a conditional state update and post-write
  verification so two competing approvals cannot transfer a grant.
- Token exchange is idempotent and returned only after approval.
- Resource authorization checks scope, active owner account, expiry and
  revocation on every request.
- The device label is unverified and clearly described as such to the user.

## Before live-use claims

A mocked local test cannot verify Base44 service-role deployment, CORS rules,
SDK invocation, or state-conditional entity updates. Deploy the entity,
function and site using Base44 (not GitHub Actions), then complete a real test:
anonymous start, signed-in approval, denied request, polling, read-only
resource, scope failure and immediate revocation. Do not grant privileged
permissions until those checks are proven.

Local test: node scripts/test-ifund-device-authorization.mjs

No additional agents, paid APIs or payment charges are required for tests.

## Browser-guided live verification

The Connected Devices page now includes a Start connection test option.
It creates a new read-only pairing request under a random browser-test
label and opens the IFund activation page in another tab.

This uses the real backend start, inspect, decide, poll, read-resource,
list, and revoke operations. The browser holds the random device code
only in memory. The derived bearer is used only for an identity check.
On success, the test client finds its unique labeled grant and revokes
it from the signed-in user account. If revocation cannot be confirmed,
the UI instructs the user to revoke access from the devices list.

An active IFund account and explicit human approval are required.
No headless program should simulate or bypass a human approval.
