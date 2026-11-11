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

The exact persistent connection redirect is `https://<approved-host>/oauth/callback/<provider-id>`. Use only exact origins in `OAUTH_FRONTEND_ORIGINS`, set the Worker runtime `OAUTH_ENCRYPTION_KEY` to a separate 32-byte key per environment, and bind the Supabase server key and provider credentials as server secrets. The Worker checks configured provider-specific gates; release remains contingent on a real member-account test and an owner-controlled disconnect and provider revocation lifecycle. See `worker/oauth.js` for binding names. Keep `OAUTH_API_ENABLED` off before those gates pass.

Google Drive image import uses Google Identity Services and Picker with the `drive.file` scope and a short-lived browser token. Register the actual Pages or Base44 web origins in the Google OAuth client and enable the Google Drive and Google Picker APIs. Set the public Vite variables in the relevant app's `.env.example`; the Picker API key must have the website and API restrictions described in the [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample). This flow uses a popup, so there is no server callback or refresh token for the Picker. Uploads reuse the app's existing media handlers.

Base44 members authorize through the app-user connector flow for registered providers. Base44 app-owner integrations and editor connections do not establish member readiness. Use each member's own consent and provider-backed verification. The reference app's connector secret inventory contained an Eventbrite app-user registration reference; live authorization and the reference's validity require a member test.
