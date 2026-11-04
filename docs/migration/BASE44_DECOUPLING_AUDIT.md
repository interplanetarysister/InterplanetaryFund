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

**Batch result:** 14 files reviewed (including the previous 5-file batch, now 19 agent-skill files in total). 8 current IFund skill guides contain explicit Base44 runtime/agent format dependencies; 3 legacy agent references do not contain Base44 naming; the Wix connector is a separate 907-line Base44-contextual tool that needs its own disposition. The 39-line content-writes guide has a direct Base44 registration dependency despite having only one literal mention.

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
