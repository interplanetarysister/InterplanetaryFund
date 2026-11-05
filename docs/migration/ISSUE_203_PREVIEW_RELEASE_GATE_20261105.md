# Issue #203 — original-source preview release gate (2026-11-05)

Owner: lead architecture (`agent/lead-architecture`). This is a coordination contract, not permission to edit the frontend, backend or integration branches.

## Preflight and ownership

- Canonical source: `interplanetarysister/interplanetary-fund2@main`, pinned to an immutable commit SHA in the deployment run. Deployable destination: `interplanetarysister/InterplanetaryFund`; integration branch `migration/base44-frontend-parity-20261103`.
- Frontend owner ports source pages/assets/wizard on `agent/frontend-parity`; backend owner only performs non-disruptive tests on `agent/backend-migration`; integration owner controls preview validation and reviewed merges. Lead architecture reviews contracts and releases only documentation from this branch.
- Before each edit or merge, recheck PR status and branch tips. Never force push, rebase, reset or overwrite an agent's changes.
- Keep original Base44 SDK/auth/data/functions **connected** during initial preview. No replacement unit is authorized until the user chooses it.

## Preview release evidence (all required)

1. Workflow source SHA, build command, output directory, Cloudflare project/branch and immutable deployment URL captured in issue #203. Use isolated preview only; no production DNS/route changes.
2. Cloudflare SPA fallback validated **without** generating `/* /index.html 200` redirect loops; direct deep links and JS/CSS/assets return correct MIME types. Fail closed on any loop.
3. Browser visual comparison to canonical source on narrow Android viewport and desktop: original homepage cosmic background/hero, all navigation, four-step AI campaign wizard, five title choices, two descriptions, one section-regenerable story, AI art option and mobile safe-area/scroll behavior.
4. Guest public browsing and draft composition without sign-in; save/post gates to auth and restores the exact draft on return. Verify real Base44 reads/writes from isolated preview with authorized test identity and no production financial writes.
5. Sign-in, recovery and return URLs tested on deployed hostname, not localhost; security/RLS/owner access and financial functions remain fail-closed, no simulated payment or withdrawals; 7% fee remains a separate protected release check.
6. Tests and CI run IDs recorded; deployment asset hashes or screenshots, console/network evidence, and rollback target recorded. A green build alone is insufficient.

## Current blockers and decision

PR #206 isolated original-preview workflow requires a fresh redirect-loop review before execution; previous review found it generating `/* /index.html 200`. PR #209 recovery-code email delivery remains externally unverified. Pages project deployment enablement and actual Base44 connectivity must be checked on the hosted environment. No preview or production success may be claimed until observed.

Release status: **HOLD**. Only integration owner may merge reviewed work into the integration branch. Production additionally requires user approval after verified parity and rollback.
