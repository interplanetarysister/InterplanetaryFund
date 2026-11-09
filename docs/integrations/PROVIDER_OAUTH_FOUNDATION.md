# Provider OAuth implementation foundation

**Branch:** `migration/provider-oauth-foundation-20261109`
**Target:** `migration/supabase-cloudflare`
**State:** implementation plan and provider contract only; no provider credentials have been created or copied.

## Operating rule

Use the connected GitHub, Cloudflare, Supabase, and other provider-native integrations directly. Do not use TinyFish or any paid browser-automation service as a prerequisite. Provider credentials can only be read from an authenticated developer account that exposes them to an authorized tool/session. If a provider requires an interactive identity, terms, MFA, CAPTCHA, business verification, or app review, queue only that specific human/provider gate and continue other work.

## Correct architecture

- The canonical independent application is `interplanetarysister/InterplanetaryFund`; Base44 is a legacy reference, not the production source of truth. Keep Base44 documentation limited to legacy metadata and do not store new provider secrets there.
- OAuth authorization-code + PKCE flows terminate at the canonical Cloudflare Worker/API. Validate one-time state, exact redirect URI, issuer/provider, expiry, and PKCE verifier before exchanging codes server-side.
- Provider client secrets are Cloudflare Worker Secrets attached only to the OAuth consumer Worker. Never use `VITE_*`, public Pages variables, GitHub Actions plaintext, browser storage, Base44 entities, or logs for secret values.
- User access/refresh tokens are per-user credentials, encrypted at rest in the private Supabase credential vault; never reuse the application client secret as a user token or put refresh tokens into Worker env vars.
- Supabase stores provider identity, granted scopes, token expiry, encrypted token ciphertext/key version, owner ID, provider subject, status, and audit events. RLS denies browser access to ciphertext and token material; service-side RPC/Edge Function owns reads and writes.
- Base44, if retained during migration, may store only non-secret provider setup metadata and references. It is not the token store for the independent app.
- OAuth connection success means a provider-issued token has been exchanged, identity has been fetched, granted scopes recorded, and a minimal permitted API call has succeeded. A redirect or consent page alone is not success.

## Provider registration matrix

| Provider | App registration / products | Minimum login scopes | Notes |
|---|---|---|---|
| Meta | Meta for Developers app; Facebook Login; Instagram product only for supported Instagram API use | `public_profile`, `email` where approved | Business verification and App Review/Advanced Access may be required. Instagram is not a generic login provider. |
| LinkedIn | LinkedIn Developer app; Sign In with LinkedIn using OpenID Connect | `openid`, `profile`, `email` | Other products and permissions are separately gated; request only features actually implemented. |
| X | X Developer project/app with OAuth 2.0 user authentication | `users.read`, `tweet.read`, `offline.access` only if required | Confirm plan/endpoint entitlement before enabling write scopes. |
| TikTok | TikTok for Developers app with Login Kit for Web | `user.info.basic` | Use OAuth v2 endpoints and exact static HTTPS redirect URI. |
| Google / YouTube | Google Cloud project + OAuth Web client; enable only required APIs | `openid`, `email`, `profile`; YouTube scopes only for requested YouTube features | Consent screen, test users, verification and API enablement may apply. |
| GoFundMe Pro | GoFundMe Pro / Classy developer approval | Provider-defined | Separate from consumer GoFundMe; do not infer access from a consumer campaign URL. |

## Redirect URI contract

Do not register guessed callbacks. Derive the final callback from the deployed route and test environment. Use distinct fixed callbacks for preview and production, e.g. `https://<verified-preview-host>/api/oauth/<provider>/callback` and `https://interplanetaryfund.com/api/oauth/<provider>/callback`, only after the worker route is implemented and verified. Register the exact HTTPS URI with each provider. No wildcard paths, query parameters, or fragments.

## Credential names (names only; values stay in secret stores)

- `META_OAUTH_CLIENT_ID` (non-secret config) / `META_OAUTH_CLIENT_SECRET` (Worker Secret)
- `LINKEDIN_OAUTH_CLIENT_ID` / `LINKEDIN_OAUTH_CLIENT_SECRET`
- `X_OAUTH_CLIENT_ID` / `X_OAUTH_CLIENT_SECRET`
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOFUNDME_PRO_CLIENT_ID` / `GOFUNDME_PRO_CLIENT_SECRET` (only after approval)

Use environment-specific secret names/bindings or separate preview and production Workers. Never bind production credentials to preview. Cloudflare's Worker Secrets API supports secret writes, but this repo's provider OAuth consumer and exact callback contract must exist before secrets are installed.

## Implementation sequence

1. Confirm canonical project and deployed preview host from the current release branch; do not guess the callback URL.
2. Add a provider registry with fixed authorization/token/userinfo endpoints, allowed scopes, response parsing, token auth method, and capability flags. Treat endpoints and scopes as code-reviewed constants, not user input.
3. Add `/api/oauth/:provider/start` and `/api/oauth/:provider/callback`; generate cryptographically random state and PKCE verifier, store a short-lived one-use transaction server-side, bind it to the authenticated owner/session, and use SameSite/secure cookies where browser redirects require them.
4. Implement token exchange with strict timeouts, response size limits, no redirects to untrusted hosts, issuer/audience checks where applicable, and secret-safe error handling.
5. Encrypt per-user access/refresh tokens with envelope encryption; keep key-encryption material in Cloudflare secrets or an approved key service, store only ciphertext + key version in private Supabase tables. Rotate keys with versioned re-encryption.
6. Add disconnect/revoke and refresh routes with provider-specific revocation behavior, token rotation handling, idempotency, audit events, and deletion of local token ciphertext after revocation/retention rules.
7. Add contract tests for state replay, CSRF, PKCE mismatch, redirect mismatch, expired code, missing scope, provider denial, malformed token response, refresh rotation, disconnect, owner isolation and log redaction.
8. Add per-provider capability checks; mark each capability verified only after real account authorization and a minimal provider API call. Keep unsupported actions disabled.
9. Install client secrets into the preview Worker only after the consumer code and callback are deployed to preview. Promote secrets separately after production approval and verified release.

## Work completed in this change

- Inspected connected Base44 schemas and confirmed the legacy PlatformConnection, PlatformConnectionRecipe, UserCredentialVault, and AdminCredentialReference concepts.
- Inspected Cloudflare account Worker inventory and secret-name listings. The checked Workers had no configured secrets at inspection time; no secret values were read.
- Inspected both active Supabase projects and the deployed Edge Function inventory. No provider OAuth Edge Function was present in the two project function lists.
- Identified that `ifund-managed-connections-agent-preview` currently reports `provider_execution: false`; its provider registration/capability receipts are not verified.
- Identified that the legacy `ifund-oauth` Worker is a limited IFund agent OAuth service, not a social-provider OAuth consumer. Do not attach social-provider credentials to it without changing its trust boundary and implementing the provider flow.
- Did not create credentials, change provider settings, modify DNS, deploy production code, or write secrets.

## Verification references

- LinkedIn OAuth 2.0 authorization-code flow: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- Google OpenID Connect setup: https://developers.google.com/identity/openid-connect/openid-connect
- TikTok OAuth v2 migration guidance: https://developers.tiktok.com/bulletin/migration-guidance-oauth-v1
- Cloudflare Worker Secrets API: https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/secrets/
- Cloudflare secret handling: https://developers.cloudflare.com/workers/configuration/secrets/

## Human/provider gates (do not block unrelated implementation)

- Existing provider developer-account access must be available in an authorized connected session. Do not request or store the user's main account password.
- Provider-specific business verification, app review, legal terms, MFA, CAPTCHA, and identity confirmation remain provider-controlled.
- Any paid provider plan, paid API add-on, browser automation credit, or subscription upgrade requires separate explicit approval.

## Acceptance criteria

- No provider marked connected before successful token exchange + identity lookup + minimal API verification.
- No raw client secret, access token, refresh token, auth code, PKCE verifier, or state value in source, GitHub, Base44, logs, analytics, or client responses.
- RLS and service-side authorization prove one user cannot read or refresh another user's tokens.
- Preview and production credentials and redirect URIs are isolated.
- Reconnect, refresh-token rotation, disconnect/revocation, provider denial and account deletion are covered by tests.
- Social publishing and fundraising operations use distinct least-privilege capabilities; OAuth login must not imply posting, donor, campaign, or payment authority.