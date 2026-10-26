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

## Phase 2 staging SQL coverage
- Generated table definitions: 95 source entities. Private schemas: `ifund_stage` (79), `ifund_finance` (12), `ifund_secrets` (4). See `supabase/migrations/pending/phase2_*.sql`.
- Each staged table has a UUID local ID, unique original `legacy_id` text, optional `owner_auth_uid` FK to `auth.users`, typed columns from JSONC, index on owner, RLS enabled, and an explicit **deny-all** policy for browser roles until audited role/owner linking is available. All tables remain outside exposed `public` schema.
- Financial entity tables have no browser write access. Credential definitions are in private `ifund_secrets`; actual provider secrets must go through secure vault/rotated provider credentials, **not** plaintext import.
- Six deferred legacy-ID referential constraints for campaigns and communities are included in a **pending-only** SQL file. Remaining legacy ID foreign-key and Base44 row-access parity require validation against exports and server-auth decisions.
- Copy of `docs/migration/independent-agent-conversations.sql` from source commit `6f7fd599a3dad55f2ac4d79d9aa7d8a390b23f9` is in `supabase/migrations/pending/20261025_independent_agent_conversations.sql` and remains inactive. No source branch was cherry-picked or modified.

## Phase 3 owner-link staged components
- Auth UI: `src/pages/Auth.jsx` (from Phase 1) uses Supabase Google/Facebook OAuth and email OTP, never Instagram login or password signup. Runtime availability requires owner approval to configure providers and email template.
- `worker/ownerLinkRules.js`: pure server-side eligibility and consent gates, unit tested; not a connected provider endpoint.
- `supabase/migrations/pending/phase3_owner_link_proposal.sql`: private `ifund_identity.owner_matches`, `link_challenges`, `link_consent_audit`; service-only `claim_verified_owner` function with atomic nonce consumption, source owner match, confirmed destination auth email, and consent proof. This proposal is **not applied**, and production behavior is **not verified**. It does not replace/alter the existing source `ifund_migration_owner_commit` or `ifund_migration_owner_lookup` RPC definitions.
- Legacy sign-in proof is **not** required by the new proposal; provider verified email or approved OTP sent to original Base44 email is the fallback. Do not copy any real owner emails or legacy identifiers into Git.

## Phase 4 function-port ledger
- `docs/migration/FUNCTION_PORT_STATUS.json` is the authoritative list of **184** source function entrypoints with per-port statuses (two `partial_preview_unmounted`, 182 `not_ported`). It is not a parity certificate.
- Staged `worker/reads.js` prototypes community feed and a user-owned campaign draft read with JWT verification and RLS-scoped forwarding, plus public active campaigns read. Not reachable through `worker/index.js`, not deployed, not connected to a live Supabase schema. The source behavior also involves rate limits and a wider data contract; complete function parity remains open.
- No PayPal/Stripe handlers, payouts, agent runtime, OAuth connector, automatic publishing, external API tokens, or secret values were moved in this PR.

## Phase 5 frontend parity ledger
- `docs/migration/FRONTEND_PAGE_STATUS.json` tracks exactly 57 Base44 source page files: **3 static ports needing review** (About, Terms, Privacy), **10 preview counterparts not parity-complete**, and **44 not ported**. No live frontend comparison run.
- React pages and historical legal-policy source are copied into active scaffold without Base44 imports. Legal acceptance tracking, current policy approval, and provider-backed Help/Contact flows require independent backend ports.
- Payment and OAuth pages remain disabled/not integrated, and no main production frontend route or Wix marketing site was changed.
