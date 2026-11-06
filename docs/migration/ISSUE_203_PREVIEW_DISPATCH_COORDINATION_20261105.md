# Issue #203 — preview dispatch and branch coordination decision (2026-11-05)

Owner: lead architecture; branch: `agent/lead-architecture`. This document is an integration handoff, not an instruction to merge draft PRs.

## Observed state

- The lead branch is 27 commits ahead and 2 behind `migration/base44-frontend-parity-20261103` at review time. It must not be merged wholesale merely to obtain a deployment workflow.
- PR #206 is the isolated original-source preview candidate. Its redirect-loop guard was reported corrected in the latest architecture review, but a live preview and Base44 connectivity have not been demonstrated.
- Other open PRs cover unrelated studio, growth, communications, auth, and migration changes. Do not bundle them into the original-frontend preview release.

## Dispatch without risky default-branch promotion

GitHub `workflow_dispatch` requires the workflow definition to be present on the repository default branch before manual dispatch is available. A workflow existing only in a feature branch is not a reliable manual-dispatch entrypoint. Do not merge all of PR #206 to `main` to solve this.

Integration owner should select **one** safe mechanism after checking the currently registered workflows and repository permissions:

1. Prefer an already registered, reviewed default-branch workflow that accepts an immutable canonical source SHA and deploys to an isolated Cloudflare preview project/branch only; or
2. Submit a minimal, separately reviewed default-branch workflow-registration PR containing only a fail-closed manual-dispatch entrypoint, pinned source checkout, explicit preview-only target, and required secret checks. No production deployment or application code in that PR.

Before running, capture the canonical `interplanetary-fund2/main` SHA and Cloudflare project/account target. Ensure the preview deployment cannot update production aliases, DNS, or Workers routes. Never inject `/* /index.html 200` into the original SPA artifact. Keep Base44 SDK/auth/data/functions intact for this phase.

## Acceptance evidence for integration owner

Record on issue #203: workflow/run URL, exact source SHA, deploy target, immutable preview URL, response/redirect checks for `/` and a direct campaign deep link, JS/CSS MIME and asset fetches, Android-width screenshots against the original, original wizard/AI art presence, guest browse/draft flow, auth return-to-draft, and an authorized Base44 read. Tests and build logs alone do not establish parity.

Release decision remains HOLD until those checks pass. Production additionally requires explicit owner approval and rollback readiness. Backend replacement remains out of scope until the owner authorizes one entire dependency unit.
