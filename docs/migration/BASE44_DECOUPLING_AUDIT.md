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


### Source traversal — backend function entrypoints, batch 1 (20/184)

The recursive tree contains 188 files under `base44/functions/`: **184 `entry.ts` handlers and four shared/helper TypeScript files**. This batch fetched and inspected the complete source of the first 20 entrypoints in alphabetical path order. No source code was edited.

| Handler | Key behavior / Base44 dependency | Replacement target |
|---|---|---|
| `acknowledgeConnectionIssue` | Admin-only connection history update; SDK auth + service-role entity write. | Worker route + server-side admin role check + Supabase transaction. |
| `activateSubscriptionCheckout` | Checks PayPal plan catalog, verifies live webhook endpoint/event subscriptions, then enables feature flag. | Keep PayPal-only; implement server-side PayPal REST verification, webhook signature verification and atomic feature flag update. |
| `adminApiConnectionIntake` | Super-admin intake; deterministic URL/secret screening, optional LLM classification, draft storage, allowlisted host reachability check. | Cloudflare Worker + Supabase admin-only intake; secrets go only to Cloudflare secrets/vault; never save credentials in notes. |
| `adminCampaignControl` | Admin pause/restore campaign + audit event. | Worker + admin authorization + transactional update/audit record. |
| `adminOAuthProviderReadiness` | Inventories configured OAuth registration env vars; explicitly warns presence is not proof of working OAuth. | Worker reads server-side env and returns the same non-secret readiness inventory. |
| `adminUpdateUserRole` | Super-admin role management. | Supabase Auth app_metadata/role table via tightly scoped server-only function; immutable audit, no client role writes. |
| `analyzeGrantApplication` | AI analysis of application; updates grant status and writes recommendation/notification. | Worker + chosen LLM provider adapter + transactional Supabase records; retain human decision gate. |
| `applyAgentContentDraft` | Owner-confirmed application of a draft to one of several IFund content destinations; explicitly not agent-callable; handles partial failures and audit. | Worker with per-destination authorization and idempotency; owner confirmation remains mandatory. |
| `applyInstitutionOpportunity` | Feature-gated grant application; checks campaign ownership, dedupes applications and atomically increments application count. | Supabase RPC transaction with unique (opportunity, applicant) constraint and RLS. |
| `auditAdminAgentGateway` | Super-admin audit record for admin-agent gateway. | Server-only audit insert with super-admin authorization. |
| `authorizeCollectAndWithdraw` | Owner confirms external collection authorization; checks ownership/state/expiry; logs that no unsupported transfer is claimed complete. | Worker + one-use/expiring authorization record; no transfer until provider adapter supports it. |
| `authorizeConnectionAi` | Owner explicitly grants agent access to a previously connected platform, bounded by OBO consent, scope version and verified provider capabilities. | Worker enforces consent + scope on every action; preserve revocation and permission-version checks. |
| `broadcastPosts` | Campaign-owner publishing across platforms; checks subscription, consent, platform access and capability verification; falls back to manual when direct publish isn't proven. | Queue/Worker provider adapters with owner-bound OAuth, consent, capability evidence and per-post idempotency. Never infer publishing support from connector presence. |
| `cancelPayPalSubscription` | Authenticated owner cancellation through PayPal billing API and subscription reconciliation. | PayPal REST adapter + webhook reconciliation; retain user ownership check. |
| `capturePayPalOrder` | PayPal capture verification, canonical financial operation, holding ledger, donation/notification mirrors, receipts and analytics. | Critical payment Worker + atomic Supabase RPC; verify PayPal capture with PayPal, unique operation keys, exactly-once ledger effects, reconciliation. No client-supplied payment truth. |
| `checkUsernameAvailability` | Rate-limited username lookup through User entity. | Worker + Supabase unique constraint; avoid user enumeration and keep rate limit. |
| `communityMembership` | Join/leave community; validates membership/owner and atomically increments/decrements counts. | Supabase transaction/RPC with uniqueness and count consistency. |
| `completeOAuthConnection` | Compatibility endpoint; reads current app-user OAuth token from Base44 connector, syncs unified OBO consent, marks connection unverified pending live verification. | IFund OAuth callback/token vault + provider verification; don't set connected status until token and scopes are verified. |
| `confirmPayPalSubscription` | Reconciles a supplied PayPal subscription ID against PayPal and owner. | PayPal REST verification + DB transaction; paid access only after provider confirmation. |
| `createCommunity` | Feature-gated community creation plus owner membership; compensates by deleting community if membership creation fails. | Supabase transaction creates community + owner membership atomically. |

**Cross-cutting SDK contract:** these handlers rely on `createClientFromRequest`, `auth.me()`, `asServiceRole`, entity CRUD/filter/list/upsert/updateMany, connector OAuth token access, LLM invocation, analytics, and Base44-managed runtime secrets. The replacement needs an explicit server request context with validated Supabase JWT, user/app metadata, service-role DB client confined to the Worker, provider adapter registry, queue/LLM adapters and audit context. Merely swapping the import path or renaming the `base44` variable will not preserve these semantics.

**Critical implementation notes discovered in this batch:**
- PayPal capture and withdrawal must share one canonical IFund financial-operation ledger. The source deliberately separates the holding ledger, donation mirror and notification mirror; duplicate/retry behavior must be idempotent.
- `broadcastPosts` has meaningful manual fallback paths and does not imply every platform has a working API. Preserve these distinctions.
- OAuth completion is not itself provider verification. Connection status must remain unverified until the provider adapter proves access.
- Admin builder/admin gateway handlers require explicit super-admin checks; ordinary `admin` status is not enough for owner-only operations.
- AI content application and external publishing are separate actions; preserve the human approval boundary.

**Progress:** 20/184 backend entrypoints inspected in full (10.9%). Next source-order batch begins at `createDiscussionPost`. No source repo edits, production DB changes, OAuth registrations or live payments were performed.


### Source traversal — backend function entrypoints, batches 2–4 (50/184)

The next 30 files were fetched in full, including the two helper modules in the `discoverExternalCampaignSnapshot` directory. The handlers reveal several important replacement constraints:

| Handler(s) | Behavior to preserve / replacement |
|---|---|
| `createDiscussionPost`, `createCommunity`, `createVolunteerOpportunity`, `createSupportTicket`, `createInstitution`, `createKnowledgeArticle` | Authenticated user creation with membership/manager/admin checks and bounded inputs. Move to Worker + Supabase constraints/RLS; use transactions for community + owner membership. |
| `createDistributedPost`, `createSocialPost`, `draftSharePost`, `generateDistributionContent` | Content drafting and publishing are distinct. Persist owner-bound drafts, verified connection ownership, selected donation destination, human review, and no external publish until separately approved. LLM adapter must have a clearly labeled template fallback and no fabricated claims. |
| `createDonationCheckout`, `createPremiumDayPassCheckout`, `createSubscriptionCheckout` | These are explicit retired Stripe tombstones returning HTTP 410. Preserve retirement; do not re-enable Stripe. |
| `createPayPalOrder`, `createPayPalSubscriptionCheckout`, `cancelPayPalSubscription`, `confirmPayPalSubscription`, `capturePayPalOrder` | PayPal is the designated payment provider. Move provider calls and secret access to Cloudflare Worker; persist intents and canonical operations in Supabase; verify webhook/capture with PayPal; preserve donor gift-first accounting and idempotency. |
| `decideGrantApplication` | Institution owner makes the decision; awards are canonical PENDING financial operations until receipt is verified, not withdrawable donations. Preserve this distinction. |
| `deleteAccount` | Retry-safe staged deletion/anonymization with financial obligations blocking deletion, provider billing cleanup, and retention of the audit/ledger trail. The source contains Stripe-specific subscription cleanup and a statement that Base44's built-in identity fields cannot be cleared. Replacement must use Supabase Auth deletion/anonymization APIs and preserve ledger obligations; Stripe cleanup must not become an active billing path. |
| `deleteCampaign` | Campaign deletion requires server-side ownership and should preserve/reject deletion when financial records, linked posts or external sync obligations exist. Confirm exact source conditions during its dedicated implementation. |
| `deviceAuthorization` | Device-code authorization flow with hashed device/user/access codes, expiry, polling and admin review. Port to Worker with hashed one-time codes, rate limits, and Supabase transaction/unique constraints. |
| `disconnectPlatformConnection`, `completeOAuthConnection`, `finalizeAppUserOAuthConnection`, `getAppUserConnector` | Base44 app-user connector tokens are a hard runtime dependency. Replace with IFund OAuth callback/token vault, token refresh and provider-side revocation; locally revoke OBO/automation before attempting remote disconnect. |
| `discoverConnectionMethods` | Returns candidate transports, not proof of capability; keep route discovery separate from provider verification. |
| `discoverExternalCampaignSnapshot` + `publicCampaignSnapshot.ts` | Explicit, authenticated, rate-limited/idempotent discovery of public campaign metadata from an allowlisted set of provider domains. Preserve strict HTTPS host allowlist, redirect revalidation, response-size/time limits, request claims and audit events. |

#### Read/query and feature-control handlers

- `discoverFeatures`: service-side scan of a user's own campaigns, connections, memberships, institutions and activity; deduplicates recommendations. Must be authenticated to a user or trusted workflow; do not expose arbitrary user-ID scanning to unauthenticated callers.
- `getCampaignDonations`: server filters verified donations; public output is sanitized and confirmed-only; owner/admin may request pending rows. This is a privacy and financial-truth boundary.
- `getCampaignDraft`: only owner/admin may load a draft; keep drafts hidden from public API.
- `getCampaignWithdrawalBalance`: source uses a 7-day clearing period, distinguishes verified donations from settled external holdings, and excludes institutional awards until verified. Preserve until an explicit financial-policy change.
- `getCommunityFeed`: public visitors receive public events only; signed-in users additionally receive follower events; service-side filtering and sanitized pagination are required.
- `getFeatureAvailability` and `getFundraisingMode`: public display hints only; backend must independently enforce feature flags and fundraising mode on protected operations.
- `getLiveProviderStatus`, `getBufferReadiness`: admin-only, read-only provider readiness checks. A configured secret/reference is not proof of a live integration; never expose secret values.
- `getMyGiving`: owner-scoped, provider-verified gifts only; separates campaign gift, optional platform support, processor fee and total charged.
- `getOwnerDonorDirectory`: campaign-owner-only aggregation, verified gifts only, anonymized donors not contactable.
- `getOwnerFinancialLedger`: owner-scoped view joining canonical FinancialOperation and HoldingLedgerEntry; operations and custody must remain separate entry types.

#### Provider-policy finding

The source contains a Stripe Connect status/readiness path in `getConnectedPayoutAccount` and Stripe imports/cleanup in account deletion. This is not permission to reactivate Stripe. In the independent implementation, Stripe donation/checkout/payout execution remains retired; preserve historical reversal and reconciliation records only where needed. The source also has a fail-closed crypto readiness response: wallet connection is not payment acceptance and no campaign credit should occur without verified on-chain settlement.

**Progress:** 50/184 entrypoints inspected in full (27.2%). The next source-order batch begins at `getPayPalConfig`. Source repository remains read-only; no live payments, OAuth or production database changes were made.


### Source traversal — backend function entrypoints, batch 5 (60/184)

The next ten read/administrative endpoints were fetched and inspected in full.

| Handler | Dependency and destination |
|---|---|
| `getPayPalConfig` | Reads PayPal runtime secrets and returns only public client ID plus readiness/account metadata. Replace secret access with Worker environment bindings; never return client secret. Keep donation-link readiness separate from REST checkout readiness. |
| `getPayPalPayoutReadiness` | Obtains PayPal OAuth token and performs a deliberately nonexistent payout-batch read-only probe. Port as an admin-only server-side readiness check; preserve the no-money-movement guarantee and don't expose token/scope values. |
| `getPayPalSubscriptionOptions` | Authenticates user, checks eligibility/nonprofit approval, live plan mapping and remote webhook event coverage. Port to PayPal REST + Supabase; only provider-verified live plans are offered. |
| `getPaymentCapabilities` | Public-safe PayPal donation/API/payout capability snapshot. Rebuild from server-side secret bindings and live PayPal verification. |
| `getSharedConnectorStatus` | Verifies platform-managed Slack bot and Wix integrations through provider API calls. Replace Base44 shared-connector storage with IFund-owned Cloudflare secrets/OAuth credentials and retain read-only verification. |
| `getStripeIntegrationAudit`, `getStripeReadiness` | Stripe-only read-only readiness/audit code; one embeds the Base44 webhook URL. These are not needed for live payments under the standing PayPal-only policy. Do not port as an enabled integration; retain historical reconciliation evidence only, or return a retired/disabled status. |
| `getStripeSubscriptionOptions` | Already a retired compatibility response; keep disabled. |
| `getUnifiedInbox` | Read-only user-scoped conversations/messages and inbox items; no send, provider sync or cross-account search. Port to Supabase with strict per-user RLS and sanitized responses. |
| `getVerifiedIFundIntegrationContext` | Read-only, redacted connection/recipe context for agents; explicitly does not grant mutations. Port with owner/super-admin authorization and no secrets. |
| `getWritingResearchBrief` | Subscription-gated read-only research brief, only verified-source status. Port to Supabase read with user entitlement enforcement and source provenance. |

**Provider-policy note:** `getStripeIntegrationAudit` explicitly enumerates the historical Base44 webhook endpoint and Stripe account/price metadata. This endpoint must not be confused with PayPal readiness or used to re-enable Stripe checkout. The independent platform's neutral provider status model should show Stripe as retired, not as an actionable setup requirement.

**Progress:** 60/184 backend entrypoints inspected in full (32.6%). Next source-order batch begins at `importExternalCampaign`. No live provider settings or production data changed.


### Source traversal — backend function entrypoints, batches 6–8 (120/184)

Another 30 handlers were fetched and inspected. Three files in this range are particularly important: the 470-line `requestWithdrawal`, the photo service with Base44-only media URL assumptions, and the agent chat bulk-approval route.

| Handler(s) | Behavior and replacement contract |
|---|---|
| `manageVerificationMailbox` | User-owned verification aliases/messages, encrypted mail body decryption, expiry and no general-inbox exposure. Port encrypted mail storage and key management to a dedicated server-side secret/key service; do not expose verification codes to agents. |
| `markNotificationRead` | User or admin can mark own notification read; simple Worker + RLS update. |
| `matchExternalPayPalSettlement`, `reconcileExternalPayPalSettlement` | Admin verifies a settled receiving PayPal transaction, uniquely matches one provider-verified external observation, then records settled holding ledger. Preserve zero/multiple match fail-closed behavior and idempotency. |
| `mirrorExternalPosts` | Scheduled owner-scoped external feed mirroring. Only Bluesky read adapter is implemented; unsupported providers must remain explicit skipped states. Preserve owner authorization, no shared-connector fan-out and deduplication. |
| `ownerAgentChatActions` | User chat command can approve at most 12 of their own eligible drafts/posts; exact explicit instruction required. Applies IFund content, then separately calls publishing route for external posts. Preserve user-owned scope, explicit instruction parsing, per-item outcomes, no hidden broad approval, and partial-result reconciliation. |
| `payPalSubscriptionWebhook` | PayPal subscription lifecycle webhook; verify provider signature, idempotently apply events and reconcile plan access. |
| `postCampaignUpdate` | Owner publishes a campaign update; optional cross-post is a separate owner-triggered action; followers receive notifications and public activity event. Preserve the explicit cross-post choice and consent model. |
| `postDiscussionReply` | Authenticated reply creation plus atomic reply-count increment. Use a DB transaction/RPC and community access checks. |
| `prepareCollectAndWithdraw`, `authorizeCollectAndWithdraw`, `executeCollectAndWithdraw` | Three-stage external collection process: prepare a 15-minute expiring consent snapshot; owner confirms; only provider-supported transfer adapters may execute. The source currently requires Stripe Connect payout readiness in the prepare path even though live Stripe is retired. Replace this dependency with the IFund PayPal business holding/payout architecture or leave external collection disabled; never advertise an executable route until it exists and is independently verified. |
| `processAdminActionInbox` | Reads admin approval conversation and asks LLM for missing information, excluding submitted credentials. This source workflow currently trusts internal scheduled invocation; replacement must enforce service-to-service authorization and sanitize secrets before model context. |
| `publishInstitutionOpportunity` | Institution owner/admin publication, atomically increments opportunity count. Supabase transaction. |
| `publishLinkedCampaignToConnection` | First campaign launch post after verified connection; direct publish only if verified adapter supports it, otherwise creates manual handoff. Crowdfunding link does not imply IFund created an external fundraiser. |
| `publishPost` | External post publishing. Requires owner chain, approval, active feature, capability verification, subscription and consent for automation; unsupported/media paths return manual approval rather than fake success. |
| `receiveCloudflareEmail` | Cloudflare Email Routing inbound endpoint. Port to Cloudflare Email Worker, authenticate/validate provider event and store only allowed mail categories. |
| `recordAgentInteraction` | Records interaction only; must not accept client-asserted approval or external execution. Destination IFund agent run/audit record. |
| `recordCampaignCreated` | Ensures campaign identity in canonical financial store, emits public activity event and prepares cross-post drafts. Replace old canonical-store registration with Supabase campaign identity; analytics becomes an optional provider adapter. |
| `recordDonation` | Supporter-reported PayPal/Cash App gifts are PENDING only, not verified, not counted in campaign totals and not withdrawable until admin confirms receipt. Preserve gift-first amount and idempotency. |
| `recordExternalFundMigration` | Admin-only reported external amount record with prospective 3% fee; explicitly not provider verification, IFund custody, or withdrawal eligibility. Preserve as reconciliation intake only. |
| `recordLegalAcceptance` | Versioned explicit checkbox/button assent; server records user, version and timestamp. Port to immutable Supabase legal acceptance row; no inferred consent. |
| `refreshWritingResearch` | Scheduled weekly public-source fetch + LLM synthesis, source provenance, retry spacing and verified/partial status. Port with cost/rate caps and untrusted-source isolation; no provider-specific Base44 LLM dependency. |
| `registerPushDevice` | FCM token registration/revocation tied to verified user, max six active devices. Replace Base44 user guard and entity writes; FCM token never becomes an authentication credential. |
| `renderInterplanetaryPhoto` | Uses Base44-only media CDN and app-scoped upload URL validation, then OpenAI image edit and Base44 UploadFile fallback. Replace accepted media host with IFund R2 public/custom domain, signed upload and ownership checks; keep OpenAI key server-side and preserve honest fallback when image edit unavailable. |
| `repairStripeWebhookEvents` | Stripe-specific repair mutates Stripe webhook subscriptions and includes Base44 webhook URL. Do not port; retired Stripe must not remain an active setup/repair workflow. |
| `requestWithdrawal` | Critical 470-line PayPal payout state machine. See detailed invariants below. |
| `resolveConnectionStatus`, `resolvePlatformConnectionRecipe` | Compose shared/app-user connector, OAuth transport, connection record, capability, recipe and OBO into one lifecycle state. Replace Base44 connector/token access with IFund OAuth service; recipes are candidates, not proof; caller-submitted success is rejected as evidence. |
| `reviewAgentActivity` | Owner/admin may approve/reject pending agent activity; this is a review status, not proof that an action executed. Preserve separation. |

#### `requestWithdrawal` — financial invariants that must not be weakened

The source implements:
- Seven-day clearing window and a $1,000 review threshold.
- Daily withdrawal limit unless subscription entitlement is active.
- Campaign owner-only request, verified PayPal payout readiness, valid matching PayPal email.
- Canonical financial reservation before PayPal payout; linked donation and settled external-holding rows are reserved together.
- PayPal payout sender-batch idempotency; unknown provider outcome retains reservation.
- On confirmed PayPal success, canonical ledger is completed and a PayPal holding outflow is recorded.
- On ambiguous result, state becomes `provider_status_unknown`; funds are not released.
- If PayPal accepted but canonical completion failed, state becomes `reconciliation_pending`; funds remain reserved.
- Release requires admin-confirmed provider non-payment and explicit confirmation.
- Admin can reconcile provider-paid payout without sending money again.
- Admin can clear manual PayPal/Cash App reports only after explicit receipt verification.
- New payout requests are blocked unless outbound payout feature and live PayPal payout readiness both pass.

**Old backend-specific coupling:** `operationKeyFor` prefixes `base44-withdrawal:`; the handler imports `base44Financial.ts` for reserve/complete/cancel; it reads the Base44 service role for every ledger and withdrawal mutation. In the independent system use `ifund-withdrawal:<id>` and a Supabase Postgres RPC/transaction as the only canonical reservation authority. PayPal remains the payout processor. Stripe subscription entitlement logic in this source is legacy and must be replaced with PayPal subscription state, not carried over.

#### Additional explicit Base44-to-IFund wording mappings

- `recordAgentInteraction` result `stored_in: 'base44'` → `stored_in: 'ifund'` (or remove storage-provider claim and return a neutral record reference).
- `recordCampaignCreated` comment "canonical Base44 financial store" → "canonical IFund financial ledger".
- `recordCampaignCreated` comment "Base44 preserves canonical financial values" → "Supabase canonical ledger preserves verified financial values".
- `registerPushDevice` comment "verified Base44 user" → "verified IFund user".
- `renderInterplanetaryPhoto` URL allowlist `media.base44.com`, `base44.app/api/apps/<app-id>/files`, hardcoded app ID and Base44 UploadFile → IFund R2/custom media domain + signed object upload; old Base44 URL support only in a temporary, explicit legacy-import adapter if historical images still require it.
- `requestWithdrawal` key prefix `base44-withdrawal:` → `ifund-withdrawal:`.

**Progress:** 120/184 backend entrypoints inspected in full (65.2%). Next source-order batch begins at `revokeConnectionAiConsent`. No live payouts, Stripe modifications, OAuth changes, or production DB writes were performed.


### Source traversal — all 184 backend function entrypoints complete

**The full `base44/functions/` entrypoint set is now inspected: 184/184 `entry.ts` files fetched in full.** The four non-entrypoint helper files were also fetched and reviewed: the public snapshot parser under `discoverExternalCampaignSnapshot/`, the import-operation convergence helper, and the snapshot parser under `importExternalCampaign/` and `syncImportedCampaign/`. The recursive Git tree was reconciled against the exact inspected entrypoint names; no entrypoint path remains unaccounted for. The source repository remains read-only.

#### Additional execution/agent and platform handlers (final source-order groups)

| Handler group | Finding / required independent replacement |
|---|---|
| `revokeConnectionAiConsent`, `setConnectionAiToggle`, `setUnifiedOboConsent` | Owner-level AI/OBO permission with account-specific opt-out, permission version, granted capabilities, revocation and in-flight delegation pause. Implement one authoritative Supabase consent record + server-enforced connection scope. A global grant must never override a provider-specific refusal. |
| `routeAgentTask`, `trackAgentConversation`, `executeAdminAgentRequest` | These rely on `base44.agents` conversation creation, message dispatch and polling. Replace with IFund-owned agent runtime/registry and durable Supabase run state + Cloudflare Queues/Workflows. Preserve owner-scoped routing, allowlisted agent roles, conversation baseline IDs, rate limits, tool-state inspection, explicit approval and "response received ≠ action verified". |
| `runOutreachAgent`, `runReporterDiary`, `runSocialAutopilot`, `runOfficialSocialPromotion`, `maintainPlatformOwnedAccounts` | Scheduled autonomous agents use Base44 entities, service-role LLM, schedules/workflows and Base44 secrets. Port only after durable schedule/queue, cost cap, owner subscription/consent, per-campaign cooldown, approval queue and idempotent writes exist. Draft/recommendation creation is not permission to publish. |
| `manageApprovedBuilderExecution`, `executeAdminAgentRequest`, `manageAdminBuilderWork`, `managePlatformIncidents` | Current "portable" admin builder is still backed by `approvedBuilderBridge.ts` and a Base44 app-builder submission/release API. Replace with IFund-owned repository automation (GitHub PRs, tests, preview/deployment workflow) behind strict super-admin authorization. Keep review evidence, separate release approval and live verification. Never call a Base44 builder or incur Base44 credits in the independent product. |
| `runBrowserConnection` | Deliberately fail-closed no-op: no Browserbase request, no metered run, no claimed provider verification. Preserve no-op until an approved URL/network policy, atomic quota and SSRF-safe browser isolation exist. Browserbase is a separate vendor and requires its own decision; it is not interchangeable with Base44. |
| `saveCampaign`, `updateCampaignSettings`, `deleteCampaign`, `recordCampaignCreated` | Owner-controlled campaign lifecycle. Port with Supabase transactions, required publish fields, server-side ownership, no client-written financial totals, event idempotency and protection of campaigns with ledger/external obligations. |
| `saveConnectionCredentials`, `verifyPlatformConnection`, `syncConnections`, `resolveConnectionStatus`, `verifyAppUserConnector` | The Base44 SDK connector service is the OAuth token provider and the connection verification boundary. Replace with IFund OAuth service and encrypted credential store; preserve redaction, token refresh, provider-backed checks, capability verification, connection lifecycle, account ownership and OBO consent. |
| `setupPayPalSubscriptionWebhook`, `payPalSubscriptionWebhook`, `syncPayPalSubscriptionCatalog`, `verifyOwnerPayPalBasicPlan` | PayPal subscription lifecycle and plan catalog are active intended integrations. Replace Base44 runtime secrets/entity persistence with Cloudflare secret bindings + Supabase mapping tables; preserve exact live merchant, remote plan verification, webhook event coverage, signature verification and idempotency. |
| `stripeWebhook`, `startStripeConnectOnboarding`, `syncStripeSubscriptionCatalog`, `repairStripeWebhookEvents`, `manageConnectedPayoutAccount`, `getConnectedPayoutAccount`, `manageRecurringDonation` | Stripe is present in legacy code, including onboarding, webhook, recurring donation and Connect payout paths. The standing product policy is PayPal-only; destination should retain only historical audit/reversal data and explicit retired 410/disabled handlers. Do not migrate any live Stripe checkout, subscription or payout execution. |
| `syncExternalFunds`, `importExternalCampaign`, `syncImportedCampaign`, `reconcileExternalPayPalSettlement`, `matchExternalPayPalSettlement`, `discoverPayPalHoldingSettlements`, `justGivingStagingPilot`, `kofiWebhook` | External data observations, imports and settlement are separate. Explicit user/admin sync requests only; request IDs, leases/claims, stable provider transaction IDs, provenance and local field locks. Observed external money is never IFund-withdrawable until independently received into PayPal and reconciled to the holding ledger. |
| `syncGitHub` | Reads GitHub branch/commit state and records drift checkpoints; source movement itself is still delegated to Base44 native sync. Replace with GitHub App/OAuth credentials and an IFund-owned audited PR/merge/deploy workflow. |
| `syncFromConvex` | Already retired; its response says Base44 is authoritative. Replace the historical statement with "Convex migration is retired; Supabase is the current target authority" in destination-only code/docs. |
| `syncWixAnalytics`, `syncWixBusinessData`, `syncWixCampaigns`, `syncWixContent`, `wixWebhook` | Wix is a separate provider and remains an optional integration. Replace Base44 shared connector token retrieval and storage with IFund OAuth/secrets and Supabase sync records; preserve signed Wix webhook validation, idempotent event receipt and external-commerce-only financial treatment. |
| `sendCommunication`, `sendPublicContactMessage`, `volunteerFollowUp`, `welcomeVolunteer` | Base44 Core SendEmail is the mail delivery dependency. Replace with an IFund-owned email provider adapter (or verified Cloudflare email service), consent preferences, rate limits, owner-only recipient scopes and delivery status; no mail provider credentials in browser. |
| `renderInterplanetaryPhoto` | Base44 media CDN allowlist and UploadFile are hard-coded. Replace with R2 object storage, signed upload/download URLs, ownership checks and a neutral `MEDIA_PUBLIC_BASE_URL`; keep AI image edit as a separate provider adapter. |
| `registerPushDevice` | FCM device registry is not an auth provider. Replace the Base44 user/entity operations with authenticated Worker + Supabase push-device table; preserve six-device limit, token validation and user-bound revocation. |
| `recordLegalAcceptance`, `verifyAdminGateway`, `verifyAgentPlatformAccess`, `validateIntegrationHealth` | Port immutable legal assent, owner-only super-admin verification, per-agent provider authorization and provider-backed health checks. Registry/configuration presence alone must never be treated as working integration evidence. |
| `translateCampaign`, `generateIntelligence`, `generateSocialContent`, `generateDistributionContent`, `generateCampaignCover`, `analyzeGrantApplication` | Base44 Core LLM invocation must become a pluggable IFund AI provider. Preserve JSON schema validation, source/data provenance, user consent, rate/usage caps, truthful template fallback and human review. |
| `volunteerSignup`, `volunteerFollowUp`, `welcomeVolunteer`, `publishInstitutionOpportunity`, `applyInstitutionOpportunity`, `listInstitutionApplications`, `decideGrantApplication` | Supabase tables + atomic membership/count/award RPCs; verified award receipt remains pending until provider evidence. |
| `updateInboxItem`, `getUnifiedInbox`, `manageVerificationMailbox`, `receiveCloudflareEmail` | IFund-owned inbox, encrypted verification mail, Cloudflare inbound mail and user-scoped message storage. Never expose verification mail through agent context or general inbox. |

#### Important implementation findings from final backend review

- `manageApprovedBuilderExecution` has no literal Base44 term in its entrypoint, but its imported `approvedBuilderBridge.ts` still uses a Base44 builder API. This is a semantic dependency hidden behind a neutral helper name. It must be replaced, not renamed.
- `executeAdminAgentRequest` is named `portable_admin_gateway`, but uses Base44 agent conversations. "Portable" naming is not evidence of independence.
- `runOutreachAgent` and the scheduled agent functions use service-role entity access and `integrations.Core.InvokeLLM`; the runtime, secrets and scheduler all need replacement. No automatic background publishing should be added during migration.
- `setupPayPalSubscriptionWebhook` hardcodes `https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook`. Replace it with a canonical `PAYPAL_WEBHOOK_URL` / deployment-config value after the independent Worker route is deployed and externally verified. Do not register a callback to a route that is not live.
- `syncGitHub` only observes GitHub HEAD; its "push" direction does not push code. The source comments explicitly say source application is still Base44 native synchronization. Replace with the real GitHub-owned workflow, not a misleading renamed health check.
- `syncFromConvex` is retired but still says Base44 is authoritative. This historical string must be corrected in the destination.
- `syncExternalFunds` and the external campaign import helpers use stable request IDs, fencing/lease claims, provenance and locked fields. These are important concurrency and data integrity contracts that must survive the migration.
- `stripeWebhook`/Stripe subscription and Connect handlers must not be reactivated. PayPal is the approved live processor; Stripe's legacy data may be retained for reconciliation only.
- `wixWebhook` already verifies RS256 signatures and de-duplicates event deliveries; preserve this provider security behavior when moving storage.
- `runBrowserConnection` is intentionally a no-op and must stay that way until safe browser automation is deliberately implemented and budgeted.

**Backend audit status:** 184/184 entrypoint files inspected; four additional helper files inspected; 188/188 files in the `base44/functions/` tree accounted for. This completes the backend source-code traversal. It does **not** mean the 184 endpoints have been ported: the independent Worker currently implements only its documented small route set, and the initial Supabase schema still contains four tables. The next audit layer is `src/` frontend call sites and shared runtime helpers, followed by the complete data/agent/workflow migration.


### Source traversal — all 48 shared backend modules complete

**48/48 files under `base44/shared/` fetched and inspected in full.** This closes the shared-runtime helper layer. Source files remain read-only.

#### Hard Base44 runtime and data-plane dependencies

| Source helper | Finding | Independent replacement |
|---|---|---|
| `accountGuard.ts` | Calls Base44 auth + service-role User read to detect pending deletion/disabled accounts. | Verify Supabase JWT and fresh account status from Supabase before every protected operation. |
| `activityEvent.ts`, `auditLog.ts` | Writes ActivityEvent/AuditLog through Base44 service role; audit metadata has recursive secret redaction. | Supabase insert/RPC with server-only writes, append-only audit policy and same redaction. |
| `approvedBuilderBridge.ts` | Hard dependency on `app.base44.com`, `IFUND_BASE44_PLATFORM_TOKEN`, workspace ID, app ID and Base44 deploy API. | Delete from independent runtime; replace with GitHub PR + CI + Cloudflare deploy approval. |
| `base44Financial.ts` | Name is provider-specific, but logic defines canonical donation allocation, external observations, withdrawal reservations, duplicate convergence and campaign projection. | Reimplement as Supabase SQL functions/transactions with unique operation keys, immutable financial allocation and idempotent ledger writes. Do not just rename the file. |
| `connectionCrypto.ts`, `verificationEmailCrypto.ts` | Read AES keys through Base44 runtime secret store; encrypted connection secrets and verification mail. | Cloudflare Worker secret bindings or a dedicated vault/KMS; versioned ciphertext, key rotation and no plaintext fallback. |
| `connectionVerification.ts` | Uses Deno env OAuth connector IDs and Base44 app-user connector tokens; contains one Base44-specific Mastodon SSRF comment. | IFund OAuth service/token vault and explicit provider probes; retain DNS-pinned/redirect-safe outbound policy. |
| `crossPost.ts` | Uses Base44 Core InvokeLLM, entities and service role to create drafts/publish records. | AI provider adapter + Supabase draft/queue tables + Cloudflare queue/worker; keep owner approval and manual fallback. |
| `featureFlagGate.ts`, `fundraisingMode.ts`, `prelaunchPayments.ts` | Feature gates read Base44 FeatureFlag entity. | Supabase server-side feature flags with fail-closed unique/scope checks. Never let a flag grant user consent or provider capability. |
| `financialMirrors.ts` | Explicitly calls Base44 FinancialOperation authoritative and maintains Donation/Notification/InboxItem mirrors. | Supabase canonical ledger first; projections are rebuildable and never authoritative. |
| `integrationRegistry.ts`, `providerCapabilities.ts`, `liveProviderReadiness.ts` | Registry/capabilities stored in Base44 entities; runtime secrets from `base44:runtime`; OAuth through Base44 connector APIs. | Supabase provider registry + Worker secret bindings + live provider checks. Capability config is not provider proof. |
| `liveProviderReadiness.ts` | Includes Stripe as a retired provider, but also checks NOWPayments/Reown/OpenAI config presence. | Preserve PayPal live readiness. Stripe stays disabled. Crypto and AI remain unavailable until actual end-to-end provider verification. |
| `readEntityPages.ts` | Generic pagination wrapper, but explicitly uses Base44 entity filter API and Base44 error wording. | Supabase cursor pagination using stable primary-key order and explicit truncated-scan result. |
| `sendDonationReceipt.ts` | Uses Base44 Core SendEmail; comments still list Stripe webhook as a receipt source. | IFund email provider adapter. Only provider-verified donations may trigger receipts; remove Stripe from new-payment path. |
| `serverImagePolicy.ts` | Hardcoded Base44 media CDN/app host and Core UploadFile, with server-side watermark transformation. | R2 object store + `MEDIA_PUBLIC_BASE_URL` + signed upload; preserve watermark rules and server-side paid entitlement check. |
| `paypal.ts`, `paypalSubscriptions.ts` | PayPal operations use Base44 runtime secrets; checkout CORS allowlist includes Base44 app host. | Same PayPal logic with Cloudflare secret bindings; replace callback/origin with independent canonical Worker/site origin only after deployment verification. |
| `premiumAccessCatalog.ts`, `stripeCryptoReadiness.ts`, `stripeSubscriptionCatalog.ts` | Legacy Stripe premium products, stablecoin readiness and recurring plan lookup. | Do not migrate as active billing. PayPal is the designated subscription/payment provider; keep Stripe data only as historical reconciliation evidence. |
| `platformConnectionRecipes.ts`, `aiConnectionScope.ts`, `verifiedConnectionCapabilities.ts`, `socialPublishingPolicy.ts` | Mostly provider-neutral policy and capability data. | Retain semantics; change execution to IFund runtime. Do not infer capabilities from requested scopes or prose. |
| `browserbaseSecrets.ts` | Separate Browserbase API/keypair and secret vault integration, not Base44. | Treat Browserbase as a separate vendor decision. Do not silently fold it into the Base44 rename; browser execution currently remains fail-closed. |

#### Exact Base44 wording and naming corrections

- `connectionCrypto.ts:2`: "Base44 backend secrets" → "Cloudflare Worker secret bindings / IFund secret manager".
- `connectionVerification.ts:237`: "Until Base44 provides a DNS-pinned..." → "Until IFund provides a DNS-pinned...".
- `financialMirrors.ts:3–4`: "Base44 FinancialOperation is the financial authority" and "Base44 rows exist..." → "IFund canonical FinancialOperation ledger is authoritative" and "projection rows exist for application read models".
- `providerCapabilities.ts:7,33`: "Base44 build" → "IFund Worker/runtime"; stored research must still not invent implementations.
- `readEntityPages.ts:1,11,20`: "Base44 entity pagination" / "Base44 pagination..." → "IFund database pagination" / "database cursor pagination...".
- `serverImagePolicy.ts:19–20,25`: Base44 media URLs and redirect behavior → R2/IFund media host and signed object URLs.
- `socialPublish.ts:7,55`: "Base44 OAuth connector" / "Until the Base44 runtime provides..." → "IFund OAuth adapter" / "Until IFund provides...".
- `approvedBuilderBridge.ts`: remove entirely from independent branch; it is a real Base44 builder integration, not wording.
- `paypalSubscriptions.ts:93`: Base44 app origin in allowed checkout origins → remove once the independent canonical origin is deployed and verified.
- `liveProviderReadiness.ts:1`, `paypal.ts:1`, `paypalSubscriptions.ts:1`, `stripeCryptoReadiness.ts:2`, `stripeSubscriptionCatalog.ts:2`, `verificationEmailCrypto.ts:1`: `base44:runtime` secret import → Cloudflare Worker environment binding adapter.
- `accountGuard.ts`, `activityEvent.ts`, `auditLog.ts`, `crossPost.ts`, `featureFlagGate.ts`, `fundraisingMode.ts`, `prelaunchPayments.ts`, `socialPublish.ts` and many others use a parameter named `base44` even where the business logic is neutral. Rename to a neutral `ctx`/repository interface only after the adapter contract is defined and all callers are migrated.

#### Additional architecture defects that a superficial rename would preserve

1. **Financial authority:** the old helper calls Base44 FinancialOperation the source of truth. The destination must instead use Postgres transactions/constraints as the single authority. A mirror-only Supabase port would preserve the same single-provider lock-in.
2. **Runtime secrets:** Base44 secret imports are used by PayPal, verification email, Stripe, live readiness and connection encryption. Each must be moved to a server-only binding; no secret may be sent to frontend or committed to config.
3. **Image storage:** both `renderInterplanetaryPhoto` and `serverImagePolicy` accept only Base44 media paths and upload via Base44. R2 is already available on the migration target; use one neutral media service contract and a controlled legacy import path for old images.
4. **AI:** Base44 Core InvokeLLM appears in shared cross-posting and multiple agents. A neutral AI adapter must support structured JSON validation, budget/rate limits, source provenance and a truthful unavailable fallback.
5. **OAuth:** app-user and shared connectors are Base44-hosted token stores. Supabase Auth does not replace external-provider OAuth. The independent OAuth service/token vault is a distinct component.
6. **Stripe policy conflict:** the shared source still contains Stripe premium products, crypto readiness and subscription catalog helpers, even though live payments are designated PayPal-only. These must remain retired; don't accidentally make them operational during decoupling.
7. **External sync safety:** `externalSyncRequest.ts` implements a global lease/mutex, rate slots, request fingerprint, fenced claims, stale retry and explicit authenticated requests. Port its concurrency guarantees using database uniqueness/transactions or durable Cloudflare workflows, not process-local locks.
8. **Browserbase:** this is a separate third-party credential service; it should remain explicitly unconfigured/fail-closed until a user-approved browser automation design exists.

**Shared-helper audit status:** 48/48 files inspected. Together with the completed 184/184 function entrypoints and 95/95 entity schemas, all primary Base44 backend code/config directories reviewed to date are accounted for. Next: complete frontend `src/` traversal, then the remaining `base44/` agents, connectors, workflows, and UI-specific Base44 SDK usage.


### Source traversal — frontend `src/` inventory and first-pass dependency map

The recursive tree contains **367 files** under `src/`: 243 component files, 57 page files, 56 `src/lib` files, 5 hooks, and the application/root CSS/entry files. GitHub code search was partitioned by source folder to avoid the 100-result cap. It identified **171 files with explicit Base44 wording or SDK/runtime call sites**: 100 component files, 52 page files and 19 library files; no Base44 hits in `src/hooks/`, `src/App.jsx`, `src/main.jsx`, `src/index.css` or `src/styles-ifund-studio.css`. These are search-discovered candidates; detailed per-file source traversal is continuing.

#### Frontend replacement contract

| Legacy surface | Current dependency | Destination contract |
|---|---|---|
| `src/api/base44Client.js` | `@base44/sdk`, app ID, functions version, SDK host selection, automatic auth redirect. | Replace with IFund `apiClient` that calls same-origin `/api/*` or `VITE_API_BASE_URL`; no vendor SDK or hidden host selection. |
| `src/lib/app-params.js` | `VITE_BASE44_APP_ID`, `VITE_BASE44_FUNCTIONS_VERSION`, `VITE_BASE44_APP_BASE_URL`, `base44_*_token` localStorage keys, Android hardcoded Base44 URL. | Remove app ID/functions version as client runtime requirements. Use Supabase session storage and optional neutral API origin. Migrate/clear old token keys only through a controlled sign-out/session migration; never reinterpret Base44 tokens as Supabase JWTs. |
| `src/lib/runtimeContract.js` | `dataPlane: "base44"` and Base44-specific mandatory environment assertions. | `dataPlane: "supabase-cloudflare"` or a neutral capability contract; API origin may be same-origin by default. Supabase public URL/key are explicit config; server secrets are never VITE variables. |
| `src/lib/AuthContext.jsx` | Base44 `auth.me/logout/redirectToLogin`, SDK internal Axios client, Base44 public app settings endpoint, provider-specific errors. | Supabase Auth session + `getUser()`, profile bootstrap, standard recovery/OAuth flows and neutral error mapping. Remove Base44 public settings request; move app public settings into a safe IFund config route. |
| `src/pages/Login/Register/ForgotPassword/ResetPassword.jsx` and `SocialButtons.jsx` | Base44 auth registration, OTP, password reset, OAuth provider login, token setter; Android login posts to `interplanetaryfund.base44.app/api/apps/<id>/auth/login`. | Supabase email/password + email OTP/verification and password recovery; OAuth callback to Supabase. Android Capacitor uses the same neutral API origin or Supabase Auth SDK; never hardcode Base44 host or reuse its bearer token. |
| `src/lib/adminAgentGateway.js` | Native admin chat defaults to Base44; Base44 SDK invokes admin endpoints; external Cloudflare gateway is optional. | Make IFund-owned Cloudflare admin gateway the only route. Verify Supabase JWT + super-admin owner on server for every operation; no native Base44 fallback or session marker. |
| `base44.auth.me()`, `base44.entities.*`, `base44.functions.invoke()`, `base44.integrations.Core.*` throughout pages/components | Direct data and function calls bypass a neutral frontend service layer. Entities support Base44 filters, list, get, create, update, delete and subscribe. | Route every operation through named IFund API functions/typed repository calls. Keep database access server-side for sensitive operations; use Supabase client directly only for explicitly RLS-safe read/write contracts. Replace realtime `.subscribe()` with Supabase Realtime only after table publication/RLS is verified. |
| `src/lib/secureLLM.js`, `src/components/social/PostComposer.jsx`, image generator flows | Browser invokes Base44 Core InvokeLLM / GenerateImage directly. | Server-side IFund AI adapter with structured output validation, consent, quota/cost limits and provider-neutral env. No provider keys in browser. |
| `src/lib/ifundImageBranding.js`, `src/components/media/MediaUpload.jsx`, `src/components/social/OfficialPublications.jsx`, `src/components/ui/image.jsx` | Base44 Core UploadFile/UploadPublicFile and media CDN; Wix transform host list includes `media.base44.com`. | R2 signed uploads + public/custom media origin + ownership checks. For legacy media, retain a controlled read-only import path; all new uploads go to R2. |
| `src/components/brand/BrandLogo.jsx`, `BrandHero.jsx`, `src/pages/Home.jsx` | Hard-coded public assets under `media.base44.com/images/public/<app-id>/...`. | Copy approved source assets to R2/static owned assets and update URLs/checksums. Do not hotlink Base44 media as a permanent production dependency. |
| `src/components/admin/Base44ReleaseStatus.jsx`, `src/pages/OpsCenter.jsx`, `src/components/platform/blueprint.js`, `BlueprintPanel.jsx` | UI says Base44 publication is required and Base44 is managed infrastructure. | Replace with Cloudflare release/deployment status, GitHub commit/build checks and Supabase migration state. Remove vendor-specific UI; never tell operators to publish through Base44. |
| `src/lib/helpCenter.js` | Help articles fetched from Base44 at runtime. | IFund Help API/Supabase records; retain the public taxonomy and stable article URLs. |
| `src/lib/integrationRegistryUi.js`, `AdminOAuthProviderReadiness.jsx`, `src/pages/AdminAgentApi.jsx` | Admin UX frames personal OAuth app registration as a Base44 workspace setup. | IFund OAuth client registry, provider callback URLs and encrypted client secret management. Provider-specific review requirements remain distinct. |
| `src/lib/creditFreeGenerators.js`, `campaignAssistantProvider.js` | Already designed to avoid Base44 metered AI and to fail closed rather than silently fall back. | Keep deterministic owned generators. Neutralize only historical Base44 wording; no metered AI should be introduced by this migration. |
| `src/lib/fees.js` | Frontend mirror references `base44/shared/fees.js`. | Point to IFund-owned shared fee contract or generated typed schema; preserve historic allocation and PayPal gift-first accounting. |

#### First-pass critical findings

- `src/lib/runtimeContract.js` still makes Base44 app ID and Base44 app URL mandatory. This is the exact kind of false configuration requirement the requested neutral contract must eliminate.
- `src/lib/AuthContext.jsx` imports an internal, non-public path `@base44/sdk/dist/utils/axios-client`. This is both a vendor lock-in and a brittle dependency on SDK internals.
- Android login is hardcoded to the Base44 domain and uses the Base44 app ID. This would keep the APK dependent on Base44 even if the web deployment moved to Cloudflare.
- Frontend pages/components directly call Base44 entity CRUD and real-time subscriptions; this is the largest application-wide dependency surface. A single API base URL does not migrate those data contracts.
- Admin builder chat is currently Base44-first, with Cloudflare optional. It must be reversed: IFund-owned gateway first, no Base44 fallback.
- Branding/logo/hero images are Base44-hosted. They must be copied to R2 or another IFund-controlled static host before the old media CDN can be retired.
- `src/components/ui/image.jsx` has an image transformer described as "Wix Media Platform support" while including Base44 media CDN as a host. Wix is a distinct service; retain Wix transformation only for actual Wix URLs and remove Base44 from that host list after asset migration.
- `src/components/platform/StripeIntegrationPanel.jsx` and the Stripe readiness screens should be retired/hidden under the existing PayPal-only payment policy. Do not re-enable Stripe by porting its UI.
- `src/lib/chatgptBuilderHandoff.js` instructs the user/agent to use a Base44 connector. Replace with GitHub/Cloudflare/IFund-owned tooling instructions and no Base44 access requirement.
- `src/pages/OAuthConsent.jsx` refers to `base44/mcp/config.json`; the independent OAuth consent page needs a new server-owned MCP/OAuth route, not a Base44 config path.

**Frontend audit status:** source tree inventory complete; search-discovered Base44 candidate files: 171/367. Full file-by-file line review and endpoint replacement mapping is ongoing. No source files were modified.


### Frontend library audit — `src/lib/` complete (56/56)

All **56/56** files under `src/lib/` were fetched and inspected in full. The following explicit dependencies and wording require destination changes:

| File | Source finding | Replacement |
|---|---|---|
| `AuthContext.jsx` | Base44 SDK auth methods; private SDK Axios helper; Base44 app public-settings endpoint; Base44 token storage/redirect assumptions. | Supabase Auth session/user APIs, neutral public-config endpoint and Supabase refresh/recovery flow. |
| `adminAgentGateway.js` | Base44 is the authoritative admin backend; external gateway optional; fake long-lived native admin session ID. | Require Cloudflare IFund admin gateway; short-lived server-issued session, every action revalidates super-admin owner; remove native fallback. |
| `androidFirebaseFeatures.js` | FCM push token register/revoke uses Base44 function endpoint. | IFund Worker push-device endpoints, Supabase RLS/admin-only mutation; preserve consent and device limit. Firebase itself remains a separate provider. |
| `app-params.js` | Base44 native URL, app ID, function version, localStorage keys. | Neutral API base URL; remove vendor app ID and function version; Supabase session only. |
| `campaignAssistantProvider.js` | Comment warns not to fall back to Base44 credits. | Retain no-fallback behavior; wording becomes "IFund-owned or explicitly configured AI provider". |
| `campaignSharing.js` | Comment names Base44/IFund X-Frame-Options behavior. | Describe the actual IFund production response/security header; remove Base44-specific mention after header is tested on Cloudflare. |
| `chatgptBuilderHandoff.js` | Handoff explicitly instructs use of Base44 connector, app ID, Base44-hosted authority and Base44 checkpoint. | Rewrite to IFund-owned GitHub PR, Cloudflare preview/deploy, Supabase state; no Base44 connector, ID or checkpoint. |
| `creditFreeGenerators.js` | Protective documentation says it intentionally avoids Base44 AI, hosted LLM, Browserbase and metered inference. | Keep deterministic generators and no-metered-fallback rule; replace the negative Base44 wording with "does not call external or metered inference providers". |
| `fees.js` | Frontend fee calculation mirror points at `base44/shared/fees.js`. | Change to the IFund shared fee contract; tests must keep the exact gift-first / withdrawal-fee policy and historical allocation behavior. |
| `helpCenter.js` | Article bodies are fetched from Base44. | IFund-owned Help API / Supabase HelpArticle table. |
| `ifundImageBranding.js` | Uses Base44 Auth to check paid watermark entitlement and Base44 Core UploadFile/UploadPublicFile. | Server-verified entitlement endpoint + R2 signed uploads. Watermark removal is decided server-side, never from client subscription claims. |
| `ifundPhotoService.js` | Accepts a Base44 client and calls Base44 photo render function. | Neutral `apiClient.post('/media/photo-treatment')` and R2 output URL. |
| `integrationRegistryUi.js` | UI registry mirrors `base44/shared/integrationRegistry.ts`. | Mirror IFund-owned provider registry schema, ideally generated/shared from a versioned contract. |
| `legalPolicy.js` | Comment points to `base44/functions/recordLegalAcceptance/entry.ts`. | Point to IFund legal-acceptance API and immutable policy versioning; changing terms still requires explicit re-acceptance. |
| `platformErrorReporter.js` | Sends errors to Base44 `managePlatformIncidents`. | Neutral IFund incident-report endpoint; bounded, redacted, no sensitive payloads. |
| `recordAgentInteraction.js` | Sends agent event to Base44 and labels source `base44_agent_chat`. | IFund agent-run endpoint and source `ifund_agent_chat`. |
| `runtimeContract.js` | `dataPlane: "base44"`; mandatory Base44 app ID and Base44 URL. | Replace with `dataPlane: "supabase-cloudflare"`; optional `VITE_API_BASE_URL` defaults same-origin. Supabase public URL/key config only when client SDK requires it. |
| `secureLLM.js` | Frontend calls Base44 InvokeLLM directly after feature check. | Remove direct provider invocation; send task to IFund server AI adapter. The backend performs auth, quota, feature, prompt-injection and output validation. |
| `useFeatureEnabled.js`, `useFundraisingMode.js` | Feature availability is fetched through Base44 functions. | IFund public feature snapshot endpoint; protected mutations still enforce flags server-side. |
| `campaignSharing.js`, `legalPolicy.js`, `integrationRegistryUi.js` | Additional source-path wording. | Update references to IFund-owned API/schema modules; no historical source path should be presented as active runtime authority. |

**Library results:** 56/56 files inspected; 18 contain direct Base44 SDK/runtime/config references or explicit Base44 wording. The remaining 38 are provider-neutral utilities or other integrations (Firebase, Reown, browser haptics, local security/prompt logic, fee arithmetic, routing, and UI state) and should be retained unchanged unless a separate capability migration requires edits.

**Notable security rule:** no client code should call a metered LLM/image provider or hold any provider secret. Current `secureLLM.js` and `ifundImageBranding.js` violate the desired independent service boundary because they invoke Base44 Core APIs from the browser. Move those calls to Cloudflare Worker endpoints before the old SDK is removed.


### Frontend page audit — `src/pages/` complete (57/57)

All **57/57** page files were fetched and inspected in full. 52 contain direct Base44 SDK/auth/entity/function references or Base44-specific copy; five pages (About, Communications, Connect, Privacy, Terms) are provider-neutral.

#### Page families and replacement requirements

| Page family | Source dependencies | Destination |
|---|---|---|
| Account lifecycle: Login, Register, ForgotPassword, ResetPassword, Profile, Onboarding | Base44 Auth register/OTP/verify/reset/update/logout, token setter, user profile fields. | Supabase Auth password/email verification/recovery, profile row and OAuth. Use secure password recovery codes/links and preserve user ID mapping during migration. |
| Campaigns: CreateCampaign, CampaignDetail, EmbedCampaign, Discover, GlobalGlobe, Dashboard, FollowedCampaigns | Direct Campaign/Update/FollowedCampaign CRUD, campaign draft/import/geocode/generate/save/publish event. | IFund campaign API + Supabase RLS/transactional save, draft state and campaign public read routes. Preserve campaign IDs/URLs where feasible. |
| Donations/finance: Donors, MyGiving, FinancialLedger, Withdrawals, Subscriptions | Server functions for verified donor directory, ledger, payout balance, PayPal subscription checkout/confirmation/cancellation, admin payout approval. Direct Withdrawal and Campaign reads. | Worker financial API backed by canonical Supabase ledger/RPCs; PayPal-only checkout/payout. Preserve seven-day clearing, daily limits, 3% withdrawal fee and exact payout reconciliation. |
| Community/social: Community, CommunityDetail, Social, BlogArticle, Blogs, MyBlog, PublicProfile, PublicationArticle | Base44 entity CRUD and functions for community, posts, blogs, profiles, public publications, follow graph. | Supabase content tables with owner/public visibility RLS; Worker endpoints for composite operations and approved publishing. |
| Connections/integrations: Connections, ExternalAccounts, IntegrationsAdmin, Connect, ConnectedDevices, DeviceActivation, AdminAgentApi, OAuthConsent | Base44 app-user OAuth token, shared connectors, device authorization, integration registry, admin API keys and MCP consent. | IFund OAuth service, provider registry, device code grant, encrypted credential store, server-side admin routes and independent MCP consent endpoint. |
| Admin/operations: OpsCenter, Platform, Analytics, AuditLogAdmin, SustainabilityAdmin, AdminFoundingWaitlist, HelpAdmin | Direct privileged entity reads/writes plus admin-only backend functions; some pages assume Base44-native "live data". | Worker validates super-admin identity for every action; RLS protects records; audit logs append-only. Remove client-side direct privileged entity reads. |
| Help/support: Help, HelpArticle, HelpAdmin, Contact | Base44 HelpArticle/HelpFeedback/HelpDraft, support ticket and email function. | Supabase Help tables + Worker ticket/email routes. Public contact form uses neutral mail adapter and anti-abuse controls. |

#### Page-specific hard dependencies and wording

- `Login.jsx:41` Android password login is hardcoded to `https://interplanetaryfund.base44.app/api/apps/<app-id>/auth/login`; remove this domain and app-ID dependency and use the independent API/Supabase Auth path.
- `IntegrationsAdmin.jsx` embeds `Base44ReleaseStatus`; replace with Cloudflare deployment/commit verification and Supabase migration status.
- `Notifications.jsx:151` says "Your existing IFund account stays on Base44. Firebase never becomes your login provider." Firebase should remain separate push infrastructure; change account authority to Supabase Auth.
- `OpsCenter.jsx:14–15,139` describes Base44-native operational data; replace with IFund-owned data and report unavailable rather than synthesizing agent/treasury status.
- `OAuthConsent.jsx:8` references `base44/mcp/config.json`; the route should be owned by IFund MCP/OAuth server.
- `Home.jsx:15` and the logo/hero components use Base44 media CDN. Move assets to R2/static host before old media URL retirement.
- `AdminAgentApi.jsx` manages OAuth clients and external agent keys through Base44 functions; keep these super-admin-only and store client secrets only server-side.
- `Connections.jsx` has user-click-only external sync and strict owner/provider verification. Preserve this; do not replace it with automatic background sync on page load.
- `Subscriptions.jsx` includes PayPal subscription plan verification, webhook setup and activation. These are active PayPal capabilities; replace their runtime and storage, but keep PayPal. The Stripe UI is separate and should be retired.
- `Withdrawals.jsx` reads owner balance/withdrawal data and exposes admin approvals. All amounts must come from the server ledger, not direct client aggregation.
- `Analytics.jsx` fetches multiple entities and then N+1 donation/volunteer reads. The replacement should provide a bounded aggregate endpoint to avoid many requests and prevent client-side cross-owner scans.
- `HelpAdmin.jsx` directly creates/updates HelpDraft and HelpArticle records; replace with explicit admin Worker routes and audit each publication.
- `Profile.jsx` updates `photo_url` via Base44 auth profile; use signed R2 upload + profile update through Supabase.
- `DeviceActivation.jsx` and `ConnectedDevices.jsx` depend on Base44 device authorization; port as an independent device-code grant flow with hashed codes, short expiry, polling interval and owner/admin approval.
- `SustainabilityAdmin.jsx` writes audit records from the client; move writes server-side and preserve source evidence.
- `FoundingMembers.jsx` and `AdminFoundingWaitlist.jsx` rely on Base44 waitlist table; port with unique normalized email, explicit marketing consent and admin-only review.

**Page audit status:** 57/57 files inspected. The page layer is not yet migrated; the independent app currently has only the replacement scaffold and API contract. This remains a substantial feature-parity workstream.


### Frontend page traversal — all 57/57 page modules reviewed

All **57/57** files under `src/pages/` have now been fetched and inspected. This includes page modules with no Base44 text (such as About, Communications, Connect, Privacy and Terms), not just search hits. The 52 page modules with Base44 references or runtime calls are recorded below as functional migration groups; the other five are content/UI-only and do not require provider substitution based on this review.

| Page group | Files | Required independent replacement |
|---|---|---|
| Authentication/account | `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `Profile.jsx`, `Onboarding.jsx`, `Platform.jsx` | Supabase email/password, email OTP confirmation, recovery code/email reset, profile row updates and explicit consent RPC. Login must not post to `interplanetaryfund.base44.app` or set a Base44 token. |
| Campaign creation/management | `CreateCampaign.jsx`, `CampaignDetail.jsx`, `Dashboard.jsx`, `Discover.jsx`, `EmbedCampaign.jsx`, `GlobalGlobe.jsx`, `FollowedCampaigns.jsx` | IFund campaign API + Supabase tables/RPC. Preserve draft, publish, campaign import, geocoding, image upload, follow/pin/archive/view state and public read/embed behavior. |
| Campaign financial views | `Analytics.jsx`, `Donors.jsx`, `FinancialLedger.jsx`, `MyGiving.jsx`, `Withdrawals.jsx` | Server-owned financial queries. Do not expose full ledger or donor PII to client; maintain PayPal-only settlement and withdrawal rules. |
| Community/social | `Community.jsx`, `CommunityDetail.jsx`, `Social.jsx`, `Connections.jsx`, `ExternalAccounts.jsx`, `PublicProfile.jsx`, `FoundingMembers.jsx` | IFund APIs for membership, profiles, OAuth connections, content and explicit user-initiated external sync. No browser-side entity access or automatic publishing. |
| Admin/operations | `AdminAgentApi.jsx`, `AdminFoundingWaitlist.jsx`, `AuditLogAdmin.jsx`, `IntegrationsAdmin.jsx`, `OpsCenter.jsx`, `SustainabilityAdmin.jsx`, `HelpAdmin.jsx` | IFund super-admin gateway; Supabase audit/feature/integration tables; Cloudflare release status. Remove Base44 release widget and Base44-native operational claims. Every admin mutation rechecks owner authorization server-side. |
| Help/content/inbox | `Help.jsx`, `HelpArticle.jsx`, `HelpAdmin.jsx`, `BlogArticle.jsx`, `Blogs.jsx`, `MyBlog.jsx`, `PublicationArticle.jsx`, `Inbox.jsx`, `Notifications.jsx` | IFund Help/Blog/Publication APIs, user-scoped inbox/notifications and RLS-safe realtime. Keep verification mailbox separate from user inbox. |
| Agent/mission | `Agents.jsx`, `MissionControlPage.jsx`, `AIImageStudio.jsx` | IFund-owned agent runtime and server AI/media routes; no Base44 agents or Core LLM/image calls. |
| Connections/devices | `ConnectedDevices.jsx`, `DeviceActivation.jsx`, `Connections.jsx`, `ExternalAccounts.jsx` | IFund Worker device-authorization and OAuth endpoints. Preserve short-lived user codes, single-use approval, device revocation, provider verification and consent scope. |
| Institution/volunteer | `InstitutionDetail.jsx`, `Institutions.jsx`, `SustainabilityAdmin.jsx` | IFund institution/application/volunteer APIs and transactional counters; keep grant awards pending until verified receipt. |
| Legal/contact | `Contact.jsx`, `OAuthConsent.jsx`, `Onboarding.jsx` | IFund public-contact endpoint, IFund-owned OAuth/MCP consent route and immutable legal assent. `OAuthConsent.jsx` references a retired Base44 MCP config path and Base44 auth comment; replace with an independent server-side authorization contract. |

#### Specific frontend defects and exact corrections

- `Login.jsx:39–41`: Android native login calls `https://interplanetaryfund.base44.app` and `/api/apps/<app-id>/auth/login`. Replace with the deployed IFund auth/API route or Supabase Auth native flow; only configure the endpoint after live route verification.
- `Notifications.jsx:151`: text says "Your existing IFund account stays on Base44." This is directly contradictory to the migration; update to explain Supabase authentication and explicitly state Firebase is only push delivery.
- `IntegrationsAdmin.jsx:10,210`: imports and renders `Base44ReleaseStatus`. Replace with IFund Cloudflare/GitHub deployment status; remove the component after its replacement is tested.
- `OpsCenter.jsx:14–15,139`: labels the view Base44-native and Base44 live data. Replace with "IFund operations" only once the Supabase/Worker API is actually the live source; do not relabel while it still reads Base44 entities.
- `OAuthConsent.jsx:8,48`: references `base44/mcp/config.json` and `base44.auth.isAuthenticated()`; use server-issued OAuth authorization context, PKCE/state validation and Supabase identity.
- `Home.jsx:15`: hard-coded hero image at `media.base44.com`; migrate approved asset to R2/static asset bucket and validate image hash/dimensions before changing URL.
- `CreateCampaign.jsx:120–123`, `AIImageStudio.jsx:29–32`: generated campaign cover is invoked through Base44 Core and uploaded via Base44 media. Port generation and storage separately to IFund AI adapter + R2.
- `Connections.jsx:152–155`: calls all Wix sync endpoints together. The replacement must preserve explicit user/admin initiation, per-provider scope and idempotency; don't turn these into scheduled auto-sync.
- `Subscriptions.jsx:114–144`: owner setup flow calls PayPal plan verification, webhook registration, checkout activation and catalog sync. Replace Base44 callback URL registration with IFund Worker callback only after the endpoint is deployed and signature-tested. This is a setup workflow, not permission to modify the PayPal ledger.
- `Withdrawals.jsx`: current client reads campaign/withdrawal entities and invokes approval action. The independent endpoint must enforce owner/super-admin authorization and 3% withdrawal-only platform fee, with PayPal settlement and immutable ledger.
- `Notifications.jsx:104`: Base44 `updateMany` is used to mark notifications read. Replace with a user-scoped bulk update RPC; never accept arbitrary user IDs from the browser.
- `Analytics.jsx`: client fetches multiple entity collections and fans out one donations request per campaign. Replace with a bounded aggregate API to avoid N+1 calls and avoid disclosing unrelated users' data.
- `FollowedCampaigns.jsx`: user-owned pin/archive/view/delete state is mutated directly through Base44 entities. Replace with RLS-protected Supabase operations or authenticated Worker endpoints.

**Frontend source traversal status:** `src/lib/` 56/56 and `src/pages/` 57/57 complete. `src/` has 367 files total; component review remains in progress (243 component files), plus five hooks and root entry/style files already checked for Base44 hits. The full app is not yet Base44-free and PR #208 remains an audit/adapter increment, not a completed migration.


### Frontend component traversal — all 243/243 component modules reviewed

All **243/243** files under `src/components/` have now been fetched and inspected, including all 51 shared UI primitives. The remaining UI primitives are generic Radix/shadcn-style components and contain no Base44 runtime dependency. The component audit surfaced these additional dependencies:

| Component area | Files / findings | Destination contract |
|---|---|---|
| Root/auth/navigation | `NotificationBell.jsx`, `QuickActions.jsx`, `TermsAcceptance.jsx` | Supabase auth + notification read API + Supabase Realtime subscription; explicit legal-acceptance endpoint. |
| Account | `AccountManagement.jsx`, `CountMyMoney.jsx` | User-owned export/deletion/preferences APIs; external sync remains explicit user request; deletion must honor ledger/legal retention. |
| Admin | `ActionQueuePanel.jsx`, `AdminApprovalQueue.jsx`, `AdminConnectionAssistant.jsx`, `Base44ReleaseStatus.jsx`, `IntegrationDetailPanel.jsx`, `OwnerConnectorRoutePanel.jsx`, `PayPalReceiptRecoveryPanel.jsx` | IFund admin API. Approval queue actions (including publishing) need auditable owner approval. PayPal receipt recovery must preserve transaction idempotency and ledger authority. Retire Base44 release widget. |
| Agents | `AdminDevelopmentChat.jsx`, `AgentChat.jsx`, `AgentContentReview.jsx`, `AgentMonitor.jsx`, `BuilderExecutionControls.jsx`, `ChatGPTBuilderHandoff.jsx`, `PlatformFixReviewPanel.jsx` | IFund agent registry/run store and GitHub/Cloudflare build pipeline. AgentChat depends on Base44 agent conversation create/subscribe/get/addMessage. Builder controls submit to the real Base44 builder and must be replaced, not cosmetically relabeled. |
| Analytics | `ReportsPanel.jsx` | IFund executive report API and report-generation job; report data provenance must be explicit. |
| Brand/media | `BrandHero.jsx`, `BrandLogo.jsx`, `MediaUpload.jsx`, `ui/image.jsx` | Copy verified brand assets to R2; upload new files through signed R2 URLs. In `ui/image.jsx:13,170`, the Wix transform host allowlist incorrectly includes `media.base44.com`; retain Wix transformation only for `static.wixstatic.com` and other verified Wix hosts. |
| Campaigns | `CampaignTranslation.jsx`, `CashAppSettings.jsx`, `CrossPlatformTotals.jsx`, `CryptoCampaignSettings.jsx`, `DeleteCampaignButton.jsx`, `DonateDialog.jsx`, `EditAIInstructionsDialog.jsx`, `EditCampaignDetailsDialog.jsx`, `FeaturedCarousel.jsx`, `FollowButton.jsx`, `FollowPrefsDialog.jsx`, `ImportedCampaignSync.jsx`, `OutreachAgentPanel.jsx`, `SuccessStories.jsx`, `UpdatesSection.jsx` | IFund campaign/translation/follow APIs; preserve server-side ownership, donation and payout boundaries, stable import request IDs and draft/publish lifecycle. |
| Coach/comms | `CoachMarks.jsx`, `CommPreferences.jsx`, `ComposeMessage.jsx`, `MessageHistory.jsx` | Supabase profile preferences and scoped communications API. Message recipients, templates, and consent must be enforced server-side. |
| Community | `ActivityFeed.jsx`, `CreateCommunityDialog.jsx`, `DiscussionsTab.jsx`, `PostCard.jsx`, `VolunteerTab.jsx` | IFund community feed/cursor API, transactional membership and volunteer operations. |
| Connections | `AIConsentCard.jsx`, `AdminOAuthProviderReadiness.jsx`, `AgentWorkPanel.jsx`, `ConnectDialog.jsx`, `ConnectionCard.jsx`, `PasswordVaultPanel.jsx`, `PublishFromConnections.jsx`, `SyncRunHistory.jsx` | Independent OAuth authorization and encrypted token vault. The UI currently asks users to register app-user OAuth connectors in Base44 workspace settings and calls `base44.connectors.connectAppUser`; replace with IFund OAuth start/callback routes and PKCE/state. Keep secrets out of browser storage. |
| Dashboard/devices/distribution/giving | `FollowFeed.jsx`, `MissionControl.jsx`, `TreasurySnapshotCard.jsx`, `DevicePairingSelfTest.jsx`, `DistributedPostCard.jsx`, `DistributionPanel.jsx`, `JustGivingStagingPilot.jsx`, `RecurringPlanCard.jsx` | IFund aggregate APIs, explicit Wix sync, user-confirmed publish, safe device code flow, PayPal recurring donation API. Keep JustGiving staging-only and never promote staging to live implicitly. |
| Inbox/institutions | `VerificationInboxPanel.jsx`, `ApplicationsTab.jsx`, `ApplyDialog.jsx`, `CreateInstitutionDialog.jsx`, `MyApplications.jsx`, `OpportunitiesTab.jsx`, `PublishOpportunityForm.jsx` | Server-isolated verification mailbox; transactional institution/application and grant decision APIs. |
| Mission/onboarding/ops | `AutomationPanel.jsx`, `OpportunitiesPanel.jsx`, `RecommendationsPanel.jsx`, `ConnectStep.jsx`, `FundMigrationDashboard.jsx`, `PendingDonationReview.jsx` | IFund agent state and feature/payments APIs. External funds are observations only until matched to actual PayPal receipt; pending donation review must not allow client-side verification. |
| Payments/platform | `ApplePayButton.jsx`, `GooglePayButton.jsx`, `PayPalCheckoutButton.jsx`, `BlueprintPanel.jsx`, `FeatureFlagsPanel.jsx`, `FraudControlPanel.jsx`, `KnowledgePanel.jsx`, `LiveProvidersPanel.jsx`, `ServiceHealthPanel.jsx`, `StripeIntegrationPanel.jsx`, `TimelinePanel.jsx`, `UserManagementPanel.jsx`, `logPlatformEvent.js` | PayPal order/authorization/capture Worker routes; Supabase feature flags, event log, audit and admin functions; actual health probes against deployed services. Stripe panel stays retired under PayPal-only policy. |
| Profile/social/withdrawals | `FriendsPanel.jsx`, `PublicProfileEditor.jsx`, `AdminContentPanel.jsx`, `OfficialPublications.jsx`, `PostComposer.jsx`, `ShareToProfileDialog.jsx`, `SocialFeed.jsx`, `CollectAndWithdrawDialog.jsx`, `WithdrawalDialog.jsx` | IFund social APIs, R2 public media, IFund AI adapter and explicitly authorized publish flow. Collect-and-withdraw must preserve prepare → authorize → execute sequence, server-side revalidation and idempotency. |

#### Exact additional wording/config defects

- `AdminDevelopmentChat.jsx:89`: says internal IFund agents run on Base44. Replace only after the independent agent runtime exists.
- `BuilderExecutionControls.jsx:25,44,57,59,81`: explicitly states the real Base44 builder accepted assignments, asks for Base44 credentials/activity and authorizes Base44 release. Retire the component and replace with GitHub PR review + verified CI + separate Cloudflare production approval.
- `ChatGPTBuilderHandoff.jsx:102`: instructs ChatGPT to use connected Base44 tools. Replace with repository-scoped GitHub/Cloudflare instructions and current branch/PR handoff.
- `IntegrationDetailPanel.jsx:77`: says validation/publication use Base44 directly. Replace with independent IFund route and provider verification language after implementation.
- `AdminOAuthProviderReadiness.jsx:7,58`: requires Base44 workspace OAuth connector registration and a Base44 secret. Replace with independent OAuth client records, callback URLs and server-side encrypted secrets.
- `ConnectDialog.jsx:152,155`: popup flow explicitly uses Base44 connector callback. Replace with IFund OAuth redirect route, state nonce and PKCE verifier.
- `JustGivingStagingPilot.jsx:56`: asks operators to store staging AppID in Base44 environment. Replace with a staging-only Cloudflare secret binding; preserve the no-live-creation constraint.
- `BlueprintPanel.jsx` and `blueprint.js`: platform architecture states "Managed by Base44" and lists Base44 managed infrastructure as a dependency. Rewrite as IFund-managed Supabase/Cloudflare/GitHub components only when each is actually deployed.
- `ServiceHealthPanel.jsx:9–16,67`: measures availability by querying Base44 entities and labels infrastructure managed by Base44. Replace with live HTTP/SQL/queue/worker probes; don't show green based only on successful database list calls.
- `StripeIntegrationPanel.jsx`: provides Stripe audit and webhook repair actions; hide/retire it and keep legacy records read-only.
- `subscriptions/plans.js`: imports `../../../base44/shared/subscriptionCatalog.js`. This is a source-tree-relative import and will break when Base44 code is removed. Move the neutral catalog to `src/lib` or a shared package with tests; ensure current PayPal price/tier rules remain authoritative.
- `PendingDonationReview.jsx`: queries `payment_verified:false` donations and calls withdrawal clear. This is a high-risk path: only verified PayPal evidence and explicit admin action may change a pending state; a browser-provided status is never sufficient.
- `DistributionPanel.jsx` and `PostComposer.jsx`: Base44 Core InvokeLLM/UploadFile and publish operations currently share one UI. Separate AI draft generation, media upload, post approval and external publishing into distinct IFund endpoints.
- `ApplePayButton.jsx` and `GooglePayButton.jsx`: these buttons currently use PayPal order creation/capture. Retain only if the payment UI and actual provider capability are truthful; do not imply Apple Pay/Google Pay wallet rails unless provider confirms support.

**Component source traversal status:** 243/243 component files inspected. Together with 56/56 library files and 57/57 page files, the entire `src/` tree (367/367 files) has now been reviewed for Base44 dependencies. Root hooks and entry/style files were also checked. This is a source audit, not a complete migration: the frontend still contains numerous direct Base44 calls and Base44-specific UI/config paths.


### Source root/configuration traversal — 23/23 top-level files reviewed

All 23 root-level files in the source repository were fetched and reviewed, including the full 15,758-line `package-lock.json`, `package.json`, `vite.config.js`, `wrangler.toml`, `AGENTS.md` and `BUILD_AGENT_RULES.md`.

| File | Finding | Destination action |
|---|---|---|
| `AGENTS.md` | Current source instructions explicitly call this a Base44-hosted application, declare Base44 authoritative, and impose a "portability freeze" that prohibits removing the working Base44 path until an owner-approved verified cutover. It also says completion is a reversible alternate path, not Base44 deletion. | Do not change the read-only source. In the independent destination, follow the approved Supabase/Cloudflare migration plan. Keep the source running until the destination is proven and cutover is approved; the user's migration request does not authorize destroying the source. |
| `BUILD_AGENT_RULES.md` | Describes Base44 as the authoritative product target and requires Base44 build/publish verification. | Retain as historical source instructions. Destination instructions must refer to IFund/GitHub/Cloudflare and must not inherit Base44-only builder requirements. |
| `README.md` | Clearly labels this repository as original Base44 implementation / legacy reference, but retains Base44 CLI, URL, app ID, build and publish instructions. | Keep as historical operating guide for the source only. Destination README must not copy these as production instructions. |
| `package.json` | Package name remains `base44-app`; active scripts include `verify:base44-sync` and `verify:base44-release`; dependencies include `@base44/sdk` and `@base44/vite-plugin`. | Destination package name becomes `interplanetary-fund` (or another approved neutral package name); remove Base44 scripts and dependencies only after all app imports, build plugins and tests are migrated. |
| `package-lock.json` | Lockfile mirrors Base44 package name and contains SDK/plugin packages. | Regenerate with `npm install` after package.json migration; do not hand-edit the lockfile. |
| `vite.config.js` | Imports and executes `@base44/vite-plugin`; enables legacy SDK import rewriting; still applies production hardening. | Remove plugin from destination; retain production security/build hardening, alias and React plugin; ensure no `@/entities`, `@/integrations` legacy rewrites are needed. |
| `wrangler.toml` | Cloudflare Worker already exists, but contains `IFUND_BASE44_ORIGIN` and includes Base44 app URL in `IFUND_ALLOWED_ORIGINS`. | Replace with neutral legacy-origin variable only if a controlled migration proxy is actually required; remove Base44 from allowed origins after the old app is no longer an approved cross-origin caller. Never use this variable to proxy around provider restrictions. |
| `.gitignore` | Ignores `base44/.app.jsonc`; this is generated/private Base44 project metadata. | Destination ignore rules should not carry the Base44-specific generated config path unless retaining the source tree. |
| `capacitor.config.json`, `google-services.json` | Capacitor Android app identity and Firebase push project config; no Base44-specific entry in these files. | Retain Android app identity and Firebase push setup; decouple login/API endpoint separately. Treat Firebase as push delivery, not identity authority. |
| `index.html`, `components.json`, `eslint.config.js`, `jsconfig.json`, `postcss.config.js`, `tailwind.config.js`, `requirements.txt`, `.npmrc`, `.node-version`, `.nvmrc`, `LICENSE`, `CLAUDE.md` | No direct Base44 runtime references were found in these files. | Retain unless another migration requirement is independently established. |

**Source instruction reconciliation:** source `AGENTS.md` is not an authorization to leave Base44 as the permanent production host; it is a safeguard against premature deletion during a reversible cutover. The independent destination branch should continue to implement the alternate path without mutating the source. A final cutover should be a separate explicit production operation after data, auth, financial, integrations, agents, workflows, media, mobile and rollback gates pass.

**Source root status:** 23/23 root files reviewed. The source recursive tree has 1,249 tracked files total: 367 `src/`, 373 `base44/`, 182 `scripts/`, 85 `docs/`, 74 `host/`, 55 `android/`, 50 `public/`, 26 `.agents/`, 9 `.github/`, 23 root files, 2 `tools/`, 1 `.ci/`, 1 `audits/`, and 1 `supabase/` migration. The next remaining source audit targets are the 17 workflow definitions, 11 connectors, 10 agent definitions, 95 entity schemas (already inventoried), then host/scripts/docs/public/android and the rest of the root-level build artifacts.


### Agent, connector and workflow configuration audit

#### Agents — 10/10 definitions reviewed

The ten JSONC agent definitions are Base44-native registry entries, not standalone prompts. They bind agent names to Base44 entities and function tools, and their execution model depends on Base44 conversations, backend invocation, and service-role access.

- `admin_builder_agent.jsonc`: calls `manageAdminBuilderWork` and `managePlatformIncidents`; the latter dispatches a real Base44 builder REST task when separately authorized and metered credits are enabled. Replace with IFund GitHub PR/CI/Cloudflare release orchestration; no Base44 builder API or credits.
- `chief_of_staff.jsonc`: delegates via `routeAgentTask`, reads owner context and saved drafts, uses Base44 agent conversation routing. Preserve specialist routing, user scope, consent, approval and verification receipts; replace runtime with IFund registry + durable run store.
- `communications_agent.jsonc`, `finance_agent.jsonc`, `growth_agent.jsonc`, `outreach_agent.jsonc`, `story_agent.jsonc`, `strategy_agent.jsonc`: specialist prompt/tool definitions reference Base44 entities/functions and the Base44 agent runtime. Port prompts only after each named tool has a verified IFund equivalent; don't treat copied prompt text as a functioning agent.
- `connection_discovery_agent.jsonc`, `managed_connection_agent.jsonc`: provider discovery, OAuth setup and delegated connection repair. Keep separate from the ordinary specialist agent runtime; provider scopes and authorization must be verified against each platform. No user-facing request may expose Base44 workspace setup.
- The existing agent policy repeatedly says "AI recommends, human approves", protects credentials, and distinguishes queued work from verified completion. Preserve these as server-enforced rules, not just prompt instructions.

**Replacement:** a versioned IFund agent registry (Supabase) with explicit agent ID, prompt version, allowed tools, data scope, consent requirements, run quota, model/provider policy and human-approval policy. Durable execution uses Cloudflare Queues/Workflows plus Supabase run/conversation records. Tool authorization is enforced by the Worker on every call. Never expose secret values to model context. A prompt/JSONC port alone is not an agent migration.

#### Connectors — 11/11 definitions reviewed

These files are minimal provider type + OAuth scope declarations; they are not live client registrations or proof of an enabled provider connection.

| Connector | Declared scopes / review |
|---|---|
| Discord | identity, guilds, member reads, messages read, email; verify whether each scope is needed for the requested Discord capability. |
| Facebook Pages | page list, engagement read, manage posts; preserve separate Page/Business account permissions. |
| GitHub | `repo`, `workflow`, `read:org`, `read:user`, `user:email`; very broad. Split read-only status/repository access from workflow/write scopes and use GitHub App installation permissions where possible. |
| Google Workspace | identity, Drive file, Gmail send, Calendar events, Docs, Sheets; separate each product capability and request only the scopes used. |
| Gumroad | profile, sales, edit products; product edit is a consequential permission and should not be bundled with read-only account linking. |
| Instagram | business basic, content publish, comments, messages, insights; keep publishing/message scopes separately consented and verify Meta app review/capability availability. |
| LinkedIn | OpenID/profile/email and member social publishing; verify approved product tier and user/org role before enabling publish. |
| OneDrive | user read, files read/write, offline access; split read/write and use the minimum file scopes. |
| Slack | chat write, channel read, mentions read, custom/public posting; avoid broad channel access when a single destination is selected. |
| Wix | offline access; preserve Wix as a separate optional integration, not an identity or hosting dependency. |
| WordPress.com | global scope; overly broad for least privilege. Request narrower scopes if provider supports them, otherwise keep the integration disabled until explicit review. |

**Replacement:** each provider receives an IFund-owned OAuth client registration and callback route, PKCE/state validation, encrypted server-side refresh-token storage, provider-specific scope mapping, revocation and capability probes. Supabase Auth handles IFund user identity; it does not replace provider OAuth. Do not copy Base44 connector IDs or Base44 app-user token records as if they were provider tokens.

#### Workflows — 17/17 definitions reviewed

All 17 JSONC workflows use Base44 workflow DSL namespace, Base44 scheduler/entity triggers, and `invoke_backend_function` calls. These are executable behavior, not documentation. The destination requires an explicit workflow registry and a real scheduler/queue runtime.

| Workflow | Existing behavior | Migration treatment |
|---|---|---|
| AI Outreach Agent | Every 6 hours; autonomous outreach for opted-in campaigns. | Keep disabled until IFund schedule, quota, active entitlement, consent, review queue and idempotency are verified. |
| Admin Action Conversation Router | Every 15 minutes; routes admin questions to agent threads. | IFund durable queue; owner-only, bounded polling and same-thread audit. |
| Campaign Protocol | Entity create/update trigger validates required fields and outreach defaults. | Supabase transaction/RPC or database trigger; never let a background workflow silently override explicit user choices. |
| Campaign Sync on Create | Campaign creation invokes connection sync. | Remove automatic external sync; create a local pending-distribution state only. |
| Campaign Sync on Update | Campaign update invokes connection sync. | Remove automatic external sync; publish/sync only on explicit user request or an independently consented, verified action. |
| Connection Sync Engine | Hourly publishes due posts, retries failures, monitors connection health. | Split read-only health probes from publishing. External sync is request-only under the current product rule; no background publish/retry without explicit scoped authorization. |
| External Feed Mirroring | Hourly pulls connected social posts into IFund feed. | Keep disabled until explicitly approved; external account sync must be request-only. |
| Feature Discovery on Completion | On campaign completion, recommends unused features. | Optional low-cost event-triggered job; idempotent, user-scoped, no external calls. |
| Grant Application Review | AI analyzes new grant applications and recommends; human decides. | Port with privacy controls, evidence/provenance, human decision boundary and transactional award state. |
| IFund Official Social Editor | Every four hours prepares official branded posts. | Draft-only queue; no external publish without explicit admin approval and provider receipt. |
| IFund Reporter Daily Diary | Daily publishes a factual IFund Reporter blog issue. | Draft/review workflow first; public publishing requires source verification and explicit approved policy. |
| Integration Health Check | Every six hours runs non-destructive provider checks. | May become a bounded low-cost Worker Cron after verified provider adapters exist; no sync/write side effects. |
| PayPal Holding Settlement Reconciliation | Hourly discovers PayPal receipts and uniquely matches external-fund observations. | Preserve as a guarded financial reconciliation job only after PayPal webhooks/transactions and ledger are ported; no speculative allocation. |
| Platform Account Steward | Daily checks official accounts and queues setup/weekly post work. | Read-only health + admin review queue; no automatic external account creation or posting. |
| Social Media Autopilot | Daily generates/stages posts, may schedule/publish for auto connections. | Disable during migration. Current external sync/publishing policy is request-only; any future automation needs explicit opt-in, destination scope, limits and revocation. |
| Volunteer Welcome Follow-up | Signup event sends welcome, waits 3 days, sends follow-up. | IFund durable delayed job with email consent, idempotency, cancellation on opt-out and delivery receipts. |
| Weekly Writing Psychology & Social Trends Training | Weekly research/LLM workflow with deduplication. | Optional IFund research job only with a configured provider, strict cost cap, source provenance and deduplication; no Base44 metered LLM dependency. |

**Critical scheduling rule:** moving a Base44 cron to Cloudflare Cron does not authorize running it. Preserve schedules only after behavior, consent, cost and data contracts are verified. In particular, do not enable Campaign Sync on Create/Update, hourly Connection Sync, External Feed Mirroring or Social Media Autopilot as a default migration side effect.

#### Remaining Base44 config/runtime files

- `base44/config.jsonc`: Base44 app/build configuration; source-only. Destination uses Vite/Cloudflare configuration and explicit route contracts.
- `base44/lib/browserCapabilities.ts`: inspect/port only capability detection that remains needed; browser capability checks do not authorize a browser automation action.
- `base44/lib/platformConnectionRecipes.ts`: provider-neutral connection method catalogue; retain content but move into IFund-owned registry and verify current provider methods.
- `base44/mcp/config.json`: Base44-hosted MCP server/tool exposure. Replace with an IFund-owned MCP endpoint, Supabase JWT validation, PKCE/OAuth scope, owner-only tool gates, and explicit user approval for consequential actions. Do not copy Base44 app identifiers or credentials.

**Base44 configuration status:** 10/10 agent definitions, 11/11 connector declarations and 17/17 workflows reviewed. These represent 38 files plus the config/runtime files above. All are still source-side definitions; none has been migrated to the destination merely by being documented.


### Existing Cloudflare host layer — reviewed; not yet independent production runtime

The source already contains Cloudflare Worker projects under `host/`. This is useful migration scaffolding, but it must not be mistaken for a completed Base44 replacement.

| Host component | Current observed behavior | Required next step |
|---|---|---|
| `host/gateway/worker.js` (479 lines) | Has health/readiness, campaign-assistant, migration auth/session, migration campaigns, admin-agent, agent-content and MCP routes. Still proxies `/api/mcp` and OAuth discovery to `https://interplanetaryfund.base44.app`; uses Base44 auth/campaign authority for admin/agent context; readiness reports blockers `base44_mcp_proxy`, `base44_auth_authority`, `base44_campaign_authority`. | Replace every remaining Base44 authority/proxy path with Supabase JWT validation, IFund RLS/RPC and IFund-owned MCP route. Preserve fail-closed behavior when the destination is not ready. |
| `host/gateway/campaign-assistant.js` (110 lines) | Calls `https://base44.app/api/apps/${APP_ID}`; auth and feature configuration explicitly remain Base44 reads. | Move feature/auth and campaign context to Supabase/IFund Worker. No Base44 upstream fallback. |
| `host/email/worker.js` (91 lines) | Has inbound email routing; comments say the Base44 inbox mirror is authenticated/tested, but explicitly avoids forwarding mail to Gmail/Base44 InboxItem/internal notifications in one path. | Inspect actual routing and provider contract; make IFund inbox storage independent and ensure private verification mail remains isolated. |
| `host/oauth/worker.js` (144 lines) | Independent OAuth worker exists as a separate component. | Verify state/PKCE, token exchange, callback origin, persistence, refresh/revocation and provider scope before connecting UI. Its presence alone does not prove the user-facing connection flow is live. |
| `host/workflows/worker.js` (14 lines) | Health/catalog only; explicitly `ready:false`, `execution:"disabled"`; workflow execution endpoint returns 503 `workflow_execution_not_ready`. | Runtime is a stub, not a scheduler. Implement only approved workflows after the external-sync/publish consent policy and idempotency gates are encoded. |
| `host/workforce/worker.js` (15 lines) | Health/catalog only; explicitly `ready:false`, `execution:"disabled"`; reason is unverified tool/memory/auth adapters. | Runtime is a stub, not an agent engine. Implement registry, model adapter, tool gateway, run state, quotas, approvals and durable orchestration before agent activation. |
| `host/migration/frontend-dependency-audit.json` | Historical audit generated 2026-10-23; covers 363 source files, 1,038 static call-site matches, 46 referenced entities and 124 referenced functions. Its own scope excludes dynamic invocation, server-side use and production traffic. | Treat as a useful historical index, not current exhaustive proof; compare against current 367-file source audit and update only after the current endpoint contracts are settled. |
| `host/migration/source-inventory.json` | Historical inventory of 95 entities and 184 function directories. Most entries are marked `requires_live_dependency_review` and `unassigned_pending_verification`. | Use as a migration checklist; do not treat unassigned entities as migrated. |
| `host/workflows/manifest.json` and `eligibility.json` | Manifest declares execution disabled. Eligibility audit dated 2026-10-22 marks every workflow HOLD because live enabled state/last execution, independent Worker implementation, idempotency or entity event source/replay cursor are unverified. It identifies the "Campaign Sync on Update" trigger mismatch (named Update but listens to create). | Preserve disabled status until all gates pass. Fix trigger semantics in destination and require a replay-safe event source before enabling. |
| `host/workforce/manifest.json` | Captures source agent/skill file hashes and marks runtime unverified. | Keep as immutable source evidence; build the actual IFund runtime and revalidate prompt/tool hashes before release. |

#### Critical correction to migration status

The Cloudflare Worker directory is not yet a functioning independent replacement for Base44. The gateway still has Base44 upstream routes; the workflow and workforce workers explicitly report disabled execution; and the historical eligibility report marks all workflows HOLD. The previously passing frontend build and API-client tests prove only that the new neutral API client compiles and behaves as tested. They do not prove Supabase auth parity, all 184 endpoint replacements, live financial parity, agent execution, scheduled workflow parity or production cutover.

The destination migration should therefore be delivered in layers:
1. Supabase schema/RLS/auth and financial ledger authority.
2. Worker API routes and typed frontend repositories.
3. OAuth/connection vault and provider capability verification.
4. R2/media migration and public asset parity.
5. Agent runtime + reviewed tool gateway.
6. Workflow scheduler/queues with current request-only sync/publish policy.
7. Mobile/API endpoint cutover and rollback-tested production release.

Do not set any worker `ready:true` or enable any schedule until the underlying runtime and its acceptance tests actually exist.


### Script/test inventory — all 181 script files reviewed

All **181 files** under `scripts/` were fetched and reviewed (182 directory entries include the `fixtures/` folder). The 419-line `scripts/fixtures/ifund-agent-access-baseline.json` was also inspected. The scripts are primarily source-contract tests and migration diagnostics; they are not proof of production execution or provider parity.

#### Scripts that are explicitly Base44-bound and must be retired or rewritten for the independent destination

- `publish-ifund-safe.sh`: calls `base44 whoami` and `base44 site deploy`; it is a Base44 publishing script and must never be used to claim Cloudflare production deployment.
- `publish-ifund-cloudflare.sh`: only supports validation or an explicit Cloudflare preview deploy, but currently requires `VITE_BASE44_APP_ID` and `VITE_BASE44_APP_BASE_URL`. It is not an independent runtime deployment path yet.
- `provision-ifund-verification-email-key.mjs`: provisions `IFUND_VERIFICATION_EMAIL_KEY` into Base44 project secrets via Base44 CLI. Destination must provision a Cloudflare Worker secret or approved secret manager key; never run the Base44 CLI path for destination setup.
- `verify-android-firebase.mjs` and `test-ifund-login-recovery.mjs`: explicitly require Android login to use `interplanetaryfund.base44.app`, Base44 registration and `base44_access_token`. Rewrite to verify Supabase Auth password/OTP/recovery and the independent Worker/API URL. Firebase remains push-only.
- `verify-cloudflare-runtime-contract.mjs`, `test-cloudflare-mcp-proxy.mjs`, `test-ifund-cutover-readiness.mjs`, `verify-live-cloudflare-pathway.mjs`: currently assert Base44 MCP proxy headers, Base44 origin and Base44 auth/campaign blockers. The destination must assert no Base44 upstream, Supabase identity, Worker routes and readiness based on real checks.
- `verify-host-portability-contract.mjs`: currently asserts that alternate hosts send API/auth requests back to the canonical Base44 backend. Replace with the opposite invariant: same-origin IFund API or explicitly configured `VITE_API_BASE_URL`, with no Base44 fallback.
- `test-base44-release.mjs`, `verify-base44-sync-contract.mjs`: test Base44 release markers, Base44 native publication and GitHub sync descriptions. Keep source-only; destination should use GitHub commit/build/Cloudflare release evidence.
- `verify-ifund-skill-migration.mjs`, `verify-agent-runtime-dependencies.mjs`, `verify-agent-conversation-execution.mjs`, `test-managed-agent-runtime.mjs`: read Base44 agent definitions/functions and assert Base44 conversation execution. Port the security invariants, not the runtime-specific assertions.
- `verify-cloudflare-workflows.mjs`, `test-cloudflare-workflows.mjs`, `verify-cloudflare-workforce-stage.mjs`, `test-cloudflare-workforce-bootstrap.mjs`: verify byte-for-byte staging and disabled execution only. These tests correctly confirm the current Workers are not ready; they do not test an operational agent/workflow runtime.
- `test-campaign-assistant-gateway.mjs`, `test-campaign-save-publish.mjs`, `test-campaign-drafts-and-generated-media.mjs`, `test-generate-campaign-cover.mjs`, `verify-server-media-policy.mjs`, `test-ifund-image-style.mjs`: mock Base44 SDK, Base44 image URLs, Base44 Core and Base44 media. Port tests to Supabase/Worker/R2 and test actual R2 URL allowlisting.
- `verify-connection-link-routing.mjs`, `verify-one-link-provider-connections.mjs`, `test-oauth-delegation-flow.mjs`, `verify-admin-provider-readiness.mjs`, `verify-managed-connections-contract.mjs`: currently require `base44.connectors.connectAppUser`. Retain PKCE/state, per-user authorization, scope and provider verification tests; replace the connector handoff with IFund OAuth start/callback.
- `verify-help-center-scaffold.mjs`, `verify-public-legal-help-and-platform-support.mjs`, `verify-terms-liability.mjs`, `verify-audit-log-contract.mjs`, `verify-owner-financial-ledger.mjs`, `verify-donor-directory.mjs`, `verify-live-community-institutions.mjs`: assert Base44 entities/functions. Port the public/private RLS, legal assent, append-only audit and financial boundaries to Supabase tests.
- `verify-wix-campaign-sync-contract.mjs`, `verify-wix-connector-contract.mjs`, `verify-wix-data-sync-contract.mjs`, `verify-wix-webhook-contract.mjs`: Wix integration contracts are provider-specific and should remain, but their storage/credentials must move off Base44. Preserve signed webhook validation and explicit request-only sync.

#### Source tests that should remain as behavioral acceptance tests

- `test-fee-calc.mjs`, `test-financial-integrity.mjs`, `test-paypal-financial-recovery.mjs`, `test-paypal-checkout-recovery.mjs`, `test-paypal-receipt-paging.mjs`, `test-paypal-scanner-classification.mjs`, `test-paypal-wallet-readiness.mjs`, `verify-paypal-business-account-contract.mjs`, `verify-paypal-checkout-contract.mjs`, `verify-owner-paypal-basic-plan.mjs`: preserve gift-first allocation, 10% optional support on top, 3% withdrawal-only platform fee, PayPal idempotency, provider receipt verification and holding-ledger reconciliation. Update only the implementation paths and keep all financial invariants.
- `test-request-triggered-external-sync.mjs`, `verify-request-triggered-external-sync.mjs`, `verify-external-fund-network-contract.mjs`, `verify-external-fund-migration-contract.mjs`: preserve request ID, claim lease, fencing, retry, provenance and no automatic external sync.
- `test-ifund-device-authorization.mjs`, `test-ifund-device-browser-flow.mjs`, `test-ifund-permissions-private-mail.mjs`, `verify-independent-admin-mailbox-client.mjs`, `verify-independent-mailbox-cors-live.mjs`: preserve one-time device codes, no browser secret persistence, private verification mailbox separation, no-store responses and admin authorization.
- `verify-social-publishing-truth.mjs`, `verify-outreach-execution.mjs`, `verify-agent-write-capabilities.mjs`, `verify-agent-chat-resilience.mjs`, `verify-ai-action-status-contract.mjs`, `verify-agent-member-language.mjs`: retain human approval, consent revocation, actual provider receipts, no fake completion, and member-safe language.
- `verify-production-build-output.mjs`, `verify-ifund-browser-render.mjs`, `verify-ifund-studio-pages.mjs`, `verify-route-code-splitting.mjs`, `verify-mobile-layout-contract.mjs`, `verify-text-contrast-contract.mjs`: retain UI, accessibility, bundle and responsive acceptance tests.
- `verify-manual-android-build-contract.mjs`: keep Android builds manual-only; ordinary web source pushes must not trigger APK builds or signing.

#### Test coverage caveat

A large number of tests are static source assertions or mocked handler tests that import `base44/functions` and `base44/shared`. They can pass while the independent Worker remains a stub or while production traffic still reaches Base44. For the destination, these tests must be ported to exercise the real Supabase schema/RLS, Worker routes, R2 uploads, PayPal webhooks, OAuth callbacks, durable queues and actual provider receipts. No test may use real payment capture or production data unless the relevant owner-approved live test protocol explicitly allows it.

**Scripts status:** 181/181 script files reviewed. No source scripts were changed. The source scripts contain a substantial Base44-only release/test framework that must be split into (a) historical source validation, (b) portable behavioral acceptance tests and (c) destination integration/live tests.


### Documentation and runbook traversal — 77 root docs + 14 nested docs reviewed

The source `docs/` tree has been reviewed, including the 71 root-level files and 14 files in `admin/`, `checkpoints/`, `integrations/`, `migration/`, `operations/` and `security/`. These are historical operating records; several are mutually contradictory and must not be treated as a single current policy.

#### Authority conflicts that must be reconciled before destination implementation

1. **Repository authority is reversed in current source documentation.** `REPOSITORY_SOURCE_OF_TRUTH.md`, `ISSUE_1_BACKEND_FEATURE_RECONCILIATION.md`, `FULL_FEATURE_MIGRATION_LEDGER.md`, `ZERO_CREDIT_CONTINUOUS_WORK.md`, `HOST_PORTABILITY_AND_ADMIN_AGENT_CONTRACT.md` and `AGENTS.md` all identify `interplanetary-fund2`/Base44 as the permanent authoritative application and describe `InterplanetaryFund` as historical/reference or deferred. That conflicts with the user's later migration direction and the independent destination repo's issue #137 plan. Preserve these as source provenance; do not let them silently override the active migration target. The source remains read-only.
2. **Financial fee conflict.** `FULL_FEATURE_MIGRATION_LEDGER_CORRECTIONS_2026-09-14.md` says a 7% flat fee on funds raised and calls 3% stale. Later v2 custody terms, current PayPal implementation tests and the current product instructions specify gift-first accounting, optional 10% support added on top, and 3% deducted only at withdrawal. The destination must follow the current approved 3% withdrawal-only rule and must not import the stale 7% rule.
3. **Payment processor conflict.** Older docs such as `STRIPE_PREMIUM_ACCESS_ROLLOUT.md`, `FEATURE_FLAG_INTEGRATION_AUDIT_2026-10-08.md` and `LIVE_FUNDRAISING_MODE.md` describe Stripe premium, donation, subscription and payout paths as potential active capabilities. Later source tests `verify-stripe-integration-no-charge.mjs` and current product policy explicitly retire new Stripe checkout/payout use. Preserve Stripe records only for historical reconciliation; do not port live Stripe execution.
4. **Runtime version conflict.** Documentation variously claims Node 20 only, Node 20+ with Node 22/24, Node 22-only, and a separate Node 24 Android build lane. The migration destination currently targets Node 22 for its primary release path. Reconcile package engine, lockfile, `.node-version`, `.nvmrc`, CI and isolated Android workflow from the destination branch; do not copy one historical document's runtime claim.
5. **External sync/publishing conflict.** Some docs describe hourly/daily sync and autopublishing. `deferred-base44-workflows.md`, `ZERO_CREDIT_CHECKPOINT.md`, the request-triggered sync tests and current product policy state external fundraising sync is request-triggered only. Scheduled external sync, social feed mirroring and autopublishing must remain disabled unless separately and explicitly authorized.
6. **OAuth provider capability conflict.** Connector catalog and historical provider audits list many integrations, but their own contracts distinguish a connector reference from a verified per-user grant and a real provider capability. The destination must preserve provider-specific checks and never show Connected based on configuration presence.
7. **Agent memory/permissions conflict.** Older documents identify Base44 native memory as authoritative and forbid a second memory store. The destination must migrate memory only from an authorized export with identity, retention and deletion controls. Agent training/prompt files are not a memory export and do not grant tools or permissions.

#### Data/cutover evidence still unresolved

- `IFUND_CORE_CUTOVER_RECONCILIATION_2026-10-22.md` records 24 Base44 campaigns versus 22 rows in a private Supabase campaign shadow, with five owner identity-map rows still `awaiting_destination_login`. It also states that staging schema and private import tables are not production authority, and cutover requires destination parity, source freeze and reconciliation.
- `docs/migration/independent-owner-campaigns-rpc.sql` is explicitly source-only staging SQL and must not be applied until destination identities are independently verified.
- `host/email/README.md` says the Cloudflare Email Worker has staged code and encrypted Cloudflare keys but Email Routing was not active because the zone was pending; it also contains a contradictory final instruction to store `IFUND_VERIFICATION_EMAIL_KEY` in Base44 secrets even though earlier steps say the new receiver needs no Base44 secret access. Destination email must use Cloudflare/Supabase secrets only.
- `docs/operations/admin-inbox-completion-plan-2026-10-11.md` reports zero Donation, FinancialOperation, HoldingLedgerEntry, WebhookEvent and Withdrawal rows in the queried source entities at that historical snapshot, while noting this does not prove no external PayPal test payments exist. Treat as a reconciliation warning, not a current balance or proof of zero liabilities.
- Android release docs say the existing APK signing certificate must be preserved for in-place upgrades. The package identity and signing key are not a frontend/API rename task; verify the existing signing identity before building a replacement APK.
- Legal docs explicitly say payment custody, money-transmission status, processor authorization, consumer terms and held-funds handling require legal/provider verification. Do not treat source terms or internal ledger labels as a regulatory determination.

#### Documentation that remains useful after provider replacement

- The IFund agent connection authority contract: actor/subject/provider/action-scoped delegation, owner confirmation, verified capability, secret references only and audited receipts.
- The OBO/AI consent and revocation contracts: one owner-level permission source, per-provider scopes, revocation/version mismatch blocks actions, and no tool authority from model memory.
- The PayPal custody/ledger contract and tests: verified provider settlement, stable operation identity, immutable allocation fingerprint, separate external observations and no client-authoritative totals.
- The device authorization contract: one-time user code, short-lived device token, server approval, no raw code/token in URLs or browser storage.
- The Wix/Instagram/JustGiving runbooks: provider-specific scope and capability verification, explicit owner action, no inferred posting rights, and staging-only JustGiving until production is separately approved.
- The zero-credit and manual Android build rules: no paid action without approval, no APK build on ordinary web changes, and no automatic deployment triggered by unrelated work.

**Documentation audit status:** 71/71 root docs and 14/14 nested docs reviewed. The source docs are retained unchanged. Their stale authority, fee, Stripe, runtime and workflow statements must be reconciled in the independent destination's own canonical docs before the cutover checklist can be marked complete.


### Public assets and Android source — reviewed

- **`public/`: 50/50 files inventoried.** The eight top-level assets/manifests and 42 provider-logo assets were accounted for. `public/ifund-release.json` still declares `"source": "Base44"`; destination release metadata must identify the actual GitHub commit and Cloudflare deployment only after that release is verified. PWA manifest and local logos are host-neutral and should be retained. Provider logo files are static assets, not proof that their integrations are connected or authorized.
- **`android/`: 55/55 files inventoried.** All 28 non-binary source/config/test/build files were fetched and inspected; the remaining 26 files are PNG icon/splash artwork and one Gradle wrapper JAR. Android still uses package/application ID `com.base6a67a778342a8fe05ee79cba.app`, with matching `google-services.json` package. Keep this package identity and signing certificate stable to preserve in-place upgrades; decoupling Base44 auth must not casually rename the Android package or replace its signing key.
- `android/app/src/main/AndroidManifest.xml` disallows backup and cleartext traffic. Crashlytics collection is disabled in the manifest. `IfundDiagnosticsPlugin` is a separate native diagnostics bridge; preserve its explicit consent behavior and do not turn on automatic collection during auth migration.
- `android/app/build.gradle` includes Firebase Crashlytics and Firebase common initialization but not Firebase Auth, Firestore or FCM Messaging in this native Gradle dependency set. Firebase is not the replacement identity provider. Preserve push/diagnostics as separate capabilities only if they remain configured and tested.
- `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` asserts the stock package name `com.getcapacitor.app`, which does not match the actual IFund application ID. Correct or retire this generated test as part of Android release-test repair; do not alter the real package ID to satisfy the fixture.
- `android/app/src/main/java/com/base6a67a778342a8fe05ee79cba/app/` package path is tied to the existing application ID. Retain it unless a separately approved package migration is planned with Play Store/signing continuity.
- The web Login page's Android path still posts to the Base44 `/api/apps/<id>/auth/login` endpoint and stores a Base44 token. A local Capacitor WebView does not automatically make that endpoint same-origin. Replace with a tested Supabase Auth native/web flow and safe callback/session persistence, without putting bearer tokens in deep links or query strings.
- Android build and release remain manual-only under the source policy. No APK/AAB was built, signed, uploaded or published during this audit.

### Source-wide inventory checkpoint

The source repository's top-level inventory has been reconciled: 1,249 tracked files, including 367 frontend files, 373 Base44 runtime/config files, 181 scripts plus one fixture, 85 docs files (71 root files + 14 nested files), 74 host files, 55 Android files, 50 public assets, 26 agent-skill files, 9 GitHub files, 23 root files and 2 tool-package files. The Base44 subtree, `src/`, scripts and docs have been traversed as described above. Host snapshot copies, remaining Android binary assets and remaining repository directories still need exact duplicate/hash and line-level closure checks before the entire 1,249-file request can be called exhaustive.


### Host snapshot parity and standalone OAuth/email worker review

- The 17 files in `host/workflows/source/` are **byte-identical** to the corresponding `base44/workflows/` files by Git blob SHA (17/17 matches).
- The 26 skill files in `host/workforce/source/.agents/skills/` are **byte-identical** to their `.agents/skills/` source paths (26/26 matches).
- The 10 agent JSONC files in `host/workforce/source/base44/agents/` are **byte-identical** to `base44/agents/` (10/10 matches).
- These 53 files are preservation snapshots, not independent executable copies. Keep the snapshots for audit/reproducibility, but do not claim they run on Cloudflare. A migration must transform the runtime contracts and preserve the source hashes as evidence.

#### Standalone OAuth Worker (`host/oauth/worker.js`)

- It is a D1-backed OAuth 2.0 authorization server for one narrow external agent use case (`campaigns:read`), not a replacement for the 11 Base44 connector declarations or 24+ user-facing provider connections.
- It is disabled unless `OAUTH_ENABLED=true` and D1 is bound. Its fixed callback is Make/Integromat (`https://www.integromat.com/oauth/cb/oauth2`), and its only supported scope is `campaigns:read`.
- Access tokens are stored as hashes, access tokens expire after 15 minutes, refresh tokens rotate and are revoked on reuse, client secrets are hashed, client disable revokes tokens, and introspection is protected by an internal secret. These are useful controls to retain.
- **PKCE is optional in the current authorization-code flow**, because a missing challenge is accepted. For a public client, destination OAuth should require S256 PKCE, one-time state binding, exact redirect URI, short-lived one-time authorization code, atomic consume, client authentication appropriate to client type, token rotation and revocation. Do not treat this narrow Make API as the general provider connection vault.
- Its admin authorization can accept a static `IFUND_OAUTH_ADMIN_BRIDGE_SECRET` header; if retained, that bridge must be restricted to a trusted internal caller, compared safely, rotated, and supplemented by current Supabase super-admin identity rather than becoming a general-purpose admin bypass.
- Its campaign feed proxies to `IFUND_AGENT_CAMPAIGNS_URL` using `IFUND_OAUTH_AGENT_KEY`, which the source docs set to the Base44 `externalAgentCampaigns` endpoint. Replace that upstream with an IFund-owned, owner-scoped Supabase query route before removing Base44.

#### Inbound email Worker (`host/email/worker.js`)

- Uses ECDSA P-256/SHA-256 signatures with timestamped payloads to deliver inbound messages to independent Supabase endpoints. Verification aliases are separately recognized and require an active paid mailbox before routing; no fallback to Gmail, Base44 InboxItem or general notifications is intended.
- Organization mail and member verification mail use separate routes. Preserve that separation; never put one-time verification content into ordinary agent context or the general inbox.
- `host/email/README.md` has contradictory legacy setup instructions about a Base44 secret, while the Worker reads the signing key from Cloudflare Worker secrets. Destination setup documentation must use only Cloudflare/Supabase secrets and should remove the stale Base44 provisioning step.

#### Gateway details

- `host/gateway/worker.js` has a Supabase Auth validation preview and a private owner-campaign RPC preview, but both return disabled/503 unless the preview flags are enabled. The health/readiness endpoint explicitly reports `ready:false` and three Base44 blockers. Its ordinary MCP route still proxies Base44 and tags responses `x-ifund-mcp-proxy: base44`.
- Admin agent message/status endpoints still call Base44 `verifyAdminGateway`, `executeAdminAgentRequest` and `auditAdminAgentGateway`; `/api/v1/agent/content` and `/api/v1/agent/campaigns` also forward to Base44 function URLs. The Worker is a transitional gateway, not an independent backend.
- `host/gateway/campaign-assistant.js` uses Cloudflare Workers AI for generation, but reads user identity and feature availability from Base44 `/entities/User/me` and `/functions/getFeatureAvailability`. It is therefore an AI-provider extraction only, not independent auth or application hosting.

**Host file closure:** all 74 host paths inventoried. Runtime workers, README/config files, manifests and eligibility reports reviewed; 53 staged workflow/agent/skill snapshots were SHA-compared against canonical source. The separate OAuth worker and email worker were inspected. Host package-lock and binary/runtime artifact checks remain to be included in the final source-wide closure report.


**Asset follow-through:** all 37 SVG files under `public/` (the planet mark plus 36 platform logos) were fetched and scanned. None contains Base44 references, external hrefs, script elements or foreignObject content. The remaining 11 raster assets (5 JPG + 6 PNG) are static image assets; their Git blob identities are recorded in the source tree. The complete public directory is 50/50 files, with two JSON manifests, 37 SVGs, five JPGs and six PNGs. No public asset contains a runtime credential or API URL in the reviewed text manifests.


### Final small-directory closure: `.ci/`, `audits/`, `supabase/`, and tool lockfiles

- `.ci/last-batch-check.txt` is a four-line historical checkpoint describing a 2026-10-03 Base44 startup/auth/data-plane audit. It is evidence of what was checked then, not current runtime status.
- `audits/2026-10-09-public-experience-readiness.md` is a 35-line historical readiness report. It explicitly says the public experience, provider sign-in, managed connections, reporter workflow, paid subscription checkout and financial reconciliation were not all production-verified. Its final gate still points to Base44 main; keep it as historical evidence and replace the release gates in the destination.
- `supabase/migrations/20261022_ifund_private_workflow_queue_initial.sql` is a nine-line source reference for an already-applied private `ifund_ops` migration creating `workflow_jobs`, `workflow_control` and `workflow_execution_log`. It explicitly says it is not a second migration to apply automatically, all tables are RLS-protected with public/anon/authenticated privileges revoked, all jobs default paused, and no schedules were activated. Reconcile the live Supabase migration history before any schema operation; do not replay this source file blindly.
- `tools/capacitor/package.json` and its 1,148-line lockfile are a separate, exact-pinned Capacitor 8.4.3 toolchain with Node `>=24`, isolated from the normal web install. Keep this separate Android lane if required; it does not change the primary destination Node 22 release contract.
- `host/email/package.json` and its 1,557-line lockfile pin `postal-mime` 2.7.6 and Wrangler 4.x with Node `>=20`. No Base44 package appears in this isolated Worker dependency graph.

**Corrected source-wide inventory:** 1,249/1,249 tracked files accounted for by top-level group. `src/` (367), `base44/` (373), `scripts/` (182), `docs/` (85), `.agents/` (26), `.github/` (9), `host/` (74), `android/` (55), `public/` (50), root (23), `tools/` (2), `.ci/` (1), `audits/` (1), `supabase/` (1). The `scripts/` count includes 181 executable scripts plus the agent-access fixture. This reconciles the total but does not mean every binary has been decoded or every runtime capability has been migrated.


**Agent-skill inventory correction:** the three remaining references `ifund-outreach/references/agent-guide.md`, `ifund-story/references/agent-guide.md` and `ifund-strategy/references/agent-guide.md` were fetched and SHA-compared with their legacy role guides; all three are exact duplicates. Together with the previously checked Chief of Staff, Communications, Finance and Growth references, this makes 7/7 duplicate guide copies. `.agents/skills/wix-base44-connector/references/CAPABILITY_MAP.md` was also fetched (87 lines): it points to Wix's remote `base44-connector` skill manifest and tarball, so it is a Base44-specific skill package rather than a generic Wix API contract. Replace it with a direct Wix API capability map in the destination, while preserving legitimate Wix API knowledge from the helper where still needed. Correct total: 26/26 files in `.agents/`, 19 unique content files and 7 byte-identical reference duplicates.
