# Backend QA: production account recovery gate (2026-11-03)

Scope: read-only inspection of production Supabase project `ssibsfmtodgximseeqsv`. This checkpoint does not authorize backend replacement while the original Base44-connected frontend preview remains unverified under issue #203.

## Observed

- The existing `interplanetarysister@gmail.com` Supabase Auth user has a confirmed email, is not banned, and has one linked Auth identity.
- The protected `auth.users.raw_app_meta_data.role` value is `super_admin`. This is **not** evidence that password sign-in or authorization via the website succeeds.
- `public.ifund_current_user_is_verified_admin()` and `public.ifund_current_user_is_verified_super_admin()` exist and the `authenticated` database role has EXECUTE privilege. This is **not** evidence that the particular account passes either verifier when invoked with its JWT.
- Do not create a second admin identity, set roles through profile/user metadata, reveal password hashes, or change credentials as part of QA.

## Required end-to-end gate (not yet verified)

1. From the original frontend on the actual Cloudflare preview URL, request password recovery using the existing account, confirm delivery to its mailbox and that the configured Supabase recovery template matches the UI's link-or-code method.
2. Complete recovery in a fresh browser session, confirm password login, session refresh, sign-out, and deep-link return to the saved campaign draft. Never log or store recovery codes or passwords.
3. With the actual user JWT, call both verified-admin RPCs and check that authorization passes; verify another ordinary account fails and that RLS blocks unauthorized reads/writes.
4. Test mobile viewport, guest browsing and drafting, and the existing Base44 connections on the restored preview before any backend replacement.
5. Keep financial operations fail-closed; no mock donations or withdrawal tests against live funds. Validate 7% withdrawal fee and owner-only controls in isolated fixtures.

## Release decision

Blocked: original frontend Cloudflare preview and live auth/recovery flow have not been proven. No production promotion, DNS changes, Base44 SDK removal, payment activation, or credential mutation based on these checks. Backend functional-unit migration requires subsequent explicit authorization.
