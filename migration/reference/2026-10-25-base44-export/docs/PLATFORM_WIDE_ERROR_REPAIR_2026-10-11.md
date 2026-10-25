# IFund platform-wide error repair workflow

## Runtime policy
IFund accepts every Node.js major version **20 or greater**, without a frozen upper bound. package.json and lockfile declare >=20; .nvmrc/.node-version and GitHub setup-node track the current Node release ("node"). No CI workflow is intentionally triggered by this document. Real upgrades still require green build and compatibility tests before deployment.

## User-visible error -> system-wide fix
1. Global script/resource errors, unhandled promises, React rendering failures, failed page views, query/mutation failures, and unexpected app startup errors report through src/lib/platformErrorReporter.js. A swallowed error that is not surfaced through these integration points still needs explicit instrumentation.
2. base44/functions/managePlatformIncidents/entry.ts groups untrusted diagnostic reports, redacts details and stores reviewable PlatformIncident records. Reports do not contain raw stack traces, passwords, access tokens, account IDs, or request bodies. Grouped events are never proof of root cause.
3. Server records start with a provisional platform-wide scope, regression/verification checklist and rollback plan. The super-admin investigates the actual shared root cause and saves a more precise correction plan.
4. Admin chat -> Admin tools -> Platform errors and fix plans offers frontend review, edit, save, approve/dispatch and reject. The Admin Builder chat tool can list/save/approve a specific incident after explicit super-admin instruction. Every privileged backend call validates the signed-in super-admin account.
5. Approval creates a tracked AgentDelegation assigned to admin_builder_agent. If the independently configured, backend-only Base44 workspace/platform token and explicit credit-authorization flag are both present, this sends a real app-builder edit turn to the fixed authoritative IFund app ID via Base44's platform REST API. Without those prerequisites, the assignment remains queued without spending credits. The upstream request acceptance does not prove code was changed; uncertain outcomes are not automatically retried.
6. **The executor is wired but disabled by default:** 'base44/shared/approvedBuilderBridge.ts' allowlists the current app and Base44 chat and deploy operations. 'base44/functions/manageApprovedBuilderExecution/entry.ts' handles builder readiness/start/status, review evidence, a separate release confirmation and post-release verification. The Base44 builder can edit the app's source when enabled. Release requires additional 'IFUND_BUILDER_RELEASE_ENABLED=true' and documented revision/test evidence. This workflow does not automatically machine-verify the submitted source revision or tests, so a human super-admin still must inspect the changed code and validation results. The deploy endpoint publishes current app state; other pending changes must be included in the review.
7. Do not mark incidents fixed or tell members a fix shipped without verified code changes, regression results and a published release. Rejected plans must not be executed. The super-admin UI exposes statuses and controls under '/agents' -> Admin tools -> Platform errors and fix plans. A ChatGPT-native custom MCP plugin can preserve the admin's existing ChatGPT plugins in ChatGPT, but such a plugin is NOT installed by the Base44 bridge and requires separately configured OAuth and explicit user connection.

## Primary source
- base44/entities/PlatformIncident.jsonc
- base44/functions/managePlatformIncidents/entry.ts
- src/lib/platformErrorReporter.js
- src/components/agents/PlatformFixReviewPanel.jsx
- src/components/agents/AdminDevelopmentChat.jsx
- base44/agents/admin_builder_agent.jsonc
- base44/shared/approvedBuilderBridge.ts
- base44/functions/manageApprovedBuilderExecution/entry.ts
- src/components/agents/BuilderExecutionControls.jsx
- scripts/verify-platform-wide-repairs.mjs

## Smoke checks
npm run build; node scripts/verify-platform-wide-repairs.mjs; node scripts/verify-node22-release-contract.mjs; node scripts/test-node22-release-contract.mjs

**Required backend-only configuration (never stored in frontend or repository):** IFUND_BASE44_PLATFORM_TOKEN (an authorized REST-capable Base44 platform token, not a ChatGPT MCP-only token); IFUND_BASE44_WORKSPACE_ID (the exact workspace that owns IFund); IFUND_BUILDER_CREDITS_ENABLED=true only after separate authorized credit approval; IFUND_BUILDER_RELEASE_ENABLED=true only after release authorization. Keep the latter two disabled by default. Do not copy ChatGPT plugin credentials into IFund.

All source tests remain distinct from live permission testing on published IFund. Verify anonymous/public reporting, non-admin rejection, super-admin approval, no duplicate builder assignment, and the exact deployment before treating the flow as production-ready.
