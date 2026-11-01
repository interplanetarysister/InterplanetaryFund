> Current owner directive (2026-11-01): deployments are authorized for this build without repeat confirmation; this supersedes older deployment-approval text. Verification and rollback gates still apply.

# Base44 source inventory — `interplanetarysister/interplanetary-fund2` @ main
Source of truth: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Source was read through authenticated GitHub connector; source repo is read-only. These are static analysis results, not live-state or runtime exports.
## Definition census (verified by Git tree)
- 95 entity contracts (`base44/entities/*.jsonc`). Required fields, property names/types/enums/defaults and declared RLS were inspected in per-entity appendices.
- 184 backend function entrypoints (`base44/functions/*/entry.ts`). Per-file static name-based purpose, detected entity calls, selected API hosts and secret name references were recorded. **Not implementation parity**.
- 11 connector definitions; 10 agent definitions; 17 workflow definitions; 1 MCP file.
- 364 frontend JS/TS/JSX/TSX files in `src/` were statically scanned for **direct** `base44.auth`, `base44.entities`, `base44.functions`, `base44.integrations`, `base44.agents` and similar calls. Results list file and line in the appendices. Indirect client aliases, computed properties, runtime tracing, caller relationships, and target adapter mapping remain unverified.
## Entity contracts
- [Fields + RLS 1–15](inventory/ENTITIES_001_015.md)
- [Fields + RLS 16–30](inventory/ENTITIES_016_030.md)
- [Fields + RLS 31–45](inventory/ENTITIES_031_045.md)
- [Fields + RLS 46–60](inventory/ENTITIES_046_060.md)
- [Fields + RLS 61–75](inventory/ENTITIES_061_075.md)
- [Fields + RLS 76–90](inventory/ENTITIES_076_090.md)
- [Fields + RLS 91–95](inventory/ENTITIES_091_095.md)
## Backend functions
- [Function details 1–16](inventory/FUNCTIONS_001_016.md)
- [Function details 17–32](inventory/FUNCTIONS_017_032.md)
- [Function details 33–48](inventory/FUNCTIONS_033_048.md)
- [Function details 49–64](inventory/FUNCTIONS_049_064.md)
- [Function details 65–80](inventory/FUNCTIONS_065_080.md)
- [Function details 81–96](inventory/FUNCTIONS_081_096.md)
- [Function details 97–112](inventory/FUNCTIONS_097_112.md)
- [Function details 113–128](inventory/FUNCTIONS_113_128.md)
- [Function details 129–144](inventory/FUNCTIONS_129_144.md)
- [Function details 145–160](inventory/FUNCTIONS_145_160.md)
- [Function details 161–176](inventory/FUNCTIONS_161_176.md)
- [Function details 177–184](inventory/FUNCTIONS_177_184.md)
## Connector, agent and workflow contracts
- [Connectors](inventory/CONNECTORS.md) (provider configuration shape; actual OAuth tokens UNKNOWN)
- [Agents](inventory/AGENTS.md) (10 agent definitions)
- [Workflows 1](inventory/WORKFLOWS_01.md) and [Workflows 2](inventory/WORKFLOWS_02.md)
- MCP definition: [base44/mcp/config.json](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/base44/mcp/config.json). Source configuration needs per-route security review.
## Frontend direct-call evidence
- [Pages 1–15](inventory/FRONTEND_PAGES_001_015.md), [16–30](inventory/FRONTEND_PAGES_016_030.md), [31–45](inventory/FRONTEND_PAGES_031_045.md), [46–57](inventory/FRONTEND_PAGES_046_057.md) — all 57 pages.
- [Components 1–17](inventory/COMPONENTS_001_017.md), [18–34](inventory/COMPONENTS_018_034.md), [35–51](inventory/COMPONENTS_035_051.md), [52–68](inventory/COMPONENTS_052_068.md), [69–85](inventory/COMPONENTS_069_085.md), [86–102](inventory/COMPONENTS_086_102.md), [103–119](inventory/COMPONENTS_103_119.md), [120–136](inventory/COMPONENTS_120_136.md), [137–153](inventory/COMPONENTS_137_153.md), [154–170](inventory/COMPONENTS_154_170.md), [171–187](inventory/COMPONENTS_171_187.md), [188–192](inventory/COMPONENTS_188_192.md) — 192 non-UI components.
- [UI primitives 1–17](inventory/UI_001_017.md), [18–34](inventory/UI_018_034.md), [35–51](inventory/UI_035_051.md) — 51 UI primitives.
- [Shared libraries 1–17](inventory/LIBS_001_017.md), [18–34](inventory/LIBS_018_034.md), [35–51](inventory/LIBS_035_051.md), [52–55](inventory/LIBS_052_055.md) — 55 shared libraries.
- [Other frontend files](inventory/FRONTEND_OTHER.md) — 9 files, including the central Base44 SDK client bridge.
- **Limitations:** A line-based static scan cannot establish that each direct call site has a migration mapping or guarantee runtime parity; aliases, dynamically computed invocations and multi-line expressions may escape these patterns.

## Frontend and schema dependencies
- Direct frontend API bridge: [src/api/base44Client.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/api/base44Client.js) uses @base44/sdk and rewrites the server URL for alternate hosts. Replaced by src/lib/supabase.js only for the *preview subset*.
- Source frontend Base44 CRUD, auth, hosted functions, Core services, connectors, and agent chat direct callsites have line-based inventory coverage. Target adapter mapping and dynamic/indirect calls are still open; do not claim Base44 parity.
- Source `base44/functions/setupPayPalSubscriptionWebhook/entry.ts` hardcodes a Base44 callback URL. Financial handlers require provider-dashboard verification (see BLOCKERS).
- `ifund_ops` private schema and 25 applied Supabase migrations already exist. This preview SQL only sketches 4 public tables; **do not apply until the full schema/RLS plan is reviewed**.
## Prioritized inventory gaps
1. Cross-reference every `base44.*` frontend call (file, line, function, auth scope) to target adapter or edge function.
2. Capture each backend function’s real callers, trusted/anonymous context, request/response types and side effects; static name/regex extraction does not prove semantics.
3. Define replacement for each connector, agent tool and workflow trigger with secret requirements, billing and idempotency.
4. Complete 95-entity Postgres/RLS schema, user ID mapping, and financial isolation.
5. No test data export has been run. Source code count is not a live row count.
## Security
Do not put old credential-vault values, tokens, donor PII, or raw function outputs in inventory documents. Never substitute inferred connectivity for verified provider state.

## Verified Supabase migration-history snapshot (read-only; 2026-10-24)
Project `tzehxfikoslihnclhxuz` returned the following **25 recorded applied migration entries**, in order. This check did not execute or apply SQL:

1. `20261019143600_create_isolated_business_mail_foundation`
2. `20261019145629_business_mail_secure_ingress_and_private_text`
3. `20261019145646_member_mail_backend_rpc_for_trusted_edge`
4. `20261019164158_admin_inbound_email_private_foundation`
5. `20261019164218_admin_email_recipient_validation_correction`
6. `20261019164253_admin_email_upsert_conflict_index`
7. `20261019164540_ifund_admin_mail_access_control`
8. `20261019165248_ifund_admin_mail_access_audit`
9. `20261019201418_fundraising_mail_subdomain_text_only_grace_storage`
10. `20261019201605_fundraising_outreach_agent_permissions_foundation`
11. `20261020044731_ifund_mail_atomic_read_audit`
12. `20261021064337_create_private_ifund_campaign_shadow`
13. `20261021223621_extend_private_campaign_shadow_nonfinancial_parity`
14. `20261023012122_ifund_private_workflow_queue_initial`
15. `20261023012527_ifund_workflow_atomic_claim_and_completion`
16. `20261023013549_ifund_workflow_lease_fencing`
17. `20261023013721_ifund_workflow_guarded_enqueue`
18. `20261023013815_ifund_core_private_migration_staging`
19. `20261023053831_ifund_private_agent_delegation_activity_shadow`
20. `20261023073825_ifund_agent_shadow_verified_identity_and_campaign_gate`
21. `20261023084110_ifund_owner_candidate_email_matches_unverified`
22. `20261023103745_ifund_owner_proof_service_only_atomic_rpc`
23. `20261023184125_ifund_active_campaign_preview_service_only_20261023`
24. `20261023225544_ifund_owner_scoped_private_campaign_preview_rpc`
25. `20261024232855_ifund_content_shadow`

**Important: RPCs, not migration names.** `ifund_migration_owner_commit` and `ifund_migration_owner_lookup` are named SQL functions defined in source `host/migration/owner-proof-rpcs.sql` on branch `migration/owner-proof-gate-20261023`. The applied-migration history contains `20261023103745_ifund_owner_proof_service_only_atomic_rpc`, but the listing **does not independently establish** that each function exists with exactly the branch's current definition. Validate via an owner-approved read-only metadata check before using. Do not change or drop these RPCs or any of the listed migrations.

## Source parity reference (UNVERIFIED export)
[content-parity-manifest.mjs](https://github.com/interplanetarysister/interplanetary-fund2/blob/migration/owner-proof-gate-20261023/host/migration/content-parity-manifest.mjs) records a **2026-10-24 source-manifest snapshot**, not a live Base44 export: User **10**, Campaign **27**, PlatformConnection **32**, Recommendation **836**, Donation **0**, Withdrawal **0**. No export with independent per-entity row counts or checksums was run for this migration; these are provisional historical reference counts, including zero-donation/withdrawal figures. The same manifest reports STAGED Recommendation **100** versus SOURCE **836**, showing it is not an import-completion certificate. All these figures require revalidation immediately before data migration and provider-ledger reconciliation.

## Owner-provided Base44 secret-name inventory — 2026-10-25
See [SECRET_DESTINATIONS.md](SECRET_DESTINATIONS.md) for **all 20** owner-listed Base44 secret names, verified static caller examples, read-only Cloudflare Worker name checks, and safe migration destinations. This is **not** a secret-value export and does **not** establish that new backend secrets have been configured. Payment PR #145 needs a newly registered `PAYPAL_WEBHOOK_ID` and backend-only Supabase credentials. The destination's published runtime remains unverified.


## Phase 6 cached-data inventory — October 25, 2026

Destination `ifund_transfer`: 27 campaign snapshots, 266 content snapshots, and
475 source/historical snapshots. All **768** destination JSONB payloads now
match exact source SHA-256. **741** records were newly inserted; nine existing
campaign numeric-serialization differences were repaired with value/digest
checks. This inventory describes private cached projections, not a complete
95-entity production export. No identity/role ownership or financial authority
was inferred. See [the transfer report](CACHED_SNAPSHOT_TRANSFER_20261025.md).

New repeatable tools: `scripts/migration/snapshot-transfer.mjs` (private,
idempotent 100-row SQL generator plus exact readback verifier) and
`scripts/migration/verify-owner-rls.sql` (17-check rollback-only database-role
probe, prepared but not verified because its tool execution failed).

## 2026-11-01 live audit and operation mapping

Source is the original Base44 platform plus read-only source commit
`d681fb36c37f86de8d32a60f4350853d0c792f87`. Target checkout starts at
`471bbe73b6ca6bf0c6173a85d655c9f6b35e4793` and contains pre-existing,
uncommitted work, which was preserved. Source repository status stayed clean.
The reference product is never inferred from the newer migration scaffold.

### Inventory deliverable

The existing canonical contract locations from PR #165 were recovered into this
checkout and expanded with pinned source hashes, local-import dependencies,
transitive entity/secret-name indicators and explicit proposed replacements:

- [184 backend functions](contracts/functions.json): each has a proposed
  compatible `/functions/<name>` path, independent execution/data dependencies,
  activation gates and rollback. `target_handler` stays null for unimplemented
  functions; proposed mappings are not claims of working replacements.
- [95 entity contracts](contracts/entities.json): original fields, required
  values and declared RLS, plus candidate Supabase table/staging crosswalk.
  Prior catalog booleans are labeled as historical snapshot evidence; staging
  existence does not establish runtime permissions or data parity.
- [17 workflows, 10 agents, 11 connectors](contracts/automations.json): exact
  source triggers/steps, tool configuration and OAuth scope declarations,
  with independent queue/executor/provider-grant replacement requirements.
- [59-route historical acceptance matrix](role-platform-evidence.json): main
  has 58 named routes plus its fallback; the historical union includes the
  additional `/download` route. Matching mounts remain unverified.

These are complete definition censuses and replacement proposals, not a complete
semantic or live-state certification. Computed function/entity names, indirect
SDK aliases, provider dashboard registrations, enabled Base44 automation state,
RLS runtime tests and real user journeys still require verification. No sensitive
entity export, private credential read, source function invocation, builder
operation or provider mutation was performed.

### Original versus independent implementation

[Public browser observations](contracts/site-observations.json) cover `/`,
`/login`, `/discover`, `/help` on the reference, production apex and published
Pages origin. Chromium used a 1440px light-theme viewport. Non-GET requests were
blocked, so analytics writes, function calls, form submissions and paid actions
were not exercised. Screenshots remain local under `work/site-audit/` outside
the repository. Mobile/dark/Android and authenticated journeys are unverified.

| Surface | Original Base44 observation | Current production observation / source gap |
| --- | --- | --- |
| Home and navigation | Original “A universe of possibility” page, founding community and campaign calls to action | Different universal fundraising scaffold, different header/content hierarchy and migration footer |
| Sign in | Password form plus Google, Apple and Facebook options | Email-code flow, Google/Facebook options; password and Apple experience absent |
| Discover | Real original campaign cards and category controls | Permission error with “No active campaigns yet”; this is not proof of no source campaigns |
| Help | Topic browser, search and help content | “Page not found” on the production route |
| apps/web port | Required 58 main named routes | 20 named partial mounts, 38 placeholder mounts; fallback is separate; historical `/download` missing |
| Campaign editor | Location/geocoding, original draft/publish/management flows | Reduced draft form; location action and complete model missing |
| Agents, social, inbox, communities, donors, ledger, withdrawals, admin | Implemented original routes/functions/entities are inventoried | Most apps/web routes are placeholders; independent scaffold has only limited subsets |
| Reporter | Original blog management and publishing function | Root scaffold has a Supabase blog subset; apps/web still mounts blog placeholders |
| Payments | PayPal source functions, subscriptions, provider events and ledger rules | No campaign-payment or accounting parity has been certified; original PayPal behavior must be preserved |

The published Pages bundle matches the root scaffold's observed design, not the
`apps/web` port. Root `Discover` and `Feed` issue `select('*')`. A read-only
request comparison using the site's own publishable configuration reproduced
401 for `select=*` and 200 for the granted public campaign column allowlist
(with zero active destination rows at that moment). Supabase metadata shows
column-level public grants and active-only RLS. Do not fix this by exposing
owner/private columns. The error/empty-state presentation and missing source
data reconciliation remain separate defects.

### Infrastructure actually observed

- Production Pages project `interplanetaryfund-migration` lists apex, www and
  preview domains. Its Git source is still **interplanetary-fund2**, root `/`,
  build `npm ci --legacy-peer-deps --no-audit --no-fund && npm run build`,
  production branch `main`, automatic deployments disabled. The separate
  `interplanetaryfund-migration-preview` project points to **InterplanetaryFund**.
  Source settings alone do not identify the manually uploaded bundle's commit.
- Legacy Worker `interplanetary-fund2` still has deployed Base44 MCP proxy code,
  `IFUND_BASE44_ORIGIN`, and Base44 `externalAgentCampaigns`/
  `externalAgentContentWrite` URLs. Independent auth-preview enablement does
  not remove those runtime dependencies.
- `ifund-workflows` has an enabled flag and a one-minute cron, and code can
  dispatch to Supabase Edge Functions or fall back to Base44. The observed
  bindings lack both a service key and workflow API key. An enabled scheduler
  and registry do not establish that any required backend handler executes.
- `ifund-workforce` is enabled but still configured with an application-origin
  dependency; it is not proof of independent agent conversation/tool execution.
- `ifund-notifications` has enabled acknowledgement routes on apex/www.
  Its health endpoint returned 200. Current owner-only behavior is not proof
  of complete original Notification CRUD/admin parity or delivery integration.
- `interplanetary-fund-api-migration` has a preview flag enabled but lacked
  `SUPABASE_URL` in its settings at inspection. Worker tags saying disabled
  were stale; settings/code and successful calls are the relevant evidence.
- Supabase **ssibsfmtodgximseeqsv**, not the older Ifund project, contains public
  runtime tables plus private staging, finance, ops, control, transfer and
  credential schemas. Three Auth users and three active profiles were observed.
  All production metadata reads were read-only; no schema or user data changed.
- A separate `ifund-geocode-staging` Worker was deployed in this batch. Its
  encrypted publishable-key binding and successful rejection/configuration
  checks are documented in [GEOCODE_CITY.md](GEOCODE_CITY.md). It owns no
  production routes. Existing services and Base44 were left available.

### Prioritized incremental replacement plan

1. Finish the staged `geocodeCity` live positive test and source UI journey,
   review its documented security differences, and record dispatch rollback.
   Switch only that verified operation. See its detailed acceptance gate below.
2. Repair public read-column contracts and error handling, reconcile source
   campaign/content ownership/data, and prove anonymous reads and private-field
   denial. Retain exact source appearance and complete field semantics.
3. Port **getCampaignDraft** with its original request/response, legacy-ID
   mapping, owner/admin access and campaign response allowlist; then proceed
   through save/publish/settings/follow operations one at a time.
4. Reproduce notifications, unified inbox, social/community and provider
   connections with verified owner/admin permissions, consent, uploads and
   provider evidence; restore each original frontend action as its backend lands.
5. Replace each workflow trigger/step and agent tool with an independent,
   owner-scoped executor, transactional event delivery, leases/retry/idempotency,
   original waits/approvals and audit records. Confirm events actually execute.
6. Migrate PayPal orders/capture, subscriptions, receipts, settlement, ledger
   and withdrawals in their original dependency order, with actual sandbox
   events, accounting reconciliation and failure/replay recovery. Do not introduce
   Stripe or change payment rules. Historical Stripe source is inventoried only.
7. Reconcile complete media/data and all 59 historical route/role/platform
   proofs before full-platform cutover and Base44 shutdown. Deployment approval
   is already granted for this build; verification remains mandatory.

### First operation, remaining dependencies and next acceptance criteria

**geocodeCity** is implemented and staging-deployed, with 25 focused tests and
live unauthenticated/invalid-session rejection checks. Signed-in success and
original campaign locate/save integration are still pending; no completed
production replacement is claimed. [Full contract/evidence](GEOCODE_CITY.md).

Remaining Base44 dependencies include: original auth/session and user identity
mapping for source-backed operations; 183 other function definitions with no
fully verified replacement in this checkout (some have partial candidates);
95 original entity contracts whose complete runtime/data/RLS parity is unproven;
connectors/OAuth grants and credential storage; Core LLM/image/email/upload
services and storage/media URLs; agent conversations/memory/delegation/tools;
all 17 original workflow triggers/steps; MCP/agent API proxy paths; and PayPal
callbacks, reconciliation, receipts and accounting where original functions or
provider registrations still point to Base44. No dependency is retired by an
empty table, mounted route, enabled flag, staged definition or successful build.

**Next recommended operation: getCampaignDraft.** Prerequisites are verified
legacy-user and campaign-ID mappings, the complete original Campaign response
fields, trusted admin-role authority, current account lifecycle/RLS, and an
isolated Worker dispatcher. The original accepts `{campaign_id}` with 1–100
letters/numbers/underscore/dash, returns `{ok:true,campaign:…}`, and allows the
creator or an administrator to read a draft. The current UUID-only GET subset
is behaviorally different. Acceptance must demonstrate:

- owner and trusted administrator success; anonymous, disabled/deletion-pending,
  stranger and elevated-role spoof rejection;
- original 400/401/403/404/500 branches, non-draft exclusion and exact response
  allowlist; no import-correlation/private fields;
- actual Supabase persistence/identity mapping, legacy IDs, two-user tests and
  complete original draft editor reload without lost values;
- no Base44 calls in the replacement, operation-only switch and rollback, with
  unrelated platform smoke tests. Do not treat user_metadata as a role authority.
