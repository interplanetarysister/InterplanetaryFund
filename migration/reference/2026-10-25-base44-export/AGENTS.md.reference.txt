# AGENTS.md

## Project Context

This is the **authoritative user-facing Interplanetary Fund application implementation repository**, prepared for Base44 hosting.

### Current repository ownership

- **Application implementation target:** `interplanetarysister/interplanetary-fund2` — user-facing Base44 application, frontend, application entities/configuration, application-layer agents and workflows.
- **Current application/backend authority:** the Base44 `interplanetary-fund2` implementation is authoritative for the live application-layer financial boundary, application agents, workflows, and persistence implemented under `base44/`. Historical Convex implementations are read-only evidence unless a specific still-live external dependency is directly verified.
- **Older Vercel/Convex repositories and implementations:** reference/evidence only for recovering useful application behavior when they are not the current owner. Do not copy obsolete hosting/runtime dependencies or create competing state in Base44.
- **Legacy backend snapshots:** reference only unless the user explicitly changes scope.

A PR must target the repository that owns the current change. Never merge a PR from one repository into another. Recover useful behavior by adapting it to the current application architecture, not by blindly copying infrastructure.

## Required first reads

Before substantial work, read:

1. `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` — mandatory zero-credit/resumable work policy.
2. `docs/REPOSITORY_SOURCE_OF_TRUTH.md` — use current applicable ownership information; do not restore a legacy Convex runtime dependency merely because older documentation names it.
3. `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` — evidence-based feature baseline when feature work is involved; historical infrastructure statements are evidence, not automatic permission to duplicate runtime.
4. The current issue/PR, branch/head, existing handoffs, and recent findings.

Do not rely on old chat transcripts or stale archived infrastructure decisions when a newer repository directive supersedes them, but do not silently override an existing backend/runtime owner with a documentation-only Base44 rule.

## Mandatory zero-credit development rule

All development/build/review agents, Codex/Copilot-style agents, Agent 1/2/3, and development workflows must follow `docs/ZERO_CREDIT_CONTINUOUS_WORK.md`.

While the zero-credit constraint is active:
- do not initiate metered Base44 builder, agent, workflow, API, deployment, or other paid operations;
- do not bypass quotas, billing controls, or rate limits;
- do not create recursive self-triggering loops to evade provider limits;
- use confirmed legitimate zero-credit repository/local/deterministic paths wherever possible;
- checkpoint genuinely blocked paid steps and continue independent useful work;
- after three materially different failed attempts at one operation, stop retrying it, repair the path or record the blocker, and continue elsewhere;
- persist enough state that later work resumes instead of restarting.

The goal is a self-checking, resumable, deterministic, low-resource development system, not endless agent execution.


## Mandatory GitHub open-source discovery — owner directive 2026-10-13

**Before implementing EVERY new feature, integration, significant enhancement, or repair**, search GitHub for existing open-source software, libraries, adapters, SDKs, and self-hostable services that can safely provide the needed capability. Treat this as a pre-build discovery and reuse gate, not as permission to replace the product or its hosting.

For each feature:
1. Describe the capability and inspect IFund's current implementation to avoid rebuilding what exists.
2. Search GitHub and verify candidate repositories at the source, prioritizing maintained, documented, reusable projects.
3. Evaluate each candidate's actual license (including dependency licenses and trademark/commercial constraints), maintenance/commit activity, known security issues, integration/API fit, platform/runtime compatibility, privacy/credential handling, and realistic operating costs. Publicly viewable source alone is not proof of an open-source license.
4. Choose reuse, adaptation, a small compatible integration, or original code based on evidence. Record the evaluated candidate links, decision, reasons for rejection, and test/rollback plan in the current canonical issue, PR, or implementation handoff.
5. Preserve existing working Base44/GitHub architecture, grants, UI, credentials, and integrations. Never replace or activate a third-party service, deploy infrastructure, or incur fees without appropriate authorization and verification. Prefer modular adapters so providers can be exchanged without rewriting IFund features.
6. Verify the resulting implementation and provider permissions end-to-end before describing it as operational. An open-source repository is not a verified live connection.

**Current milestone:** Buffer personal-API-key integration is an optional admin-account social-publishing adapter, not a replacement for IFund's social messaging, connections hub, or existing publishers. Keep it disconnected/unverified until the secret is securely provisioned and actual Buffer API access and safe publishing behavior are tested. **After that integration is verified functioning, remind the owner to initiate a dedicated GitHub open-source reuse audit of failing IFund software**; do not prematurely claim the audit occurred or automatically replace functionality.

## Base44 portability freeze — effective 2026-09-28

Feature development is temporarily frozen while Interplanetary Fund is prepared for host portability.

This is a **preserve-and-switch** migration, not a Base44-removal project.

### Non-destructive migration rule

- Do **not** delete, disable, replace, or deliberately break a working Base44 dependency merely because an alternate host is being prepared.
- Keep the Base44 version operational and behaviorally authoritative during the preparation period.
- Preserve Base44 entities, RLS, auth, backend functions, agents, workflows, connectors, storage paths, secrets references, webhooks, and other working integrations until a separately verified cutover is explicitly authorized.
- Prepare dependencies so they can later be suspended, redirected, or switched to an alternate host through documented adapters/configuration/cutover controls.
- Prefer provider-neutral interfaces and reversible configuration boundaries around existing Base44 behavior. Do not prematurely route production traffic to an unverified replacement.
- Never copy secret values into source control. Record only secret/reference names and migration requirements.
- A successful alternate deployment does not prove independence. Every runtime dependency must be inventoried and its alternate path verified before cutover.
- Base44 and alternate-host implementations must not create competing financial ledgers, user identities, or mutable production sources of truth during the preparation phase.

### Agent 1 — dependency and portability engineer

Agent 1 owns the dependency inventory and preparation implementation.

For every Base44 dependency, record:
1. dependency/service;
2. exact source/config/schema/function locations;
3. consumers and data involved;
4. authorization/security requirements;
5. current Base44 behavior;
6. proposed alternate-host equivalent;
7. adapter/configuration/cutover mechanism;
8. rollback mechanism;
9. verification required before activation;
10. status.

Agent 1 may add non-destructive adapters, interfaces, configuration switches, tests, documentation, and dormant alternate-host implementations. Agent 1 must not remove the working Base44 path.

### Agent 2 — independent migration and security reviewer

Agent 2 independently audits Agent 1's inventory and changes. Specifically search for missed RLS/service-role behavior, authentication assumptions, financial invariants, secrets, OAuth grants, connector state, webhooks, scheduled/workflow execution, uploads/storage, environment configuration, agent runtimes, and generated Base44 configuration.

Reject a portability change if it weakens authorization, privacy, idempotency, financial integrity, auditability, rollback capability, or the current Base44 production path.

### Agent 3 — parity, recovery, and cutover QA

Agent 3 establishes and maintains the Base44 reference baseline: routes, components, assets, responsive/mobile behavior, important UI states, auth flows, campaign behavior, donations/withdrawals, administration, agents, community/social behavior, and integrations.

For each alternate implementation, verify parity without changing production authority. Maintain explicit cutover and rollback tests. A dependency is cutover-ready only after Agent 1 implementation, Agent 2 approval, and Agent 3 verification.

### Shared completion gate

During this freeze, completion means **zero undiscovered Base44 runtime dependencies and a verified reversible alternate path for each dependency**. It does not mean deleting Base44, switching production early, or merely obtaining a successful alternate-host build.

Required sequence: **inventory -> preserve -> abstract safely -> reproduce -> verify parity -> prepare reversible cutover -> await explicit cutover authorization**.

## Data source rule

Never assume runtime configuration, payment availability, deployment state, environment state, account state, or integration state. Trace information to its authoritative source. If authoritative data is unavailable, record it as unresolved rather than inventing a value.

## Base44 application boundary

Use the existing Base44 application architecture in this repository for product work that it owns. Do not add Vercel-specific dependencies such as `/_vercel/*`, and do not introduce an active Convex runtime dependency into `src/` or `base44/`. The current Base44 financial and agent implementations own their live application behavior. Older Convex/Vercel implementations may be inspected only as read-only evidence for behavior that is still needed.

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `base44/`: Base44 entities and application-layer agent/workflow definitions/configuration.

## Node and npm runtime memory (verified 2026-09-18 UTC)

- Interplanetary Fund app `6a67a778342a8fe05ee79cba` requires Node **20 or newer**. Node 20 and 22 are established tested lanes; newer managed Node runtimes must not be rejected solely because of their major version. Preserve `package.json` engine compatibility at `>=20` and keep runtime verification aligned with that policy.
- Previously observed Base44 sandboxes exposed Node `20.20.2` and Node `22.23.2`; these are environment observations, not permanent version pins. Use the runtime supplied by the authorized Base44 environment when it satisfies Node >=20.
- Before installs/builds/typechecks in a new sandbox, check `node --version`, `npm --version`, and `command -v node`. Do not claim a local runtime change alters Base44's hosted sync/build runtime.
- Repository lifecycle checks may warn when a runtime is newer than established tested lanes, but they must not fail solely because Node is newer than 22. Concrete incompatibilities should be fixed or documented based on evidence rather than a hard-coded future-major block.
- Base44 backend functions use their platform Deno runtime; the Node 20/22 rule concerns Node-based development/build tooling.

## Working Notes

- Do not trigger Base44 commands merely to test whether credits remain.
- Prefer deterministic/local verification that is confirmed not to consume metered project credits.
- Reuse existing SDK/client/plugin patterns before adding integration paths.
- Historical/reconstructed feature material is evidence, not automatic production truth.
- Run relevant confirmed zero-credit checks before finishing code changes.

## External integration truth boundary

- Saving provider credentials or an external profile is configuration only. It must leave the connection disconnected/unverified until a real provider-backed webhook, API read, or successful publish proves access.
- An admin acknowledgement or UI refresh must never manufacture `connected`, `verified`, or `last_synced` state. Provider evidence owns those fields.
- Owner-entered external fundraising totals are `owner_reported`, informational, currency-specific, and non-withdrawable. Never add different currencies into one displayed amount, and never credit them to the Interplanetary Fund ledger without a separate verified transfer.
- Every connection write tied to a campaign must validate campaign ownership server-side; client filtering is not an authorization boundary.
- Preserve these capability semantics if a future Convex/Vercel implementation returns: configuration, provider verification, external observation, and ledger credit remain distinct interfaces.

## Builder preservation rule

When correcting, extending, or improving existing work, edit the current implementation/artifact rather than recreating it from scratch. Preserve valid functionality, architecture, interfaces, and history where practical. Make the smallest coherent modification that satisfies the task.

A full rewrite is allowed only when the existing artifact cannot safely be edited or the task explicitly requires replacement. Document the reason, preserved behavior, and verification plan. This applies to code, configuration, schemas, documentation, agent definitions, workflows, prompts, generated assets, and other produced artifacts.

## Continuity rule

When a new decision changes repository ownership, agent roles, workflow, hosting scope, or application boundaries, update the affected durable repository instructions so stale guidance cannot silently override the newer decision. Runtime/version claims must be derived from the exact current `main` configuration and kept consistent across package metadata, lockfiles, version files, CI, and active PR handoffs; documentation alone cannot declare a new Node target.


## Canonical work-location and anti-duplication rule

Before creating an issue, branch, PR, workflow, verifier, entity, component, function, document, tracker, or replacement implementation, search `docs/CANONICAL_WORK_MAP.md`, current `main`, the owning canonical issue, open PRs, and existing branches. Extend the existing canonical location when one exists.

Do not create date-suffixed, `current-main`, `v2`, retry, run-number, or agent-number variants merely because existing work needs revision. A new location requires a concrete architectural reason the canonical artifact cannot safely represent the change. Reconcile and close superseded work rather than abandoning it beside a replacement.

Preserve published main history. Consolidation means reducing the active work surface, not rewriting old evidence. Before deleting a branch, verify that its unique work is in current `main` or intentionally preserved in a canonical tracker/artifact. One logical repair batch should normally produce one coherent branch/PR/commit path.


## Web and Android release ownership (updated 2026-10-16)

**Owner directive:** IFund's latest APK was built and published through Base44, but GitHub must remain an independent, usable Android build path. The owner can choose Base44, GitHub Actions, or another compatible Android build system for future releases. **No ordinary commit, pull request, GitHub synchronization, security scan, web deployment, or Cloudflare release may automatically compile, package, sign, publish, or require a new APK.**

1. Maintain one authoritative source for the shared frontend and backend. Preserve the `android/` project, Gradle wrapper/configuration, Capacitor, Firebase, signing compatibility, and Android source for intentional native builds in any supported environment.
2. GitHub Android packaging is **manual only**, via `.github/workflows/android-debug-apk.yml` and its `workflow_dispatch` event. An owner-initiated run may generate a debug APK or, once existing signing credentials are securely provisioned, a signed release APK. Never trigger this workflow from push, pull request, tag, website build, other workflow, or scheduled event; never make it a required status check for website/PR merges.
3. Android packaging may run `npm ci`, build the shared frontend, `npx cap sync android`, Android configuration verification, Gradle, artifact/signature validation, and secure artifact upload **inside that explicit manual run**. These are intentionally excluded from routine web/PR CI. If a GitHub security-analysis configuration automatically invokes Gradle, select a non-building scan or exempt Java/Kotlin Android compilation from that automatic analysis without removing Android source.
4. GitHub web CI continues to enforce its relevant independent typecheck, lint, payment, permission, security, and website checks. Website releases can be published through the authorized hosting path without waiting for an APK.
5. A packaged Capacitor Android APK bundles frontend code, so an installed APK is **not** automatically updated by a web deploy. Only claim an APK update after an intentional new native build, compatible signing, suitable versionCode, publication, and actual artifact/device verification. The GitHub signed-release workflow must use the same signing identity as an installed APK to support in-place upgrades; missing signing secrets are a stop condition, never an excuse to generate a new identity silently.
6. Preserve the current Base44-published APK. Do not rebuild, publish, change version codes, or modify release credentials unless the owner explicitly requests an Android build/release. GitHub's availability as a future build option is not permission to run it now.

These rules supersede any earlier Base44-only or routine Android-sync requirement.
