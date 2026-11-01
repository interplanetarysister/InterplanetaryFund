# Independent login return-to parity — 2026-11-01

Original source reference: `interplanetarysister/interplanetary-fund2/main` (`src/lib/authReturnTo.js` blob `312407a804476681870917f4c050a1f8252dfddb`, `src/components/ProtectedRoute.jsx` blob `6018bc645332cd1f5d9d02326df7be7501e4a754`).

This narrow migration restores same-origin return-path validation for the existing independent Supabase passwordless sign-in preview. The original login flow uses `returnTo` to preserve path, query and hash, rejects external paths and URL-normalization attacks, and strips bootstrap credential/endpoint override keys before redirect. The independent landing path is `/mine` while the original source uses `/dashboard`; this must be reconciled when the complete original dashboard route is restored, rather than silently sending users to a nonexistent page.

Changes are intentionally bounded: protected existing `/create`, `/edit/:id`, `/mine`, `/connections` and `/my-blog` sign-in calls preserve the requested destination. OTP verification navigates to the validated target, OAuth callback retains the target in its redirect URL, and signed-in login UI offers a safe continue link. Sign-out failures report an error, not a false success. No account, legal acceptance or database records are modified by this change.

**Not certified / dependencies:** Supabase Auth site URL and OAuth redirects, provider authorization, verified email/OTP delivery, account suspension/deletion lifecycle, first-login onboarding, signed-in account restoration, legal Terms acceptance, and two-account RLS remain independent gates. The current independent root app remains a reduced preview. Do not treat this helper as complete authentication parity or use it to bypass legal acceptance.

Email-function migration, paid subscriptions, campaign payments, and provider activation remain deferred as directed by the owner.
