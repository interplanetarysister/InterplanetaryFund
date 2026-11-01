# Instagram Platform integration runbook (18 October 2026)

## Status and ownership
IFund's existing app-user OAuth flow uses `base44/connectors/instagram.jsonc`, `getAppUserConnector`, `finalizeAppUserOAuthConnection`, and `verifyPlatformConnection`. This change requests missing Instagram permissions but **does not establish a live Meta-approved connection**. Account identity, authenticated read, publishing, and messaging must each be tested with a real connected professional account. Maintain the one account-level AI delegation toggle and honor revocation.

## Authentication choice
- Default: **Instagram API with Instagram Login**, for Instagram Business/Creator accounts; no Facebook Page required. Instagram professional authorization belongs to the account owner and uses `instagram_business_*` permissions.
- Alternative: **Instagram API with Facebook Login** for professional accounts linked to a Facebook Page; requires the separate Facebook/Page permissions and Facebook/Page token flow. Do not substitute Facebook Login tokens or scopes for Instagram Login tokens.
- Consumer/personal Instagram accounts cannot access these professional API operations; offer user-driven native sharing instead, without claiming automated posting.
- IFund-owned Instagram brand account must authorize the same way, through its actual account owner. Do not mark a platform-owned account active until token and provider read/write checks succeed.

## Requested Instagram Login scopes
- `instagram_business_basic`: account and media
- `instagram_business_content_publish`: publish eligible media
- `instagram_business_manage_comments`: read/moderate/reply to comments
- `instagram_business_manage_messages`: eligible conversation messaging
- `instagram_business_manage_insights`: supported metrics/insights

Scope requests are not grants. Keep provider-reported permissions separate from intended IFund agent capabilities; errors and denied scopes must leave individual operations disabled.

## Meta setup checklist
1. Create/select a Meta Developer app with Instagram product; configure business verification and required permissions/advanced access/app review for accounts beyond permitted test roles.
2. Register the exact deployed OAuth redirect URI in the Meta app, define login settings, permitted origins, application privacy policy and data deletion instructions. Do not use Make's OAuth callback as the Instagram callback unless Make itself is the Meta OAuth client.
3. Configure corresponding Instagram connector in Base44, saving credentials in managed server secrets (never client code, entities, logs or Git).
4. Authorize with an actual Instagram professional test account. Return to IFund's existing OAuth continuation, explicitly record per-account AI permission, and verify identity and granted scopes through a harmless API read before marking connected.
5. Implement and validate inbound webhook endpoint: challenge response, signature verification using Meta app secret, deduplication, event ownership matching, retries, logging without message secrets, and replay resistance. Subscribe only to fields that Meta approves for the configured API.
6. Publish only on behalf of an approved account: confirm owner and connection health, optional campaign linkage, scoped AI permission, eligible public media URL, required media container creation, container status, `media_publish` operation, rate-limit handling and idempotency. Store external post IDs and evidence.
7. For comments and DMs: ingest events into the unified inbox and only send responses allowed by Meta permissions, messaging windows and conversation rules. Don't initiate unsolicited DMs, impersonate others, or promise universal automated reply capability.
8. Support user-driven story/feed sharing and allowed embeds as separate features; do not mislabel device-native sharing as Graph API publishing.
9. Provide account disconnect and token revocation/expiry handling, privacy/data deletion workflows, permission degradation, diagnostic test and reconnect guidance.
10. Before enabling live automation: test admin brand account and a separately owned user account; verify revoked consent disables future agent actions, token expiry surfaces reconnect, Meta denial leaves the tile unverified, and failed publish never falsely claims success.

## API publishing sequence
1. `POST /{ig-user-id}/media` — create container.
2. `GET /{container-id}?fields=status_code` — inspect readiness as appropriate.
3. `POST /{ig-user-id}/media_publish` — publish the container.
4. `GET /{ig-user-id}/content_publishing_limit` — inspect quota usage where supported.
Use the API host and version appropriate to the authentication path, and consult the current Meta reference for supported formats, endpoints, and restrictions.

## User-friendly help
1. Open Connections in IFund.
2. Select Instagram.
3. Choose Instagram sign-in; if your business account is linked to a Facebook Page, an alternative connection may be offered when configured.
4. Sign in on Meta's official page and approve the requested access.
5. Return to IFund, choose whether AI may help with that account, and run Check Connection.
6. Only when IFund reports the connection and specific feature as working should you use automated publishing or replies. If it is not working, use reconnect or manual sharing.


## Meta access-token handling — required for Facebook and Instagram connections

The Meta access-token documentation is now part of the IFund Connections implementation contract. The existing Instagram Login integration and Facebook Login/Page integration are **different provider flows**; do not merge their credentials, token scopes or identities.

| Credential | IFund use | Rules |
| --- | --- | --- |
| App access token | IFund Meta application configuration and permitted app-level server calls | Generate server-to-server using App ID and secret; never send to a browser, Android APK, logs or client-facing APIs. |
| Client token | Public app identification in approved client SDK operations | Not a grant for Page, user, messaging or publishing data; app ID + client token is not an app secret. |
| User access token | Member or IFund owner consents through Meta login | Validate state, app binding, scopes, expiry, subject and account ownership; a user token does not by itself mean Page access. |
| Page access token | Facebook Page-specific reads/writes | Following authorization, discover eligible Pages using `/me/accounts` or the supported account endpoint, persist each Page identity separately, check tasks/scopes and verify a harmless Page read. |
| System User access token | IFund-owned business assets for unattended authorized operations | Admin-controlled, business-asset-assigned, server-side only; never reuse for member-owned assets or treat it as universal Page access. |

### Build requirements for the existing connections portal
1. Add Meta configuration for **IFund-owned** apps/assets under admin connections and member-facing **Connect Facebook Page** using official Meta authorization. Keep credential roles and authorization/ownership isolated.
2. Keep App ID and nonsecret client token distinguishable from encrypted App Secret, app token, Page/user/system-user tokens. Secrets belong in server-managed secret storage, not the `PlatformConnection.credentials` entity, response bodies, localStorage, source control or automation prompts.
3. For Facebook Login, initiate provider OAuth from IFund's own redirect URI, use state/CSRF and PKCE when supported, validate provider callback and token server-side, check requested versus actually granted scopes, then discover Pages. The Make callback `https://www.integromat.com/oauth/cb/oauth2` is **not** IFund's Meta redirect unless Make itself acts as the OAuth client.
4. Let users select a Page after discovery; store only an opaque secret-store token reference and nonsecret metadata per Page (provider app/account/Page identifiers, asset ownership, type, granted scopes/tasks/capabilities, expires_at, checked_at, reauthorization state). A user can own multiple Pages; never select the first Page silently.
5. For supported web-login tokens, exchange short-lived for long-lived tokens **on the server**, track provider-reported expiry, and recheck before sensitive operations; expiry periods are not guarantees. Avoid assuming that all token classes can be refreshed or extended the same way. Support rotation, invalidation, disconnect and secret revocation as applicable.
6. Implement `Check Connection` as an authenticated provider read **for the exact account/asset**, plus separate capability probes. Only verified scopes and Page tasks may enable publishing, comments, insights or inbox. A connection may be verified with only partial capabilities; denied permissions never become agent privileges.
7. Gate each AI action using server-verified acting user, selected asset, latest Meta grants, IFund global/per-account OBO consent, connection status and allowed action. IFund-owned admin tokens cannot be substituted for a member's token.
8. Build meaningful UI states: Sign in, Choose Pages, Connected (verified), Partial permissions, Reconnect, and Disconnected. Show last successful check and requested versus approved features without exposing secrets.
9. Keep Instagram Login's `instagram_business_*` grants and Instagram-with-Facebook-Login Page-linked flow separate. Consumer Instagram accounts must not be represented as professional API-enabled accounts.
10. Use HTTPS and confidential server-side token handling. Never expose or display raw tokens in an agent chat. Validate inbound webhook signatures independently of login tokens, dedupe events, respect Meta platform messaging rules and user consent.
11. Test: wrong app/token type, forged/expired state, token expired/revoked, missing Page task, Page selected from another owner, cross-user token use, system user assigned to wrong asset, app secret disclosure, permissions denied, retry/rate limits and reconnect. Assert no false "Connected" status and no unauthorized AI publishing.
12. Update the member Help page and admin Help page whenever the actual UI is implemented; use short, child-readable steps and explain when reconnection is necessary.

### Completion gate
This section is a **tracked specification**, not proof of a deployed Meta connection. Mark Facebook Pages, Instagram publishing and member-agent messaging live only after valid Meta app setup, required app review/permissions and successful production checks for IFund-owned and separately owned member test accounts. Do not claim token generation, a configured secret, successful publish or deployed functionality based solely on this runbook.

Documentation: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens

## Sources
- https://developers.facebook.com/documentation/facebook-login/guides/access-tokens
- https://developers.facebook.com/documentation/instagram-platform
- https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
