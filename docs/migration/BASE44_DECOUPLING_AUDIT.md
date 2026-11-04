# Base44 decoupling audit and replacement register

**Audit target:** `interplanetarysister/interplanetary-fund2` `main`  
**Observed source commit:** `fb2afc64d72194c51c552bc7b5260a479d7566eb`  
**Read-only rule:** The source repository is evidence only. All implementation changes belong in `interplanetarysister/InterplanetaryFund`.  
**Purpose:** Remove Base44 as a runtime, build, configuration, identity, persistence, and deployment requirement while preserving IFund behavior through replaceable provider-neutral contracts.

## 1. Scope and evidence

The recursive Git tree for the source commit reported **1,249 files**, **346 directories**, and `truncated: false`. This is the complete Git tree inventory, including binary assets and generated files. It is not a claim that every file's bytes and every line have already been semantically reviewed.

The existing source-side static inventory records:
- 95 entity definitions;
- 184 backend function entrypoints;
- 11 connector definitions;
- 10 agent definitions;
- 17 workflow definitions;
- 1 MCP definition;
- 364 frontend JavaScript/TypeScript/JSX/TSX files scanned for direct Base44 API calls.

The existing inventory is useful but explicitly incomplete for indirect aliases, computed calls, runtime behavior, detailed authorization, provider side effects, and full parity. This audit extends it; it does not relabel static scans as runtime proof.

### Initial top-level file order / repository structure findings

The tree begins with agent instructions and skills, CI configuration, environment/build configuration, GitHub workflows, repository policy files, then `base44/`, `docs/`, `host/`, `scripts/`, `src/`, `supabase/`, and deployment configuration. The largest portability risks are not only in frontend call sites: they also exist in agent skills, duplicated workforce source, Base44 function runtimes, secret access, provider callbacks, workflow definitions, generated configuration, and deployment proxies.

## 2. Verified high-impact source findings

| Source path / symbol | Current coupling observed | Required replacement |
|---|---|---|
| `src/api/base44Client.js` | Imports `@base44/sdk`, constructs the Base44 client, chooses Base44 app ID and app URL, and applies a Base44-host-specific branch. | Provider-neutral API client facade backed by the IFund API contract; implementation calls Supabase Auth/Postgres and Cloudflare Worker/Edge Function routes. |
| `src/lib/runtimeContract.js` | Exposes `dataPlane: "base44"`, `VITE_BASE44_APP_ID`, and `VITE_BASE44_APP_BASE_URL`; startup assertion requires both Base44 values. | Neutral runtime contract. Use `VITE_API_BASE_URL` for the API origin when cross-origin routing is required; use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the Supabase client. Do not require a vendor app ID. |
| `src/lib/app-params.js` | Hard-codes the Base44 Android URL and app ID; persists `base44_*` query/storage keys; accepts Base44 access-token and function-version parameters. | Supabase Auth callback/deep-link handling and neutral `ifund_*` keys. Remove legacy token ingestion after migration parity is verified; never treat URL-provided identity as authorization. |
| `vite.config.js` | Imports and registers `@base44/vite-plugin`; retains a Base44 legacy SDK import switch and Base44-specific build comments. | Vite React plugin only plus IFund-owned build checks. Remove Base44 plugin package and all plugin-only configuration after proving no required feature depends on it. |
| `.env.example` | Requires `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`. | Publishable-only neutral values; `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Server secrets remain server-side. |
| `package.json` | Package identity is `base44-app`; runtime dependencies include `@base44/sdk` and `@base44/vite-plugin`. | IFund package identity and no Base44 SDK/plugin dependency. Keep the lockfile synchronized and prove a clean install/build. |
| `base44/config.jsonc` | Base44 CLI install/build/dev configuration. | No replacement runtime config is needed; Cloudflare Pages owns the Vite build. Keep only as read-only source evidence. |
| `base44/functions/**` | 184 Base44-hosted function entrypoints depend on `createClientFromRequest`, Base44 auth, service-role entity access, and Base44 runtime imports. | Port each function to a Supabase Edge Function or Cloudflare Worker route with explicit request/response schemas, verified JWT identity, role checks, service-only operations, idempotency, audit, and rate limits. |
| `base44/entities/**` | 95 JSONC entity contracts and Base44 row-access declarations. | Typed Postgres schema, constraints, indexes, foreign keys, and explicit RLS. Financial/credential writes remain server-only. |
| `base44/agents/**`, `base44/workflows/**`, `base44/mcp/**` | Agent definitions, tools, and workflow schedules/triggers are packaged in Base44-specific directories. | IFund-owned agent/tool contracts plus durable Supabase workflow queue and Cloudflare Worker/Edge Function execution. Preserve consent, budgets, audit, retry, and idempotency. |
| `.agents/skills/wix-base44-connector/**` and mirrored `host/workforce/source/.agents/skills/wix-base44-connector/**` | Operational instructions and utilities assume a Wix/Base44 connector workflow. | Replace with provider-neutral integration operations documentation, or retire if Wix/Base44-specific capability is not part of IFund's product. Keep unrelated Wix marketing-site requirements separate. |
| `src/components/admin/Base44ReleaseStatus.jsx` | User-facing admin status component describes Base44 publication/release. | Replace with IFund deployment/release status based on Cloudflare deployment evidence, not a renamed Base44 status. |
| `docs/deferred-base44-workflows.md`, `scripts/verify-base44-sync-contract.mjs` | Preserve and verify Base44-native source synchronization. | Retire from active build/release requirements; retain only a clearly marked historical migration record if useful. |

Additional source evidence includes:
- `base44/shared/approvedBuilderBridge.ts` calls `https://app.base44.com`, uses `IFUND_BASE44_*` credentials, and can submit/publish builder work. This is a separate, privileged builder integration—not the general application API. It must be disabled/retired for production runtime and must never be silently redirected to another provider.
- `base44/shared/verificationEmailCrypto.ts` imports `base44:runtime` secrets.
- `base44/shared/connectionCrypto.ts` describes secret provisioning in Base44 backend secrets.
- `base44/shared/serverImagePolicy.ts` explicitly allowlists Base44 media hosts and paths.
- `base44/shared/paypalSubscriptions.ts` includes the old Base44 app origin in callback/return URL handling.
- `base44/functions/wixWebhook/entry.ts` and `base44/functions/syncGitHub/entry.ts` instantiate the Base44 SDK in server functions.
- The original README tells developers to install the Base44 CLI, run `base44 dev`, and publish through the Base44 dashboard. It is historical documentation, not a valid setup guide for the replacement app.

## 3. Stable replacement naming and configuration

Use provider-neutral names for IFund-owned interfaces. Provider identity belongs inside an adapter implementation, not in every caller or environment variable.

| Old name / coupling | Stable replacement | Notes |
|---|---|---|
| `VITE_BASE44_APP_BASE_URL` | `VITE_API_BASE_URL` | Optional API origin; prefer same-origin `/api` routing where possible. |
| `VITE_BASE44_APP_ID` | No equivalent required | Supabase JWT identifies the authenticated user; product identity is a constant, not a vendor app ID. |
| `VITE_BASE44_FUNCTIONS_VERSION` | Versioned IFund API contract/routes | API version is owned by IFund, not the hosting vendor. |
| `base44Client` | `ifundApi` / `apiClient` | Stable facade with typed operations; no provider SDK objects leak into pages. |
| `base44.auth` | Supabase Auth adapter | Session, recovery, OAuth callback, and role resolution are explicit. |
| `base44.entities.*` | Repository/data-access modules | Typed queries against Postgres with RLS; privileged writes through server functions only. |
| `base44.functions.invoke` | IFund API route / Edge Function client | Stable endpoint contract; server validates JWT and authorization. |
| `base44.integrations.Core.*` | Server-side AI/media/email provider adapters | Model/provider keys are server secrets and replaceable independently. |
| `base44.asServiceRole` | Server-only Supabase service client | Never available in browser bundles; least-privilege operations only. |
| `base44:runtime` | Cloudflare Worker secrets / Supabase Edge Function secrets | Secret names and consumers documented; values never committed. |
| Base44 media URLs | Supabase Storage object keys/URLs | Preserve privacy, signed access, watermark behavior, and byte/hash verification. |
| Base44 scheduled workflows | `ifund_ops` durable queue + scheduled Worker | Preserve leases, retries, deduplication, and execution logs. |

## 4. What must not be blindly renamed

- PayPal, Stripe, Google, Facebook, Wix, Browserbase, and other external providers remain named where the platform genuinely integrates with those services. The goal is to remove Base44 as the hidden host/runtime—not erase legitimate third-party integration names.
- Existing user-visible product terminology, data fields, and historical audit records must not be mass-renamed without schema compatibility and data migration.
- The term `base` in wallet/blockchain code is unrelated to Base44 and must not be changed.
- A Base44 source snapshot, URL, webhook, or secret name may remain in a migration-only manifest to preserve provenance. It must not be imported as an active runtime dependency.

## 5. Replacement verification gates

A rename is complete only when the new name is consumed by working code and all old references are either removed from active paths or explicitly classified as historical.

1. **Build/config:** no Base44 SDK, Vite plugin, CLI, runtime imports, Base44 environment variables, or Base44-required startup assertions in the replacement app.
2. **Frontend API:** every original frontend operation maps to a typed IFund API/data contract; no page depends on a Base44 SDK object.
3. **Auth:** sign-in, email-code recovery, OAuth callback, session refresh, account linking, role resolution, logout, and revoked-session behavior pass against Supabase Auth.
4. **Data:** all 95 entities have reviewed schema mappings, ownership rules, indexes, constraints, and RLS tests; no browser service-role access.
5. **Functions:** all 184 entrypoints are mapped to a port, retirement decision, or explicit blocker; request/response semantics and side effects are tested.
6. **Agents/workflows/connectors:** every agent, tool, connector and workflow has a replacement or retirement record, including secrets, consent, budget, retries, and audit behavior.
7. **Media:** every Base44 media URL and upload path has a verified storage migration/read path; hashes and access policy match.
8. **Payments:** PayPal/Stripe callbacks, ledger authority, idempotency, settlement, withdrawal and fee behavior are independently verified before activation.
9. **Operations:** Cloudflare Pages/Workers build and deploy without Base44; DNS/mail preservation and rollback are tested separately.
10. **Residual scan:** scan all tracked text files (including docs, scripts, CI, mobile configuration and duplicated workforce source) for Base44 identifiers, URLs, package names, environment names, and wording. Every hit must be classified.

## 6. Work log

### Audit pass 1 — repository and root/runtime boundary

**Inspected:** recursive source Git tree; `README.md`; `AGENTS.md`; zero-credit and source-of-truth guidance; feature reconciliation baseline; source `.env.example`; source `package.json`; `src/api/base44Client.js`; `src/lib/runtimeContract.js`; `src/lib/app-params.js`; `vite.config.js`; `base44/config.jsonc`; `src/components/admin/Base44ReleaseStatus.jsx`; `docs/deferred-base44-workflows.md`; `scripts/verify-base44-sync-contract.mjs`; selected backend functions and shared modules.

**Verified outcome:** the source has a Base44-specific frontend SDK/client, app identity and URL environment contract, Base44 Android fallback, Base44 Vite plugin, Base44 package dependencies, Base44 CLI instructions, 95 entity definitions, 184 function entrypoints, and Base44-hosted agent/workflow configuration. The independent migration branch already has a Supabase client and no Base44 packages in its root `package.json`; this is only a scaffold/preview subset and not full behavior parity.

**Changes made in this pass:** this audit register only. No source repository files, production data, DNS, provider settings, credentials, or deployments were changed.

**Still to inspect:** every tracked text file and every source function/entity/agent/workflow/connector in line-level batches; all direct and indirect frontend callsites; exact per-function caller/auth/side-effect mapping; duplicated source under `host/workforce/source`; all docs, scripts, CI, Android configuration, and static assets with embedded provider URLs/text. Continue from the first unreviewed path in the source tree and append exact file/line findings to this register.

**Status:** IN PROGRESS. No claim of complete Base44 removal or full parity.


### Audit pass 2 — first provider-neutral API boundary implemented

**Implemented in the independent migration branch:**
- Added `src/lib/api.js`, a provider-neutral HTTP client that accepts only IFund `/api/` routes, defaults to same-origin routing, and optionally uses `VITE_API_BASE_URL` as the replaceable API origin.
- The client obtains the current Supabase Auth access token through the existing Supabase client, sends it as a bearer token, supports JSON and FormData requests, and returns structured `ApiError` values with HTTP status and server error code.
- Added `VITE_API_BASE_URL` to `.env.example`; it is optional and blank by default so Cloudflare same-origin routes need no host-specific URL setting.
- Added `tests/api-client.test.js` covering same-origin routing, replaceable HTTPS origin/path prefix, malformed/insecure URL rejection, Supabase bearer propagation, JSON serialization, and structured HTTP errors.

**Old -> new, verified in source mapping:**
- `VITE_BASE44_APP_BASE_URL` -> optional `VITE_API_BASE_URL` (the generic name now exists in the replacement app).
- Direct vendor SDK invocation boundary -> `api.request('/api/...')` (new shared transport). Existing page migration is still required; this helper does not magically port the 364 source frontend files.
- Base44 auth token -> Supabase Auth session JWT (the client reads it from the existing Supabase client; no URL token is accepted).

**Verification status:** test cases are committed but not yet executed in this environment. CI must run `npm test` on the PR head before this contract is marked verified. No runtime route was enabled, no production data was changed, and no Base44 source code was edited.


### Source traversal — first `.agents/skills` batch

Reviewed complete contents of the first five text files in Git-tree path order:

| Source file | Lines | Exact Base44-specific lines / findings | Replacement / disposition |
|---|---:|---|---|
| `.agents/skills/chief_of_staff.md` | 137 | L105 requires `base44.auth.me()`; L121 anchors fee rules to `base44/shared/fees.js`. | Change auth check to the IFund Supabase Auth adapter and fee source to the canonical IFund-owned fee module. Preserve the user/admin boundary and exact financial invariants. |
| `.agents/skills/communications_agent.md` | 157 | No literal Base44 references in the complete file. | No provider-name edit required in this file; its explicit approval, anti-spam and user-scope rules still require backend parity tests. |
| `.agents/skills/finance_agent.md` | 132 | L52 points to `base44/shared/fees.js`. | Replace with an IFund-owned fee contract/module; preserve historical fee attribution and do not change amounts or accounting rules during provider migration. |
| `.agents/skills/growth_agent.md` | 136 | No literal Base44 references in the complete file. | No provider-name edit required in this file; its PlatformConnection and consent semantics remain in the migration mapping. |
| `.agents/skills/ifund-admin-builder/SKILL.md` | 23 | L3, L9, L16 and L19 explicitly depend on the Base44 builder, Base44-authenticated identity, and `base44/shared/approvedBuilderBridge.ts`. | Retire the Base44 builder execution capability. Preserve only IFund-owned issue triage, reviewed task queue, authorization, audit, tests, preview and release controls; do not redirect builder credentials or pretend a new provider is equivalent. |

**Classification:** 3 files contain direct Base44 runtime/builder/fee references; 2 files contain none. This batch shows why a global text replacement is unsafe: authentication, canonical financial logic and privileged builder execution require different replacements, while files with no provider coupling should remain unchanged.

**Next source path:** `.agents/skills/ifund-chief-of-staff/SKILL.md`, then continue lexicographically through the remaining `.agents/skills/**` tree, including mirrored workforce-source copies. Record file, exact line, current behavior, replacement and verification per batch.

### CI correction log

The first two CI attempts failed before build because the new API client exposed an existing source issue in the test runner: Node ESM does not resolve the extensionless `./supabase` import, and the existing Supabase module dereferenced `import.meta.env` when running under plain Node. The client import was changed to `./supabase.js`, and Supabase environment reads now use optional chaining. The third run is underway; do not mark tests as passing until it completes.


### Source traversal — next `.agents/skills` batch

| Source file | Lines | Base44-specific findings | Replacement / disposition |
|---|---:|---|---|
| `.agents/skills/ifund-chief-of-staff/SKILL.md` | 20 | L9, L13 and L19 describe Base44 runtime registration, agent JSONC under `base44/agents`, and preserving Base44 formats. | Rewrite as IFund-owned agent configuration and runtime contract; source JSONC remains migration evidence only. |
| `.agents/skills/ifund-communications/SKILL.md` | 20 | L9, L13 and L19 repeat the Base44 agent registration/source path/preservation assumptions. | Port tool definitions and approval behavior to the IFund agent registry and backend contracts. |
| `.agents/skills/ifund-content-writes/SKILL.md` | 39 | L31 states live Base44 agent tool registration determines tool availability. | Replace with the independent IFund agent registry and server-enforced permissions; preserve owner approval and external publishing consent. |
| `.agents/skills/ifund-finance/SKILL.md` | 20 | L9, L13 and L19 point to Base44 agent definitions and `base44/shared/fees.js`. | IFund agent registry + IFund-owned fee module; no changes to fee arithmetic without separate financial review. |
| `.agents/skills/ifund-growth/SKILL.md` | 20 | L9, L13 and L19 point to Base44 agent definitions and preserve Base44 format. | IFund agent registry and explicit provider capability/consent checks. |
| `.agents/skills/ifund-outreach/SKILL.md` | 20 | L9, L13 and L19 repeat Base44 runtime/definition/preservation references. | IFund agent registry and verified Worker/Edge Function operations. |
| `.agents/skills/ifund-story/SKILL.md` | 20 | L9, L13 and L19 repeat Base44 runtime/definition/preservation references. | IFund agent registry and provider-neutral story-generation contract. |
| `.agents/skills/ifund-strategy/SKILL.md` | 20 | L9, L13 and L19 repeat Base44 runtime/definition/preservation references. | IFund agent registry and provider-neutral campaign strategy data contracts. |
| `.agents/skills/outreach_agent.md` | 158 | No literal Base44 references in the complete file. | No provider-name edit required; verify tool permissions and agent behavior independently. |
| `.agents/skills/story_agent.md` | 158 | No literal Base44 references in the complete file. | No provider-name edit required; verify generation provider and content-safety contract separately. |
| `.agents/skills/strategy_agent.md` | 134 | No literal Base44 references in the complete file. | No provider-name edit required; verify tool/data mappings separately. |
| `.agents/skills/wix-base44-connector/SKILL.md` | 443 | Base44 app context, Base44 server function path, Base44 service-role Wix token retrieval, Base44 preview/published domains and Wix/Base44 app handoff (e.g. L13, L88, L138, L298, L314, L372–392). | Retain legitimate Wix API knowledge only if the Wix marketing site still needs it; remove Base44 app assumptions and route Wix credentials through an independent server-side integration. This skill is not an IFund runtime dependency. |
| `.agents/skills/wix-base44-connector/utils.cjs` | 464 | The helper is explicitly a Base44 sandbox/Wix docs tool; it uses a Base44-specific scratch path and instructions (L1–8, L21, L295). | Replace with a generic Wix documentation helper if still needed, or archive it as source-only tooling. Never copy its scratch files or credentials into the app runtime. |

**Batch result:** 13 files reviewed in this batch (11 agent guides plus the two Wix connector files); together with the first five, 18 distinct skill files have been reviewed. Four additional reference-guide files are exact duplicates of earlier files, so 22 physical files have been inspected. 8 current IFund skill guides contain explicit Base44 runtime/agent format dependencies; 3 legacy agent references do not contain Base44 naming; the Wix connector is a separate 907-line Base44-contextual tool that needs its own disposition. The 39-line content-writes guide has a direct Base44 registration dependency despite having only one literal mention.

**Important distinction:** Wix is a real external site/platform and must not be erased from the platform integration map. Only the Base44-hosted Wix connector path and assumptions are removed; any separate Wix marketing site or authorized Wix APIs remain independently configurable.


### Source traversal — duplicated agent-guide references

The four reference guides under the IFund skill directories were fetched in full and compared by Git blob SHA to the first legacy skill files:

| Reference file | Lines | SHA equality | Disposition |
|---|---:|---|---|
| `.agents/skills/ifund-chief-of-staff/references/agent-guide.md` | 137 | Exact duplicate of `.agents/skills/chief_of_staff.md` | One semantic source record; update both copies or replace the reference with a canonical IFund-owned guide. |
| `.agents/skills/ifund-communications/references/agent-guide.md` | 157 | Exact duplicate of `.agents/skills/communications_agent.md` | No extra Base44 coupling; keep both synchronized or de-duplicate. |
| `.agents/skills/ifund-finance/references/agent-guide.md` | 132 | Exact duplicate of `.agents/skills/finance_agent.md` | Update both copies when replacing the Base44 fee-module reference. |
| `.agents/skills/ifund-growth/references/agent-guide.md` | 136 | Exact duplicate of `.agents/skills/growth_agent.md` | No extra Base44 coupling; keep both synchronized or de-duplicate. |

This is a verified duplicate group, not four independent behavior definitions. The Base44-specific references in the chief-of-staff and finance guides are therefore duplicated in the two reference copies. Do not count duplicate copies as new capabilities or silently change only one copy.


### Source traversal — `.github` instructions and workflows

| Source file | Lines | Findings | Replacement / disposition |
|---|---:|---|---|
| `.github/FUNDING.yml` | 16 | No Base44 references; template sponsorship placeholders only. | No decoupling edit required. |
| `.github/copilot-instructions.md` | 19 | L7 blocks Base44 builder/agent/workflow/API/deploy operations under the zero-credit policy; L10 calls the source repository the authoritative Base44-hosted implementation target. | Rewrite the target-side policy to identify `InterplanetaryFund` + Supabase/Cloudflare as the independent target and `interplanetary-fund2` as read-only evidence. No Base44 operations should be required. |
| `.github/skills/code-review/SKILL.md` | 246 | No literal Base44 references; generic security, data integrity, payments and verification review policy. | Keep as generic review guidance. |
| `.github/workflows/android-debug-apk.yml` | 172 | No literal Base44 references. | Review native build/runtime URL settings in the Android app config separately; this workflow alone is not provider-coupled. |
| `.github/workflows/connect-dialog-safe-errors.yml` | 36 | L12–20 trigger on changes under `base44/functions/**` and `base44/entities/**`. | Replace triggers with IFund Worker/Edge Function and schema paths in the target CI; source-only workflow should not remain a required check. |
| `.github/workflows/deploy-cloudflare.yml` | 101 | L32–37 inject and require `VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL`; L77 and L85 require an MCP proxy header identifying Base44. | Build using neutral `VITE_API_BASE_URL` (or same-origin default) and Supabase publishable configuration; verify the independent API health/route contract, not a Base44 MCP proxy. |
| `.github/workflows/quality-gates.yml` | 236 | L24/L203/L217 special-case `base44-builder[bot]`; L25 names a Base44 release build; L62–63 runs the Base44 sync contract script. | Replace with independent PR/preview/release checks; remove the builder actor condition and source-sync gate; test IFund-owned route/schema contracts instead. |
| `.github/workflows/service-health-safe-errors.yml` | 22 | No literal Base44 references. | Keep generic service health workflow; confirm its target endpoints are the independent API. |
| `.github/workflows/terms-liability.yml` | 27 | No literal Base44 references. | Keep generic legal/terms workflow; verify deployment target separately. |

**CI result for the new adapter:** GitHub Actions run [41751234251](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41751234251) on the PR head with the temporary diagnostic step removed completed successfully: real `npm ci`, lockfile reproducibility, **82/82 tests**, Vite production build, and Prettier check all passed. The temporary formatter diagnostic step was removed from the workflow before this final successful run. No production deploy was triggered.


### Source traversal — root-level files, first deterministic pass

Source order is the GitHub root directory's alphabetical path order. This pass fetched complete contents of 21 root-level text files and inspected every line. The source repository remains read-only.

| Source file | Lines | Finding | Replacement / disposition |
|---|---:|---|---|
| `.env.example` | 8 | L2–3 require `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`. | Replace with optional `VITE_API_BASE_URL`; app identity is not a browser runtime requirement. Keep privileged credentials server-only. The neutral variable is already present in the migration branch. |
| `.gitignore` | 35 | L32 ignores generated `base44/.app.jsonc`. | Remove the generated vendor config from the independent app. Keep source-only ignore rules only if the archived source tree still needs them; never copy generated vendor config to the replacement. |
| `.node-version` | 2 | No Base44 reference; Node 22 pin. | Keep runtime policy independent of hosting vendor. |
| `.npmrc` | 8 | No Base44 reference; 7-day package release cooldown and strict engine checks. | Keep. |
| `.nvmrc` | 2 | No Base44 reference; Node 22 pin. | Keep runtime policy independent of hosting vendor. |
| `AGENTS.md` | 181 | L5–10 identify Base44 as authoritative application/backend owner; L32 forbids metered Base44 operations; L52 and L57–106 prescribe a Base44-preservation freeze; L114–135 call Base44 the application boundary and list Base44 SDK/Vite plugin/runtime assumptions; L171–180 preserve the Base44-published APK. These are mutually coherent for the *historical source*, but conflict with the requested independent target if copied unchanged. | In the independent repository, rewrite authority to Supabase (identity/data) + Cloudflare (Worker/API/hosting) and retain the no-paid-operations, preserve-financial-integrity, explicit-release and Android signing safeguards. Source AGENTS.md stays historical evidence and must not govern the new repo. |
| `BUILD_AGENT_RULES.md` | 94 | L3, L7, L14, L16, L28, L32, L42–44, L77 and L93 bind implementation/build/validation to Base44. | Replace the builder-specific language with IFund-owned build/test/release contracts. Keep the provider-neutral connection-consent, publishing authorization, no-guessing and financial invariants. |
| `CLAUDE.md` | 4 | No Base44 reference; delegates to AGENTS.md. | Keep as a generic instruction pointer only after the independent AGENTS.md is rewritten. |
| `LICENSE` | 706 | No Base44 references. | Keep license and attribution unchanged; no provider substitution applies. |
| `README.md` | 95 | L1–9 correctly labels this as legacy source, but L13–89 then instructs users to install/run Base44 CLI, publish through Base44, and configure Base44 environment values. | Preserve the historical README in the source repository. The independent repo needs its own README describing Vite, Supabase, Cloudflare and neutral `VITE_API_BASE_URL`; never direct replacement-app operators to Base44 CLI or dashboard. |
| `capacitor.config.json` | 14 | No Base44 text. App ID `com.base6a67a778342a8fe05ee79cba.app` contains a legacy project identifier, not an active SDK dependency. | Preserve the installed Android application ID for upgrade/signature continuity unless a separately authorized package migration is planned. Do not rename this identifier merely to remove a substring. |
| `components.json` | 21 | No Base44 reference; generic shadcn/ui aliases. | Keep. |
| `eslint.config.js` | 63 | No Base44 reference. | Keep; existing exclusions are build-output hygiene, not hosting dependencies. |
| `index.html` | 23 | No Base44 reference; public canonical URL and IFund metadata. | Keep. |
| `jsconfig.json` | 21 | No Base44 reference; path aliases and compiler scope. | Keep, then reconcile exclusions with the actual replacement source tree. |
| `package.json` | 215 | L2 names the app `base44-app`; L67/L89 expose Base44 sync/release scripts; L111–112 install `@base44/sdk` and `@base44/vite-plugin`; other scripts assert Base44 auth/runtime/release assumptions. | New package name: `interplanetary-fund` (or canonical npm-safe `interplanetary-fund`); replace vendor sync/release scripts with IFund API/schema/edge-function/Worker contract tests. Remove Base44 packages only after all imports/callsites are ported and tests prove parity. |
| `postcss.config.js` | 7 | No Base44 reference. | Keep. |
| `requirements.txt` | 6 | No Base44 reference. | Keep only dependencies actually used by retained build/test tools; audit separately. |
| `tailwind.config.js` | 96 | No Base44 reference. | Keep; formatting/cleanup is unrelated to provider decoupling. |
| `vite.config.js` | 105 | L1 imports Base44 Vite plugin; L5 ties production build to Base44; L40–49 registers the plugin and legacy SDK import rewriting; HMR/navigation/analytics/visual-edit notifiers are enabled. | Replace with standard Vite + React plugins and IFund-owned dev tooling. Remove SDK import rewriting, vendor notifiers and visual-edit hooks. The neutral API client already makes backend origin replaceable; the Vite config must stop injecting a provider runtime. |
| `wrangler.toml` | 115 | L87 requires `IFUND_BASE44_ORIGIN`; L90 includes the Base44 app domain in allowed browser origins. The Worker uses that origin for MCP proxying. | Replace the variable with an explicit optional `IFUND_LEGACY_API_ORIGIN` only during a temporary data/API bridge, or remove the bridge once Supabase/IFund routes are authoritative. Do not keep Base44 in the allowed-origin list after the legacy domain is no longer a legitimate frontend. Current code also labels the MCP proxy as Base44 and forwards requests to that origin; this is a real backend dependency, not a cosmetic name. |

### Root-level dependency consumers verified by repository code search

- `IFUND_BASE44_ORIGIN` is consumed by `host/gateway/worker.js`, documented in `host/gateway/README.md`, asserted by `scripts/verify-cloudflare-runtime-contract.mjs`, and exercised by `scripts/test-cloudflare-mcp-proxy.mjs`. Rename alone is unsafe: the Worker still forwards MCP requests to the old backend and returns a Base44-specific proxy marker.
- `VITE_BASE44_APP_BASE_URL` is read by `src/lib/app-params.js` and `src/lib/runtimeContract.js`; required by `scripts/publish-ifund-cloudflare.sh`; asserted by `scripts/verify-host-portability-contract.mjs` and `scripts/verify-cloudflare-runtime-contract.mjs`; and injected by `.github/workflows/deploy-cloudflare.yml`. All these consumers must move together to `VITE_API_BASE_URL` or same-origin `/api`.
- `@base44/sdk` is imported by `src/api/base44Client.js` and multiple `base44/functions/**/entry.ts` modules. Removing the npm dependency without migrating both browser and server entrypoints will break the app.
- `@base44/vite-plugin` is imported in `vite.config.js`; the plugin also injects compatibility imports and dev/visual-edit behavior. A plain package rename cannot replace those capabilities.
- The repository package scripts contain Base44 sync/release checks and the workflow files invoke them. CI contracts must be updated in the same migration increment or they will keep enforcing the old platform.

**Root pass status:** 21/21 root text files inspected (1,821 lines; exact per-file counts above). No files in `interplanetary-fund2/main` were modified. The replacement API origin is implemented in the independent repository; package, Vite, Worker, MCP and application SDK decoupling remain open work. The source README is intentionally legacy documentation, not the operator guide for the independent product.

**Critical design rule:** use neutral names only where the underlying behavior is genuinely provider-neutral. A temporary legacy bridge may be named `IFUND_LEGACY_API_ORIGIN`, but must have a retirement condition. Never disguise a still-required Base44 backend as `IFUND_API_URL` and call the platform independent; actual data, auth, permissions, webhooks, agents and workflows must be moved to IFund-owned Supabase/Cloudflare implementations before Base44 can be removed.


### Completion of first source instruction directories: `.agents`, `.ci`, `.github`

The recursive Git tree confirms **26 files under `.agents/`**. All 26 have now been fetched and inspected in full. The remaining three mirrored reference guides are:
- `.agents/skills/ifund-outreach/references/agent-guide.md` — 158 lines, no Base44 references.
- `.agents/skills/ifund-story/references/agent-guide.md` — 158 lines, no Base44 references.
- `.agents/skills/ifund-strategy/references/agent-guide.md` — 134 lines, no Base44 references.

The Wix connector's `references/CAPABILITY_MAP.md` is 87 lines. Its only Base44 wording is in the third-party Wix skill's download/install instructions (L4–5); its capability map describes Wix products and remains useful as Wix-specific reference material. It should be retained only if the independent platform still uses Wix integrations, with the connector wrapper separated from Base44-specific setup.

`.ci/last-batch-check.txt` (4 lines) names Base44 auth/data-plane initialization as part of a prior source audit scope. This is historical checkpoint wording, not executable runtime configuration. It should not be copied into new CI as a requirement.

`.github/` contains 9 files, all previously inspected in full: FUNDING.yml, copilot-instructions.md, the code-review skill, and six workflows. The workflow replacement mapping is recorded in the prior `.github` audit section.

**Directory audit totals so far:** `.agents/` 26/26 files; `.ci/` 1/1; `.github/` 9/9. Together with 21/21 root-level text files, the first three path groups are inspected. No source files were modified.

### Required source directives read before continuing

The source repository's mandatory first-read documents were fetched and read:
- `docs/ZERO_CREDIT_CONTINUOUS_WORK.md` (48 lines): its zero-credit and resumable-work rules remain applicable to safe development process, but L34's claim that this repository is being prepared for Base44 hosting is historical and superseded for the independent target.
- `docs/REPOSITORY_SOURCE_OF_TRUTH.md` (80 lines): L9–10, L25 and L55–57 explicitly define Base44 as the current app runtime and the older Convex backend as historical evidence. This is a material source-era architecture statement; it cannot be treated as proof that Supabase already contains equivalent user identity, agent memory, outcomes, permissions or persistent state.
- `docs/IF_FEATURE_RECONCILIATION_2026-08-21.md` (147 lines): its repository ownership, agent bridge, social publishing, user schema and feature matrix are an older baseline. Its evidence remains valuable for behavior requirements, but its Base44/Convex runtime ownership statements must be reconciled against the current Supabase migration before feature parity is claimed.

### Independent destination branch sanity check

The current migration PR branch was checked separately:
- `package.json` is already named `interplanetaryfund`, depends on Supabase/React/Vite, and contains no Base44 package dependency or vendor-specific script.
- `src/lib/api.js` uses `VITE_API_BASE_URL` and Supabase Auth JWT; no Base44 string is present.
- `src/lib/supabase.js` initializes Supabase Auth from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `worker/index.js` exposes independent IFund API routes; it has no Base44 proxy. Its only Base44 occurrence is a truthful comment explicitly stating that no proxy/payment functionality exists.
- `wrangler.jsonc` names the independent API Worker and has no Base44 variable.
- The route matrix explicitly marks unmigrated payment, ledger, OAuth, media and historical MCP routes as fail-closed 404, and warns that the deployed legacy Worker is separate. That is correct: a green scaffold is not feature parity.

**Result:** the replacement branch's root app identity/configuration are already provider-neutral. Remaining Base44 text in the migration repo is largely source provenance/audit context and must be retained where it explains what is being migrated; it must not be allowed to become a runtime dependency or release prerequisite.


### Source traversal — `android/` directory

The recursive tree contains **55 Android files**: 28 text/config/code files, 26 PNG assets, and the Gradle wrapper JAR. All 28 text/config/code files were fetched and inspected; all binary assets were inventoried by path, size and Git blob SHA (their pixel/binary contents are not line-oriented code and were not decoded in this pass).

| File group | Findings | Replacement / disposition |
|---|---|---|
| `android/app/build.gradle` | L10 comment says Base44 uses the default version code; the build itself uses the stable package namespace/application ID `com.base6a67a778342a8fe05ee79cba.app`. | Remove the vendor-specific comment in the independent Android build pipeline. Keep the existing application ID, namespace, signing identity and URL scheme for installed-app upgrade compatibility unless a separately planned package migration is authorized. |
| `android/app/src/main/res/values/strings.xml` | `package_name` and `custom_url_scheme` retain the same generated package identifier. | Preserve for Android deep-link and upgrade compatibility; this identifier is not itself a live Base44 SDK dependency. |
| `android/app/google-services.json` | Firebase project is `interplanetary-fund`; Android package name matches the stable app ID; no Base44 references. | Keep the existing Firebase app identity if Firebase diagnostics/push are still used. Firebase is a separate integration and must not be removed as part of Base44 decoupling. |
| `android/app/src/main/java/**/MainActivity.java` and `IfundDiagnosticsPlugin.java` | Capacitor bridge registration and opt-in Crashlytics diagnostics; no Base44 calls. | Keep; later verify native plugin registration and consent behavior in the independent APK. |
| Gradle files, wrapper scripts, manifest, tests, ProGuard, Capacitor config and resource XML | No Base44 runtime references; generic Android/Capacitor build/runtime configuration. | Keep as native app infrastructure. Fix unrelated package/test namespace mismatch only in a dedicated Android QA change. |
| 26 PNG splash/icon assets | No line-oriented provider wording; files inventoried by SHA and size. | Preserve the brand assets; no Base44 naming replacement required. |
| Gradle wrapper JAR | Binary build tool artifact; not decoded. | Keep the pinned wrapper distribution and verify supply-chain provenance separately. |

**Android result:** 28/28 text/config/code files inspected, 26/26 PNG assets inventoried, and 1/1 binary wrapper JAR inventoried. Only one Base44-specific wording hit was found in the Android text files: `android/app/build.gradle:10`. The package identifier contains a legacy generated project string but must not be renamed casually because it is the Android app identity used for updates and deep links. The migration repository currently does not carry the Android project; Android parity remains a later, explicit migration workstream.


### Source traversal — `base44/config.jsonc`, agent registry and connector registry

| File group | Count | Lines | Findings | Replacement |
|---|---:|---:|---|---|
| `base44/config.jsonc` | 1 | 9 | Base44-specific local site install/build/serve/output configuration. | Standard npm/Vite scripts and Cloudflare Pages/Workers build config in the independent repository. |
| `base44/agents/*.jsonc` | 10 | 685 | Ten agent definitions: Admin Builder, Chief of Staff, Communications, Connection Discovery, Finance, Growth, Managed Connections, Outreach, Story and Strategy. Each defines model, instructions, memory behavior, tools/entities, and access scope in the Base44 agent registry. Four contain explicit Base44 wording in agent instructions (admin builder, chief of staff, managed connections and outreach); the other six are still implicitly coupled because their registration and tool wiring are defined by Base44 JSONC. | Create an IFund-owned agent registry and runtime contract. Keep stable agent IDs/roles, instructions, tool names, consent and authorization scopes, memory partitioning, audit history and delegation semantics. Route tools to authenticated Cloudflare Worker/Edge Function endpoints; keep admin builder as a separate super-admin-only code-workflow service, not a public agent capability. |
| `base44/connectors/*.jsonc` | 11 | 99 | OAuth provider registrations and requested scopes for Discord, Facebook Pages, GitHub, Google Workspace, Gumroad, Instagram, LinkedIn, OneDrive, Slack, Wix and WordPress.com. The files contain scope declarations, not the provider's live app registration, redirect URI, token, or verified API capability. | Replace with an IFund-owned provider registry and OAuth callback/credential vault. Re-register each app with each provider, use provider-specific least-privilege scopes, secure refresh-token storage, rotation/revocation and capability verification. Do not assume a connector JSONC copy creates a working OAuth integration. |

**Agent runtime details that must survive:** the ten definitions contain 75 configured entity/function tool entries in aggregate (counted from the JSONC tool declarations), with specialized agent permissions. They also encode owner/user data boundaries, OBO consent, human approval before publishing, no payment/spending authority, draft-only vs executor roles, cross-agent routing, memory scope/provenance and secret redaction. These are behavioral/security contracts, not cosmetic Base44 wording. The replacement must preserve them server-side, not merely copy the prose into a prompt.

**Connector replacement rule:** a provider name and scopes are not the provider integration. Each provider requires its own verified client registration, callback, exact scopes, consent, refresh/revocation path and action-specific test. Some providers may not support every requested operation or may require review/approval. Unsupported capabilities remain unavailable/manual rather than being represented as connected.

No source files were changed. The independent target branch's package is already vendor-neutral, but it does not yet contain the ten agent runtimes or these eleven working provider OAuth registrations.


### Source traversal — all 95 Base44 entity schemas

**Entity directory inspection is complete: 95/95 JSONC schemas fetched and parsed in full.** Each file was checked for every line containing Base44 wording, its entity name, required fields, property list, and declared access rules. The source files remain read-only.

#### Entity families and replacement treatment

| Domain family | Source entities | Independent destination |
|---|---|---|
| Identity, profile and consent | User, PublicProfile, Agent, AuthorizationGrant, LegalAcceptance, Friendship, FollowedCampaign, CommunityMember, UserCredentialVault, VerificationMailbox, VerificationMail, DeviceAuthorization | Supabase Auth is the identity authority; normalized profile/consent/grant tables with explicit RLS. Never recreate Base44's implicit `{{user.id}}` / `user_condition` evaluator in the browser. |
| Campaigns, content and community | Campaign, CampaignTranslation, CampaignUpdate, BlogEntry, UserBlog, DiscussionPost, DiscussionReply, Community, SocialPost, PostInterest, ActivityEvent, Message, Notification, InboxItem, PublicProfile | Supabase relational tables, views and storage references; preserve publish/draft visibility and ownership policies. |
| Donations, payout and ledger | Donation, FinancialOperation, HoldingLedgerEntry, Withdrawal, TreasurySnapshot, ConnectedPayoutAccount, PayPalBillingWebhook, PayPalSubscriptionIntent, SubscriptionPlanMapping, WebhookEvent, StripeReversalHold | Server-only financial RPCs/Edge Functions, immutable ledger entries, unique idempotency constraints, reconciliation and PayPal-only live money flow. Stripe entity is historical/reversal evidence, not authorization to activate Stripe. |
| External platforms and OAuth | PlatformConnection, PlatformConnectionRecipe, PlatformAccessRegistry, PlatformOwnedAccount, ExternalPlatformRecord, ExternalConversation, ExternalConversationMessage, DistributedPost, ScheduledAutoPostPermit, ExternalCampaignImport, ExternalCampaignImportOperation, ExternalCampaignPublication, ExternalCollectionAuthorization, ExternalFundObservation, ExternalFundMigrationRecord, ExternalSyncClaim, ExternalSyncEvent, IntegrationChangeRequest, FundraisingProviderCapability, PayPalBillingWebhook | IFund-owned OAuth broker and provider adapters, encrypted token vault, explicit consent, durable sync jobs/claims, provider capability registry and request-only external sync policy. |
| Agents and operations | AgentActivity, AgentContentDraft, AgentConversationRun, AgentDelegation, AdminActionMessage, AdminApproval, ExecutiveReport, MissionBrief, Recommendation, Opportunity, WritingResearchBrief, HelpArticle, HelpDraft, HelpFeedback, KnowledgeArticle, OfficialPublication, ProtocolReport, SustainabilityAudit, PlatformIncident, PlatformEvent, AuditLog, SyncRun, GitHubSyncCheckpoint | Supabase tables plus Cloudflare Queue/Workflow/Worker execution, auditable run state, approval gates, and owner/admin scoping. |
| Admin and secrets | AdminApiConnectionIntake, AdminCredentialReference, AdminCredentialVault, ExternalAgentApiKey, FeatureFlag, RateLimitBucket, SupportTicket, FoundingWaitlist, NonprofitSubscriptionApproval, PushDevice, PlatformAccessRegistry | Admin-only tables and secrets managed by Cloudflare secrets or a dedicated vault. Secret material must never be exposed via ordinary table reads or client-side service-role credentials. |
| Grants and volunteering | Institution, InstitutionOpportunity, GrantApplication, VolunteerOpportunity, VolunteerSignup, MonitoredCampaign | Supabase tables with public/private visibility and user/administrator policy enforcement. |

#### Exact Base44-specific entity wording found

The following source descriptions directly name Base44 and must be changed in destination-side schema comments/docs. Their data semantics remain; only the vendor attribution changes:

- `AdminCredentialReference.jsonc:4`: "Base44 entities" → "application database records"; secrets remain external in a server-side secret manager.
- `AgentConversationRun.jsonc:11,15`: "Base44 specialist / Base44 agent conversation reference" → "IFund agent / IFund agent run reference"; preserve conversation/run IDs and authorization scope.
- `ExternalConversationMessage.jsonc:23`: "not a Base44 record ID" → "not an IFund internal record ID"; provider-supplied IDs remain external identifiers.
- `GitHubSyncCheckpoint.jsonc:75`: "Base44–GitHub synchronization" → "IFund–GitHub synchronization".
- `InboxItem.jsonc:21`: "canonical Base44 financial/external-observation id" → "canonical IFund financial-operation/external-observation id".
- `MonitoredCampaign.jsonc:7`: "Interplanetary Fund Base44 campaign id" → "IFund campaign ID".
- `Notification.jsonc:35`: "canonical Base44 FinancialOperation id" → "canonical IFund financial-operation ID".
- `PlatformConnectionRecipe.jsonc:80`: "Base44 connector type" → "IFund provider adapter / OAuth connector type"; transport is provider capability, not a Base44 dependency.
- `ProtocolReport.jsonc:23`: "stored by Base44" → "stored by IFund".
- `TreasurySnapshot.jsonc:21`: "Base44 treasury ledger" → "IFund authoritative treasury ledger".
- `WebhookEvent.jsonc:11`: "Base44 FinancialOperation" → "IFund FinancialOperation".
- `Withdrawal.jsonc:39,66,70,74`: four references to Base44 donation records, idempotency key, payout reservation and ledger entry → corresponding IFund-owned records/keys/reservations/ledger entry.

Other provider references (Browserbase, Stripe, PayPal, GitHub, etc.) are distinct services and should not be blindly renamed. Browserbase is currently a separate credential/browser service and needs its own replacement decision; Stripe fields and `StripeReversalHold` are historical schema fields only and must not cause Stripe live payments to be enabled.

#### Critical parity finding — destination schema is not yet equivalent

The independent branch's initial Supabase migration currently creates only four tables: `ifund_profiles`, `ifund_campaigns`, `ifund_posts`, and `ifund_connections`. It does **not** yet implement the 95 source entities, their relationships, constraints, indexes, triggers, or the full row-level security rules. The initial schema also uses simplified campaign/post shapes and cannot be described as a full entity migration.

This is a substantive blocker to claiming Base44 independence for existing user data/features. The next implementation must produce a reviewed entity-to-table mapping and migration set, then test:
1. every source property/type/required/default/enum;
2. foreign keys, uniqueness, indexes and deletion semantics;
3. row-level access for owner, other user, anonymous visitor and admin;
4. service-only mutations for payments, credentials, approvals, webhooks and provider verification;
5. financial idempotency, immutable ledger/reconciliation and PayPal payout invariants;
6. data export/import counts and referential integrity before any production cutover.

**Entity audit result:** 95/95 schemas inspected; 12 entity files contain 17 explicit Base44 wording hits (including repeated mentions in AgentConversationRun and Withdrawal). The independent destination is intentionally not declared feature-parity complete. No production database was modified.
