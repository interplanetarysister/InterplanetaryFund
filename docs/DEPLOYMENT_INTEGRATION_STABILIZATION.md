# Deployment & Integration Stabilization — Phases 1–3

Status date: 2026-09-03

This record implements the approved stabilization plan literally. A phase is not complete until every listed action is executed or a concrete blocker is recorded.

## Phase 1 — Infrastructure inventory

### GitHub inventory
Interplanetary Fund-related repositories discovered under `interplanetarysister`:
- `InterplanetaryFund` — active authoritative Convex backend/internal-agent runtime and Vercel-served React/Vite frontend path.
- `interplanetary-fund2` — active Base44 user-facing application repository.
- `interplanetary-fund-backend` — legacy/reference according to the Base44 source-of-truth guide, but still has active PR/workflow/deployment state and therefore cannot yet be retired.
- `interplanetary-fund` — additional historical/alternate repository; classification pending dependency proof.
- `interplanetaryfund-base44` — historical/alternate Base44-related repository; classification pending dependency proof.
- `interplanetaryfund1` — alternate repository currently linked to Vercel projects; classification pending dependency proof.
- `convex-vercel-git-44` — private Vercel/Convex integration repository with a Vercel production deployment; classification pending dependency proof.
- `codex44-agent` — private agent-support repository; not assumed to be production application code.

All listed repositories currently use `main` as default branch where reported by GitHub inventory.

### Vercel inventory
Team: `Interplanetary Fund` (`interplanetaryfund`).

Projects discovered:
- `interplanetary-fund` → GitHub `InterplanetaryFund`; Vite; Node 24.x; latest production deployment READY.
- `interplanetary-fund-2bip` → GitHub `InterplanetaryFund`; Vite; Node 24.x; latest production deployment READY.
- `interplanetaryfund0` → GitHub `InterplanetaryFund`; Vite; Node 24.x; latest production deployment CANCELED.
- `interplanetary-fund-backend` → GitHub `interplanetary-fund-backend`; Vite; Node 24.x; latest inspected deployment ERROR and not production-targeted.
- `interplanetaryfund` → GitHub `interplanetaryfund1`.
- `interplanetarysister-interplanetaryfund` → GitHub `interplanetaryfund1`.
- `convex-vercel-git-44` → GitHub `convex-vercel-git-44`; Next.js; Node 24.x; latest production deployment READY.

No Vercel project is deleted in Phase 1. Duplicate retirement requires the later dependency-proof phase.

### Base44 inventory
Owned apps discovered:
- `Interplanetary Fund` — app id `6a67a778342a8fe05ee79cba`; active application inspected.
- `Interplanetary Fund (Copy)` — duplicate/copy candidate; no deletion until dependency proof.
- `IdeaForge` — separate app.
- `LegalAudit Connect` — separate app.

The active Interplanetary Fund Base44 app declares Node 24.x and documents `interplanetary-fund2` as the user-facing Base44 application repository, `InterplanetaryFund` as authoritative Convex backend/internal-agent runtime, and `interplanetary-fund-backend` as legacy/reference unless explicitly assigned.

### Convex references
Repository and application documentation consistently identify `rosy-butterfly-2` / `https://rosy-butterfly-2.convex.cloud` as the intended canonical Convex production deployment. No source reference to `fortunate-narwahl-623` was found in the three core repositories during this pass. Direct account-level Convex deployment enumeration is not exposed by the connected Convex tool in this session, so account-level duplicate deployment inventory remains a concrete tool-access blocker and must be revisited when that capability is exposed.

### Dependency map
`interplanetary-fund2` / Base44 app → Base44-hosted application services and bridge → canonical backend/runtime in `InterplanetaryFund/convex/` → Convex Cloud `rosy-butterfly-2`.

`InterplanetaryFund/src/` → Vercel project `interplanetary-fund` (canonical candidate) → `VITE_CONVEX_URL` → Convex Cloud `rosy-butterfly-2`.

`interplanetary-fund-backend` → legacy/reference by source-of-truth document, but still connected to a Vercel project and active GitHub work; retain until those dependencies are reconciled.

Alternate Vercel projects and alternate repositories remain retained until later dependency proof.

## Phase 2 — Canonical production architecture

Canonical roles established from current source-of-truth documents and live project bindings:
- Canonical user-facing Base44 application: `Interplanetary Fund` app id `6a67a778342a8fe05ee79cba` / repository `interplanetary-fund2`.
- Canonical backend/internal-agent runtime: `InterplanetaryFund/convex/`.
- Canonical Convex deployment: `rosy-butterfly-2`.
- Canonical Vercel frontend candidate: Vercel project `interplanetary-fund` linked to GitHub `InterplanetaryFund`, Vite, Node 24.x, READY production deployment.
- Canonical production branch for the core repositories: `main`.

Resource classifications at this stage:
- ACTIVE/REQUIRED: `InterplanetaryFund`, `interplanetary-fund2`, Base44 `Interplanetary Fund`, Convex `rosy-butterfly-2`, Vercel `interplanetary-fund`.
- REQUIRED UNTIL RECONCILED: `interplanetary-fund-backend` because live Vercel/workflow/PR dependencies still exist despite legacy/reference designation.
- FALLBACK/LEGACY CANDIDATES REQUIRING DEPENDENCY PROOF: Vercel `interplanetary-fund-2bip`, `interplanetaryfund0`, `interplanetaryfund`, `interplanetarysister-interplanetaryfund`, `convex-vercel-git-44`; GitHub `interplanetary-fund`, `interplanetaryfund-base44`, `interplanetaryfund1`, `convex-vercel-git-44`; Base44 `Interplanetary Fund (Copy)`.
- SEPARATE/OUTSIDE APPLICATION PRODUCTION PATH: `IdeaForge`, `LegalAudit Connect`, and agent-support repo `codex44-agent` unless a later dependency audit proves otherwise.
- SAFE TO RETIRE: none yet. Retirement requires later dependency proof.

No new Convex project, replacement deployment, or substitute credential is authorized by this architecture.

## Phase 3 — Node.js and dependency normalization

### Runtime alignment
- `InterplanetaryFund/package.json`: Node 24.x.
- `interplanetary-fund2/package.json`: Node 24.x; `@types/node` 24.
- `interplanetary-fund-backend/package.json`: corrected to Node >=24 <25.
- `interplanetary-fund-backend/.github/workflows/build-android-apk.yml`: corrected from Node 20/setup-node v4 to Node 24/setup-node v6 and checkout v6.
- Inspected Vercel production projects report Node 24.x.
- Active Base44 application package declares Node 24.x.

### Dependency/build compatibility findings
The Base44 sandbox runtime itself currently reports Node v20.20.2 despite the application declaring Node 24.x. This is a Base44 sandbox/runtime mismatch, not a source declaration change. It is recorded rather than hidden.

A literal compatibility run was performed against the active Base44 application:
- `npm ci` initially failed because the sandbox checkout did not contain a lockfile at that moment.
- The sandbox subsequently contained/generated `package-lock.json` and installed dependencies.
- `npm run build` succeeds.
- `npm run lint` fails on one unused import in `src/components/admin/IntegrationsTable.jsx`.
- `npm run typecheck` fails extensively, including Three.js type-checking and existing JSX/component typing issues. These are real dependency/source compatibility blockers and prevent Phase 3 from being declared fully complete until repaired.

No unrelated major dependency upgrade is authorized merely because a newer version exists. In particular, major-version dependency PRs must be validated rather than blindly merged.

## Execution rule
Every subsequent phase must be executed literally. Verification is not a substitute for required writes, repairs, tests, classifications, or documentation. A phase may be marked complete only after every required action is executed and verified, or a concrete external/tool blocker is recorded.