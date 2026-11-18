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

Use the canonical migration API Worker, `interplanetary-fund-api-migration`, for this route. The existing `ifund-oauth` Worker is a separate legacy D1 portal and must not be overwritten or treated as the member OAuth token vault.

Bind the following on the canonical Worker only:

| Binding | Type | Required value |
| --- | --- | --- |
| `OAUTH_API_ENABLED` | Plain-text variable | Keep `false` until every runtime and provider gate passes |
| `OAUTH_FRONTEND_ORIGINS` | Plain-text variable | Exact comma-separated HTTPS origins, with no paths or trailing slash: `https://interplanetaryfund.com,https://www.interplanetaryfund.com` |
| `SUPABASE_URL` | Plain-text variable | The active InterplanetaryFund Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Secret | The active project's publishable key |
| `SUPABASE_SECRET_KEY` | Secret | Server-only Supabase secret key; never put it in Pages, Vite, or Git |
| `OAUTH_ENCRYPTION_KEY` | Secret | A unique base64-encoded 32-byte key for this environment |

Provider client IDs and client secrets are separate Worker bindings. Configure only providers with current app registration and approved scopes. Do not infer provider approval from a client ID/secret being present.

The admin status endpoint returns binding names and configured booleans only; it never returns binding values. It permits same-origin status diagnostics while the frontend-origin allowlist is still missing, but authorization start/callback/refresh routes remain fail-closed. A provider is not connected until a real member completes consent and provider identity/permission verification. Publishing rights remain a separate gate.

Before enabling `OAUTH_API_ENABLED`, verify the active Supabase project, apply and verify the OAuth vault migrations, bind the server-only key, test a real member OAuth round trip for each enabled provider, and confirm the canonical Worker route is attached to the approved Pages origin. Never repoint or replace the legacy D1 OAuth portal as a shortcut.
