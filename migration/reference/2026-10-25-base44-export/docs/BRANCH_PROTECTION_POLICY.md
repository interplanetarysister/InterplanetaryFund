# Branch Protection Policy — `main`

| | |
|---|---|
| **Policy** | IF-SEC-BRANCH-001 |
| **Status** | Active |
| **Applies to** | `refs/heads/main` of `interplanetarysister/interplanetary-fund2` (the canonical production-facing branch of the Interplanetary Fund Base44 application) |
| **Enforcement mechanism** | GitHub repository ruleset `main-protection-quality-gates` (id `24987847`, `enforcement: active`) |
| **Current revision** | 2 — 2026-10-13 |
| **Tracking** | Issue #175 |

## 1. Purpose

Guarantee that every change reaching `main` is intentional, attributable, and validated: unreviewable or unverified commits must not silently become the production application state. This policy implements the repository's security priority order and the acceptance criteria of issue #175.

## 2. Scope and change paths

Changes reach `main` by exactly two permitted paths:

1. **Pull request (standard path).** Any contributor or agent authenticated as a GitHub user pushes a feature branch and opens a pull request against `main`. This path is fully gated (§4).
2. **Base44 builder sync (platform path).** The Base44 builder application (`base44-builder[bot]`, GitHub App `base44-builder`, app id `2344725`) pushes application changes made through the Base44 builder directly to `main`. This path is an authorized bypass of the pull-request rule (§4.3).

There is no third path: direct pushes by any other identity, including repository administrators, are rejected.

## 3. Roles and responsibilities

- **Repository owner / queue owner:** decides ruleset changes and emergency exceptions; records decisions on the tracking issue.
- **Contributing agents and humans (GitHub identities):** must use the pull-request path. They are responsible for keeping PR branches' checks green and recording review evidence on the PR per the Agent 2+3 / Agent 3 workflow.
- **Base44 builder integration:** sole bypass actor; its sync commits must contain Base44 application state only, and every such commit automatically triggers the full quality-gates CI on `main` (see `.github/workflows/quality-gates.yml`, which runs for `base44-builder[bot]` actor).
- **Review/audit agents:** record verification evidence (diff analysis, test results, security findings) on the relevant PR or issue; see §4.4 for the current approval limitation.

## 4. Policy statements (in force)

### 4.1 Pull requests are mandatory
`main` accepts commits only through pull requests, except for the Base44 builder bypass (§4.3). Stale review state is dismissed on new pushes (`dismiss_stale_reviews_on_push: true`). Force pushes (`non_fast_forward` blocked) and branch deletion (`deletion` blocked) are prohibited for all identities.

### 4.2 Required status checks — exact head
A pull request can merge only after these three checks from `Production Quality Gates` (`.github/workflows/quality-gates.yml`) have passed on the pull request's head commit:

1. `Node 20 Base44 compatibility build`
2. `Node current compatibility build`
3. `Typecheck on Base44 baseline`

The required-checks policy is **non-strict** (checks must pass on the PR head; the PR branch is not required to be current with `main` at merge time). Rationale: `main` advances continuously through Base44 builder sync (multiple commits per hour are normal); an up-to-date requirement would make the standard path practically unusable. Merge methods are unrestricted; squash merges are the current convention. Required checks are limited to checks that demonstrably run on every pull request to `main` — no speculative check names.

### 4.3 Base44 builder bypass (authorized, auditable)
The Base44 builder application is a bypass actor (`actor_type: Integration`, app id `2344725`, `bypass_mode: always`) because the Base44 builder is the application's operational editing/publishing surface: changes made there sync to this repository by direct push, and cannot flow through GitHub pull requests. Compensating controls:

- Builder sync commits trigger the same full CI suite on `main` (workflow `if` includes `github.actor == 'base44-builder[bot]'`), so failed gates are visible on the exact main commit.
- Bypass events are recorded in the ruleset's rule-suite evaluation log (Settings → Rules → Rulesets → insights).
- No user, admin, or agent token is a bypass actor; the owner token is also blocked from direct pushes (verified 2026-10-13).

### 4.4 Approving reviews: currently zero, by constraint
`required_approving_review_count` is `0`. All agent work authenticates as the single owner identity (`interplanetarysister`), and GitHub does not allow a PR author to approve their own pull request; any count ≥ 1 would deadlock every agent-authored PR. Compensating control: review/audit evidence is recorded in PR comments per the Agent 2+3 / Agent 3 workflow. Upgrade path: create a second (service/bot) GitHub identity for review agents, then set `required_approving_review_count: 1` and add CODEOWNERS.

### 4.5 No standing administrator bypass
Repository admins are subject to these rules. The emergency path (§6) is the only sanctioned exception.

## 5. Compliance verification

Policy enforcement is verified by negative and positive tests, each recorded on the tracking issue:

- Direct push to `main` with the owner token must be rejected (`push declined due to repository rule violations`).
- Merge of a PR before its required checks complete must be rejected by the ruleset.
- A PR must merge successfully once all three required checks pass on its head.
- Builder sync commits must continue to land on `main` and run CI (bypass functioning).

The ruleset configuration itself is authoritative and verifiable via the rulesets API at any time.

## 6. Emergency / exception path

There is no standing bypass other than the Base44 builder. For a verified emergency that cannot flow through a pull request:

1. Temporarily set the ruleset `enforcement` to `evaluate` or `disabled` (GitHub UI: Settings → Rules → Rulesets, or API `PUT /repos/interplanetarysister/interplanetary-fund2/rulesets/24987847` with `{"enforcement":"disabled"}`).
2. Perform the minimal emergency change.
3. Re-enable `active` immediately.
4. Record the change, its justification, and the exception window in the tracking issue (comment on issue #175).

## 7. Required evidence for release promotion

Before any publication or production claim based on `main`:

1. CI green on the exact head commit of `main` (all three required checks, per §4.2), or on the builder sync commit per §4.3.
2. The change arrived through a gated path (PR with passing checks, or builder sync with CI on main).
3. Review/audit evidence for the change is recorded on the tracking issue or PR.

## 8. Revision history

| Revision | Date | Change |
|---|---|---|
| 1 | 2026-09-08 | Initial ruleset (id 22501172): PR required, strict checks `Lint and production build` + `Typecheck (informational baseline)`, no bypass actors. Applied and verified per issue #175. |
| — | 2026-09-08 → 2026-10-13 | **Regression period:** ruleset 22501172 was deleted without documented authorization; ~2,900 builder sync commits landed on an unprotected `main`. Detected 2026-10-13 during policy review. |
| 2 | 2026-10-13 | Ruleset restored (id 24987847) with reconciled design: required checks updated to the three current quality-gates jobs, non-strict exact-head policy (main moves hourly via builder sync), and explicit authorized bypass for the Base44 builder integration (app id 2344725) so the platform sync path is no longer in conflict with branch gating. |
