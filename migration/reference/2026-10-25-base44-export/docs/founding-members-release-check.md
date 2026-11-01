# Founding Members release check

This release uses the existing [release-check] commit marker so Production Quality Gates execute on main and Cloudflare deploy only follows a successful validated main run. This intentionally does not re-enable Android builds.

Validate:

1. Run `node scripts/verify-founding-waitlist.mjs`.
2. Confirm quality-gates workflow on main completes successfully.
3. Confirm Deploy Cloudflare workflow completes, not skipped.
4. Visit `https://interplanetaryfund.com/founding-members`.
5. With an authorized test email, submit consent and signup. Confirm private entity record and duplication suppression.
6. Verify /admin/founding-members is inaccessible to non-admins.
7. Do not send traffic to the waitlist before steps 2-6 pass.

If Cloudflare deployment is skipped or fails, inspect quality job result and Worker routing before announcing release.
