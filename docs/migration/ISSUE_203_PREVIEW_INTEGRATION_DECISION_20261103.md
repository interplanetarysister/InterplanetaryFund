# Issue #203 — original frontend preview integration decision record (2026-11-03)

## Verified branch and PR evidence
- Integration base: `migration/base44-frontend-parity-20261103`, commit `d4caa4bfc68e43c68bf40f5efc13930927132940` at this checkpoint.
- Lead branch: `agent/lead-architecture` is five commits ahead and zero behind that integration base at inspection. Its delta consists only of `.github/workflows/audit-canonical-frontend.yml` and three `docs/migration/ISSUE_203_*.md` documents; **it does not import the original UI**.
- Open PR #204: narrow original homepage hero asset restoration, not full parity.
- Open PR #206: isolated preview workflow to build `interplanetary-fund2@main` unchanged, retaining Base44 SDK and services. This is the intended first candidate for source-provenance verification; PR status alone is not deployment evidence.
- Open PR #207: Supabase password-recovery routing changes. Do not merge into the original-frontend restoration path until its authentication integration and recovery redirects are tested independently.
- Issue #201 identifies a conflicting 3% donation-fee proposal; approved policy is **7% deducted on owner withdrawal**, never a donor-side campaign gift deduction. Keep the conflicting PR outside this release.

## Integration handoff: sequence and stop conditions
1. Frontend owner validates PR #206 workflow's source repository permissions, immutable source SHA, Cloudflare preview branch, actual output directory, and preserved Base44 configuration. Do not replace working Base44 calls.
2. Integration owner checks branch-head changes and PR file overlaps immediately before merge. Prefer the isolated original-source preview workflow before integrating unrelated reconstructed UI changes. Never reset, rebase, force-push, or overwrite other agents' work.
3. Deploy **preview only**; record source SHA, destination SHA, workflow run URL, Cloudflare deployment ID, Pages build root, output directory, and exact preview URL. A successful HTTP 200 or CI build alone is not proof.
4. On a real mobile browser compare original home hero, navigation, discovery, campaign detail, guest campaign composition, AI wizard, auth screens, and deep-link reloads against the original app. Check missing assets, Base44 API calls, safe-area scrolling, and draft restoration after login.
5. If Base44 calls fail in preview, diagnose origin/CORS/auth/session/configuration first; do not silently swap SDKs or present mock data as successful connectivity.
6. Keep production and DNS untouched. Require owner preview approval, recorded rollback deployment, verified functional parity, and separate authorization for **each** later backend dependency unit.

## Unverified at this checkpoint
No original-source Cloudflare preview URL, visual comparison, or end-to-end Base44 connectivity evidence was established by this architecture inspection. Backend replacement, live payments, production promotion, and Base44 retirement are explicitly **not authorized** by this record.
