# Base44-free IFund OAuth and sign-in configuration

Status: **code prepared, provider credentials NOT issued or installed, no production auth change**.
Authority: issue #137; part of Phase 3 PR #140.

## Two different uses of OAuth

1. **Users signing in to IFund (first-party browser app).** The Vite/React frontend uses `@supabase/supabase-js` with a Supabase **publishable key** and authorization-code **PKCE**. It does **not** need a custom confidential OAuth client ID or client secret. Google and Facebook buttons request sign-in through **Supabase Auth**; for those buttons to function, create provider-specific web app credentials in **Google Cloud Console** and **Meta for Developers**, respectively, then install their client IDs/secrets **inside Supabase Auth > Providers**. The Meta App ID acts as a client ID. These secrets must not be sent to the frontend, placed in `.env.example`, or committed to GitHub.
2. **Third-party apps signing in *with IFund* (IFund as identity provider).** Only if that product feature is required, enable **Supabase Authentication > OAuth Server**, implement the authenticated user-consent screen at an HTTPS URL, and register each third-party app in **Authentication > OAuth Apps**. Browser/mobile clients must be **public + PKCE, without a client secret**; a server-side confidential client can use `client_secret_basic`, with its secret in a server-side secret store only. **Do not enable** this feature until client-specific RLS and consent screens have been security-tested; OAuth scopes alone do not restrict database access.

## Supabase project identification before live setup

Issue #137 explicitly identifies the target **Ifund** project reference `tzehxfikoslihnclhxuz`. A second, more recently created project named **InterplanetaryFund**, ref `ssibsfmtodgximseeqsv`, also exists. Do not silently mix clients, keys, callback URLs, or user identities between them. Confirm which project is assigned to the production Cloudflare Pages build before provider changes. Current GitHub `.env.example` intentionally contains only placeholders.

During the 2026-10-24 inspection, `auth.oauth_clients` and `auth.custom_oauth_providers` each had **zero rows** on both projects. This does **not** establish whether built-in Google/Facebook provider toggles have been configured, and is not proof that any OAuth server is enabled. The connected Supabase actions do not expose the dashboard/management operation needed to register provider credentials or OAuth clients; direct writes into `auth.*` internals are not a supported substitute.

## Secure provider setup after target confirmation

1. At the correct Supabase project, set **Authentication > URL Configuration > Site URL** to the actual deployed HTTPS app URL, not a Base44 URL. Add only the exact authorized login redirect(s), e.g. `https://interplanetaryfund.com/login` **after** the live domain points at this frontend. Do not redirect production users to the Wix marketing page before cutover.
2. Register a **Web application** with Google Cloud. Set its authorized OAuth redirect URI to `https://<approved-project-ref>.supabase.co/auth/v1/callback`. Store the issued Google web OAuth client ID and client secret in Supabase's Google provider configuration; enable provider only when ready to test.
3. Register the appropriate consumer login app in Meta for Developers. Configure its **Valid OAuth Redirect URIs** with the same Supabase project callback URI, following Meta's exact current product requirements. Store its Meta App ID and App Secret in Supabase's Facebook provider configuration; do not reuse a Base44-specific app without reviewing approved domains and privacy policy.
4. Configure the email-code template to include `{{ .Token }}`; verify sender setup, verification, expiry, abuse limits and behavior. Existing users' old Base44 passwords and linked identities must not be assumed portable.
5. In an authorized *staging* browser session, test Google, Facebook, and OTP redirects, success and denial, session refresh, logout, redirect allowlist rejection, existing-owner account claim consent, RLS denial of unauthorized financial rows and server-side secret isolation. Only then request review for deployment.

## Credentials separation and expected environment

- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` only. Neither is an OAuth client secret.
- Supabase Auth dashboard: Google OAuth Web Client ID + Secret; Meta App ID + App Secret (server-managed values).
- Optional third-party IFund OAuth client: OAuth Apps registration creates an ID and, **for confidential clients only**, a one-time secret. Store that secret only with its own server-side integration.
- Cloudflare Worker: use provider credentials only through protected encrypted secrets bindings when a server-side integration explicitly needs them; browser never receives them.
- Do not use the Auth0 Native Android client ID as the IFund Web client and do not invent a replacement client secret.

No live authentication provider changes, external console registrations, production SQL, DNS or payment changes were performed in this phase.
