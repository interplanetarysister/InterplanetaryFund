# Member OAuth rollout

Cloudflare Pages serves the existing `apps/web` frontend and the shared migration API router. The Connections page uses same-origin `/api/oauth/*`. Supabase sign-in remains independent. Provider app registration, member consent, provider identity verification and publishing permission are distinct gates.

| Provider | Configuration required |
| --- | --- |
| Google Account | Google web OAuth client ID and secret |
| YouTube | Google web OAuth client plus YouTube API and approved scopes |
| LinkedIn | LinkedIn OAuth app and OpenID Connect product |
| X | OAuth 2.0 user-auth app and API access |
| TikTok | Login Kit for Web; additional scopes depend on app review |
| Facebook Pages | Meta app, approved Pages permissions and a member with an eligible Page role |
| Instagram Business | Dedicated Instagram Login credentials and approved professional-account permissions |

The exact persistent connection redirect is `https://<approved-host>/oauth/callback/<provider-id>`. Use only exact origins in `OAUTH_FRONTEND_ORIGINS`, set the Worker runtime `OAUTH_ENCRYPTION_KEY` to a separate 32-byte key per environment, and bind the Supabase server key and provider credentials as server secrets. The Worker checks configured provider-specific gates; release remains contingent on a real member-account test and verification of the member’s provider grant. See `worker/oauth.js` for binding names. Members can disconnect iFund’s saved access even when new authorizations are disabled. Disconnect removes stored tokens, invalidates pending authorization, and leaves removal of the provider-side grant to the provider’s account settings. Keep `OAUTH_API_ENABLED` off before those gates pass.

Google Drive image import uses Google Identity Services and Picker with the `drive.file` scope and a short-lived browser token. Register the actual Pages or Base44 web origins in the Google OAuth client and enable the Google Drive and Google Picker APIs. Set the public Vite variables in the relevant app's `.env.example`; the Picker API key must have the website and API restrictions described in the [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample). This flow uses a popup, so there is no server callback or refresh token for the Picker. Uploads reuse the app's existing media handlers.

Base44 members authorize through the app-user connector flow for registered providers. Base44 app-owner integrations and editor connections do not establish member readiness. Use each member's own consent and provider-backed verification. The reference app's connector secret inventory contained an Eventbrite app-user registration reference; live authorization and the reference's validity require a member test.

## Canonical Worker runtime setup

The production site routes `/api/oauth/*` through `apps/web/functions/api/oauth/[[path]].js`, a Cloudflare Pages Function that imports the shared `worker/oauth.js` handler. Configure the runtime bindings in the Cloudflare Pages project `interplanetaryfund-migration` for both production and any preview environment where the OAuth gateway is intentionally enabled. Do not assume that bindings on the separate `interplanetary-fund-api-migration` Worker are inherited by Pages Functions. The existing `ifund-oauth` Worker is a separate legacy D1 portal and must not be overwritten or treated as the member OAuth token vault.

Bind the following on the Cloudflare Pages Function runtime:

| Binding | Type | Required value |
| --- | --- | --- |
| `OAUTH_API_ENABLED` | Plain-text variable | Keep `false` until every runtime and provider gate passes |
| `OAUTH_FRONTEND_ORIGINS` | Plain-text variable | Exact comma-separated HTTPS origins, with no paths or trailing slash: `https://interplanetaryfund.com,https://www.interplanetaryfund.com` |
| `SUPABASE_URL` | Plain-text variable | The active InterplanetaryFund Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Plain-text variable | The active project's publishable key (public key; not a secret) |
| `SUPABASE_SECRET_KEY` | Secret | Server-only Supabase secret key; never put it in Pages, Vite, or Git |
| `OAUTH_ENCRYPTION_KEY` | Secret | A unique base64-encoded 32-byte key for this environment |

Provider client IDs and client secrets are separate Worker bindings. Configure only providers with current app registration and approved scopes. Do not infer provider approval from a client ID/secret being present.

The admin status endpoint returns binding names and configured booleans only; it never returns binding values. It permits a same-origin, value-free diagnostic response while Supabase Auth is unavailable; once Auth is configured, only a verified administrator can view provider readiness. A provider is not connected until a real member completes consent and provider identity/permission verification. Publishing rights remain a separate gate.

Before enabling `OAUTH_API_ENABLED`, verify the active Supabase project, apply and verify the OAuth vault migrations, bind the server-only key, test a real member OAuth round trip for each enabled provider, and confirm the Pages Function route is deployed on each approved Pages origin. Keep the allowlist limited to active custom domains actually used for member authorization. Never repoint or replace the legacy D1 OAuth portal as a shortcut.

## 2026-11-18 connected-account audit

- Cloudflare account authenticated as the IFund business account. The production Pages project is `interplanetaryfund-migration`; the active Supabase project is `ssibsfmtodgximseeqsv` in the `interplanetary fund` organization. The older `tzehxfikoslihnclhxuz` project is inactive.
- Production Pages already has the correct Supabase URL, publishable key, JWKS URL, server-only secret binding, and OAuth encryption secret binding. The secret values are masked by Cloudflare's API, so presence is verified but their actual contents/cryptographic validity are not.
- Production Pages `OAUTH_FRONTEND_ORIGINS` was updated and read back as `https://interplanetaryfund.com,https://www.interplanetaryfund.com`. The preview environment remains separate and OAuth-disabled/unconfigured.
- The production Pages environment currently has `OAUTH_API_ENABLED=true`, but no member-provider client ID/secret bindings were found in Pages or the account Secrets Store. The Secrets Store's `SUPABASE_OAUTH_CLIENT_ID` and `SUPABASE_OAUTH_CLIENT_SECRET` are not member social-provider credentials and are not referenced by this Worker. Do not map them into provider slots.
- The Cloudflare account Secrets Store contains existing PayPal and signing credentials. They are already bound to their intended workers: the sandbox broker uses the sandbox app pair and signing key; the payment Worker uses its separate PayPal app pair and signing key. No credentials were copied or rotated.
- Live payment Worker inventory currently reports `IFUND_PAYMENTS_ENABLED=true`, `IFUND_PAYPAL_MODE=live`, the active Supabase URL, and a configured webhook ID. This is a separate payment path; no payment switches, credentials, or routes were changed during the OAuth setup.
- Supabase Postgres `vault.secrets` currently contains no rows. The OAuth implementation stores member provider tokens in its dedicated encrypted OAuth tables and reads runtime credentials from Cloudflare Pages. No unrelated secrets were copied into Supabase Vault.
- The connected Supabase tools can read the project's publishable keys and project metadata but do not expose the project's secret-key value or a project/Edge Function secrets-write operation. The existing Pages `SUPABASE_SECRET_KEY` binding was preserved. Do not attempt to store a server key in SQL or duplicate it in the browser bundle.
- The OAuth provider registrations and actual member consent tests remain outstanding. Keep each provider unavailable until its own matching app credentials and approval are verified.
