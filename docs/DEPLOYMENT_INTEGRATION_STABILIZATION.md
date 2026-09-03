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
- `interplanetaryfund1` — alternate repository linked to two Vercel projects; no canonical production references were found pointing to those Vercel aliases.
- `convex-vercel-git-44` — private Vercel/Convex integration repository with a Vercel production deployment; classification pending dependency proof.
- `codex44-agent` — private agent-support repository; not assumed to be production application code.

All listed repositories currently use `main` as default branch where reported by GitHub inventory.

### Vercel inventory
Team: `Interplanetary Fund` (`interplanetaryfund`).

Projects discovered:
- `interplanetary-fund` → GitHub `InterplanetaryFund`; Vite; Node 24.x; current production deployment READY. This is the canonical Vercel production project.
- `interplanetary-fund-2bip` → GitHub `InterplanetaryFund`; Vite; Node 24.x; duplicate production deployment path.
- `interplanetaryfund0` → GitHub `InterplanetaryFund`; Vite; Node 24.x; duplicate/legacy deployment path with canceled recent production activity.
- `interplanetary-fund-backend` → GitHub `interplanetary-fund-backend`; Vite; Node 24.x. Current main production deployment is READY; a failed inspected deployment was a Dependabot preview and not the current production deployment.
- `interplanetaryfund` → GitHub `interplanetaryfund1`; Vite; Node 24.x; current production deployment READY; duplicate alternate application path.
- `interplanetarysister-interplanetaryfund` → GitHub `interplanetaryfund1`; Vite; Node 24.x; current production deployment READY; duplicate of the same alternate repository path.
- `convex-vercel-git-44` → GitHub `convex-vercel-git-44`; Next.js; Node 24.x; current production deployment READY; integration/bridge candidate pending dependency proof.

The canonical project `interplanetary-fund` has no aggregated runtime error clusters in the inspected seven-day production window. Its latest inspected production deployment is sourced from `InterplanetaryFund/main`, READY, Vite, and carries the canonical project aliases.

Repository-wide source search shows production code, tests, agent documentation, email logic, payment redirects, mobile store listing, and health checks consistently reference `https://interplanetary-fund.vercel.app`. No source references were found to the `interplanetary-fund-2bip`, `interplanetaryfund0`, or `interplanetaryfund1.vercel.app` aliases outside this stabilization record. This establishes the canonical hostname dependency at source level.

Vercel Toolbar contains one unresolved report against a backend preview branch stating the page would not load. It remains open until the associated preview is verified; it is not silently resolved during cleanup.

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

`InterplanetaryFund/src/` → Vercel project `interplanetary-fund` → canonical hostname `interplanetary-fund.vercel.app` → `VITE_CONVEX_URL` → Convex Cloud `rosy-butterfly-2`.

`interplanetary-fund-backend` → legacy/reference by source-of-truth document, but still connected to a Vercel project and active GitHub work; retain until those dependencies are reconciled.

Alternate Vercel projects are not part of the documented canonical production hostname path. Their project deletion/unlinking is blocked in this session because the connected Vercel tool exposes read/diagnostic/deploy functions but not project deletion, arbitrary project-setting mutation, domain removal, or Git unlinking.

## Phase 2 — Canonical production architecture

Canonical roles established from current source-of-truth documents, live project bindings, deployment history, and source references:
- Canonical user-facing Base44 application: `Interplanetary Fund` app id `6a67a778342a8fe05ee79cba` / repository `interplanetary-fund2`.
- Canonical backend/internal-agent runtime: `InterplanetaryFund/convex/`.
- Canonical Convex deployment: `rosy-butterfly-2` (repository-confirmed; direct account enumeration remains tool-blocked).
- Canonical Vercel frontend: project `interplanetary-fund` (`prj_WDzizKMTyixwwjTmLASjgj8Of9AY`) linked to GitHub `InterplanetaryFund`, framework Vite, Node 24.x, production branch `main`.
- Canonical Vercel hostname: `https://interplanetary-fund.vercel.app` as established by production source references.
- Canonical production branch for the core repositories: `main`.

Resource classifications:
- ACTIVE/REQUIRED: `InterplanetaryFund`, `interplanetary-fund2`, Base44 `Interplanetary Fund`, Convex `rosy-butterfly-2`, Vercel `interplanetary-fund`.
- REQUIRED UNTIL RECONCILED: `interplanetary-fund-backend` because live Vercel/workflow/PR dependencies still exist despite legacy/reference designation.
- RETIREMENT CANDIDATES — VERCEL DUPLICATES: `interplanetary-fund-2bip`, `interplanetaryfund0`, `interplanetaryfund`, `interplanetarysister-interplanetaryfund`. Source-level canonical hostname checks found no production references requiring these aliases. Final deletion/unlink remains blocked by the current Vercel connector's lack of destructive project/domain/Git-setting functions.
- FALLBACK/LEGACY CANDIDATE REQUIRING INTEGRATION PROOF: Vercel/GitHub `convex-vercel-git-44` because it may still perform an integration/bridge role and must not be retired merely because the canonical frontend is elsewhere.
- GITHUB LEGACY CANDIDATES REQUIRING REPOSITORY-SPECIFIC PROOF: `interplanetary-fund`, `interplanetaryfund-base44`, `interplanetaryfund1`.
- BASE44 DUPLICATE CANDIDATE: `Interplanetary Fund (Copy)`.
- SEPARATE/OUTSIDE APPLICATION PRODUCTION PATH: `IdeaForge`, `LegalAudit Connect`, and agent-support repo `codex44-agent` unless a later dependency audit proves otherwise.

No new Vercel repository or project is required for consolidation. The existing working canonical Vercel project is retained and duplicates are retired around it after dependency proof. No new Convex project, replacement deployment, or substitute credential is authorized.

## Phase 3 — Node.js and dependency normalization

### Runtime alignment
- `InterplanetaryFund/package.json`: Node 24.x.
- `interplanetary-fund2/package.json`: Node 24.x; `@types/node` 24.
- `interplanetary-fund-backend/package.json`: corrected to Node >=24 <25.
- `interplanetary-fund-backend/.github/workflows/build-android-apk.yml`: corrected from Node 20/setup-node v4 to Node 24/setup-node v6 and checkout v6.
- Inspected Vercel projects report Node 24.x, including both alternate `interplanetaryfund1` projects.
- Active Base44 application package declares Node 24.x.

### Dependency/build compatibility findings
The Base44 sandbox runtime itself currently reports Node v20.20.2 despite the application declaring Node 24.x. This is a Base44 sandbox/runtime mismatch, not a source declaration change. It is recorded for the separately scheduled Base44 repair.

The active Base44 application source was repaired and validation rerun:
- Removed the unused `AUTH_TYPE_LABEL` import from `src/components/admin/IntegrationsTable.jsx`.
- Corrected JavaScript typecheck configuration so dependency JavaScript is not incorrectly treated as application source.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.

Vercel deployment compatibility findings:
- Canonical `interplanetary-fund` production is READY on Node 24.x.
- Backend main production is READY on Node 24.x.
- The inspected backend Dependabot preview failure is caused by a major Vite/Rolldown compatibility change to `manualChunks`; it is not evidence of a production failure and must not be blindly merged.
- Alternate `interplanetaryfund1` projects show the same dependency-preview history, including failed intermediate builds followed by a READY compatibility-adjusted preview.

No unrelated major dependency upgrade is authorized merely because a newer version exists.

## Vercel consolidation execution state

Completed:
1. Enumerated every Vercel function exposed to this session and mapped useful capabilities to the stabilization plan.
2. Inspected all seven Vercel projects, including the two previously missing `interplanetaryfund1` projects.
3. Inspected deployment histories for the canonical and duplicate paths and distinguished production failures from preview failures.
4. Confirmed Node 24.x on all inspected Vercel projects.
5. Confirmed canonical project runtime-error aggregation reports no error clusters for the inspected seven-day production window.
6. Established `interplanetary-fund` / `InterplanetaryFund/main` / `interplanetary-fund.vercel.app` as the single canonical Vercel frontend path.
7. Searched core source for Vercel hostname dependencies and found canonical references consistently point to `interplanetary-fund.vercel.app`.
8. Classified four Vercel projects as duplicate retirement candidates rather than creating another project.

External/tool blockers to complete destructive Vercel organization:
- The connected Vercel tool does not expose project deletion/removal.
- It does not expose arbitrary project-setting updates or Git unlinking.
- It does not expose project-domain removal/reassignment operations.
- It does not expose direct environment-variable list/mutation operations, so secret values are neither requested nor exposed here.

These operations must not be reported as completed until an authorized Vercel interface exposing them is available. Until then, the canonical project is preserved and the duplicate projects are explicitly documented as retirement candidates rather than being modified destructively.

## Execution rule
Every subsequent phase must be executed literally. Verification is not a substitute for required writes, repairs, tests, classifications, or documentation. A phase may be marked complete only after every required action is executed and verified, or a concrete external/tool blocker is recorded.