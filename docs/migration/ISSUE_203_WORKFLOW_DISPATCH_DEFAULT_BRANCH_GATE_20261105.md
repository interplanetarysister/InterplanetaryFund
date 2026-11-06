# Issue #203 — original frontend preview dispatch gate (2026-11-05)

## Verified state
- PR #225 is merged as fa3ee636 into migration/base44-frontend-parity-20261103.
- The workflow `.github/workflows/original-frontend-preview.yml` exists on the migration branch, with only `workflow_dispatch` as its trigger.
- Fetching that same workflow from `main` returned GitHub 404 at review time.
- GitHub requires workflow_dispatch workflows to be present on the repository default branch for dispatch. Therefore a merge to a non-default migration branch alone does **not** make this workflow dispatchable; do not report preview deployment based on PR #225.
- Lead architecture branch is 38 commits ahead and 3 behind migration. Do not wholesale merge.

## Safe integration handoff
1. Frontend/release owner: propose a **workflow-only** PR adding this exact reviewed preview workflow to the default branch, with production explicitly disabled. Check for workflow-file permission and CI review. Do not merge the reconstructed frontend or unrelated branch changes.
2. Confirm the canonical `interplanetary-fund2/main` SHA, required Base44 repository variables, Cloudflare credentials, and a nonproduction Pages branch before dispatch.
3. Record the Actions run URL, immutable source SHA, Cloudflare deployment URL, `ifund-source.json`, and JS/CSS/deep-link checks.
4. Independently verify rendered mobile pages, original AI wizard, guest navigation, Base44 SDK auth/data/functions calls and redirect behavior. A successful HTTP probe is not parity evidence.
5. Keep production, live payments, DNS and Base44 retirement unchanged. Dependency-unit replacement remains deferred until the owner authorizes each unit.

This is a coordination checkpoint only; no live dispatch or parity verification is claimed.
