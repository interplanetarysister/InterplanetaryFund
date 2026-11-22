# What If? Engine — Mission database and platform connectivity
Date: 2026-11-19 (Pacific). Target: canonical iFund \`apps/web\`, Cloudflare Pages + Worker and Supabase project \`ssibsfmtodgximseeqsv\`.

## Installed database, authoritative source and limitations
The **two** additive migrations were applied to the project (source files committed on this feature branch):
- \`supabase/migrations/20261120042045_ifund_what_if_mission_foundation.sql\` — 9 private Mission tables, owner foreign keys, strict RLS and narrow column grants.
- \`supabase/migrations/20261120042253_ifund_what_if_mission_rls_and_indexes.sql\` — query-plan optimization and FK indexes.

Supabase migration-history versions are \`20261120042045\` and \`20261120042253\`. The installed tables were verified by read-only catalog queries; no Mission rows have been created as part of rollout. Existing \`ifund_mission_brief\` is a legacy, independent text-ID table, **not** the new member Mission object. Existing campaigns, finances, imported records and ownership mappings were left unchanged.

The database schema is installed; **the website has not been released, the feature flag has not been enabled, no model has generated a Mission, no provider has been connected, and no user-role browser test has passed**. Any runtime-completeness claim requires independent verification.

## One application database
\`\`\`
React website (apps/web) / future paired mobile apps
  | Supabase Auth session (JWT), publishable key only
  |---> PostgREST + PostgreSQL RLS (member-scope Mission CRUD)
  |---> same-origin /api/missions/explore
          Cloudflare Pages Function -> existing Worker router
          |--- gated deterministic provisional guest answer; NO writes
          |--- future supervised AI service through owner-verified Worker endpoints
          +--- future OAuth/provider API adapters (capability and consent checks)
Cloudflare R2 = media bytes only (future private attachment adapter)
Supabase Postgres = durable structured records, audit, role grants, consent,
                    status metadata, provider provenance
Existing PayPal/financial ledger = sole verified first-party monetary truth
External-host checkout = provider-direct, never through iFund custody
\`\`\`

## Table contracts
| Table | Primary key / ownership | Purpose | Member writes |
|---|---|---|---|
| \`ifund_missions\` | UUID; owner_id -> auth.users | private prompt, outcome, status, revision | create + narrow update |
| \`ifund_mission_plan_versions\` | UUID; composite (mission_id,owner_id) | versioned plan JSON + provenance | none (server-side writer only) |
| \`ifund_mission_tasks\` | UUID; composite | milestones, status, optimistic revision | create, update, delete |
| \`ifund_mission_campaign_links\` | UUID; composite + campaign UUID | explicit campaign association, cross-owner rejection | none (Worker) |
| \`ifund_mission_opportunity_matches\` | UUID; composite + optional legacy text opportunity ID | source and eligibility status distinct from confirmed offer | none (Worker) |
| \`ifund_mission_connection_intents\` | UUID; composite + optional verified connection UUID | requested vs authorized capability | none (Worker) |
| \`ifund_mission_cost_items\` | UUID; composite | owner estimates/quotes in integer minor currency units | create, update, delete |
| \`ifund_mission_agent_actions\` | UUID; composite | proposed/approved/executed agent actions; idempotency | none (Worker) |
| \`ifund_mission_events\` | UUID; composite | immutable-style event log and verification receipts | none (Worker) |

All nine are **private**: no \`anon\` grants, owner-filtered authenticated SELECT under RLS, active account and non-anonymous claim required. Member writes additionally need current accepted terms; no member grants to mint provider confirmations, plan evidence, agent-action receipts, financial facts or audit events. Server writers must check owner, capability, consent and verified provider receipts on each action; \`service_role\` must never be sent to the browser or assumed to be safe without authorization checks.

\`ifund_missions\` has its own statuses \`draft\`, \`planned\`, \`in_progress\`, \`completed\`, \`archived\`; unlike a campaign, it does not require a fundraising goal or story. \`ifund_campaigns\` retains existing draft/active/paused/completed constraints and its published-story/positive-goal gate. \`ifund_mission_campaign_links\` requires equal verified owners for both records. Existing campaign creation/editing routes, draft recovery, partner direct checkout and 3%-at-withdrawal first-party accounting remain unchanged.

## Platform connection states — no shortcuts
| Platform | Source of truth | Proposed wiring | Claims allowed now |
|---|---|---|---|
| Supabase Auth | auth.users, ifund_profiles, legal acceptance | Browser session -> owner RLS; Worker verifies bearer -> user | active project; not new user acceptance |
| Cloudflare Pages | canonical apps/web | present website; same-origin Pages Functions -> shared Worker | source route added, NOT deployed |
| Cloudflare Workers | canonical worker/index.js | /api/missions/explore feature-gated; other actions require audited worker routes | provisional static guidance only |
| R2 | existing media store | owner-signed, verified private object operations; Postgres stores metadata | not implemented for Missions |
| Mission AI inference | specialized Worker gateway (planned) | model selection, rate limits, redaction, evidence tags, bounded outputs | NOT connected |
| iFund specialist agents | existing team services | NEXUS routes to nine roles; reviewed task payloads and receipts | no extra agent-execution grant |
| Opportunities | ifund_opportunity (legacy text IDs) | audited source match and due date; proposed/verified evidence | candidates only |
| Connections | ifund_connections, provider tokens | OAuth per provider, per-scope grants, token revocation | intent is NOT authorization |
| PayPal | existing webhook-signed ledger | when separately published campaign accepts real gift | untouched by Mission migration |
| External fundraising hosts | canonical provider-direct links | explicit verified link; destination owns checkout | no invented partner access |
| GitHub | interplanetarysister/InterplanetaryFund | reviewed branch, source migrations, no Actions-minute-heavy workflow | source changes only |

## API and feature gates
- \`apps/web/src/api/missions.js\`: owner-verified API for \`createMission\`, \`loadMission\`, \`listMissions\`, optimistic \`updateMission\`, plan/task read and task CRUD, read-only integration statuses.
- \`POST /api/missions/explore\` in \`worker/missions/explore.js\`: conditional on server-side \`IFUND_WHAT_IF_ENABLED=enabled\`, max 12,000-character prompt and bounded JSON request, no cost, no persistence, never pretends AI inference or provider research took place.
- Server default flag absence **disables** the guest route. Do not set \`enabled\` until a tested preview is approved. No fee, external publishing, payouts or OAuth can be activated by that flag.
- Future mutating route(s) must check actual \`ifund_ai_permission_preferences\`, current terms, account status, JWT, owner, capability-specific scopes, replay/idempotency, rate limits, cost, provider receipt, source labels, revision compare-and-swap and audit events; no generic "approve all future external actions" bypass.
- Guest provisional prompts stay client-only unless the user explicitly requests an authenticated save. Never leak private Mission text into public campaign search or shared agent training.

## CLI / dashboard field map
| Field | Correct value/source | Destination / safety |
|---|---|---|
| Supabase project ref | \`ssibsfmtodgximseeqsv\` | select canonical production project |
| Supabase URL | \`https://ssibsfmtodgximseeqsv.supabase.co\` | \`VITE_SUPABASE_URL\`; public |
| Publishable key | live Supabase dashboard -> API Keys -> publishable | \`VITE_SUPABASE_PUBLISHABLE_KEY\`; public key but RLS required |
| Supabase service role/secret | Supabase dashboard server secret only | runtime Worker secret, **never VITE_** |
| Cloudflare Pages project | \`interplanetaryfund-migration\` | existing deployment, preserve manual build |
| GitHub owner/repo | \`interplanetarysister/InterplanetaryFund\` | repo source, not Base44 legacy |
| Github branch | \`feature/what-if-mission-db-20261119\` | source-only |
| Worker mode | \`IFUND_WHAT_IF_ENABLED\` omitted/disabled | server flag, not frontend bypass |
| External execution | \`IFUND_WHAT_IF_EXTERNAL_ACTIONS\` omitted/disabled | planned future gate; currently NOT implemented |
| Cloudflare account/token | take from authorized Cloudflare account | local CLI login / Worker secret; never paste into repository |
| Supabase CLI token | personal account token | local credential manager only, never in \`.env\` committed |
| R2 binding | existing canonical bucket plus scoped Worker binding | only after verified media auth; no new bucket invented |

Windows PowerShell: \`pwsh -File scripts/what-if/Check-IFundWhatIf.ps1 -RepoRoot .\` (read-only) and \`pwsh -File scripts/what-if/Set-IFundWhatIfLocal.ps1 -RepoRoot .\` (creates only an otherwise absent \`apps/web/.env.local\` and refuses server keys).

**Supabase CLI**: query \`supabase --version\`, \`supabase --help\` and \`supabase db --help\` before commands; current v3 defaults to local, hosted commands require explicit \`--remote\`/confirmation. **Never replay these installed migrations against live blindly**. Use \`supabase migration list\` and compare exact applied version; do not toggle Cloudflare production Git-deploy triggers or create paid branches to test.

## Acceptance matrix (not completed by installing tables)
1. Compare catalog and migration history, RLS policies, privileges and FK indexes.
2. Transactionally validate owner A vs owner B, no-account, inactive, expired terms, anonymous session and account-switch denials, plus 409 on stale revisions. Tests must leave no lasting production records.
3. Exercise guest prompt and show deterministic "unverified / no provider action" result. Prove flag-off route denial and input-size enforcement.
4. Exercise verified signed-in create/save/reload/update/task/delete in real preview UI, not just raw API code.
5. Validate plan-version writes via a separately authorized Worker; distinguish plan drafts from verified opportunity data and receipts.
6. Link an owned draft campaign, reject foreign campaign UUID, preserve old 3-step and /create?draft= recovery.
7. Test provider-specific OAuth, scope refresh/revocation and error recovery, but classify missing verified providers as BLOCKED.
8. Verify provider sandbox financial events using original ledger, never fabricated or forwarded external money.
9. Test Android/iOS clients against same backend with real verified identities once those apps exist.
10. Consolidate local tests, one preview build, role-specific browser verification, then independently authorize and verify production promotion.

## Current exact state
- **DONE:** live additive schemas + RLS + FK indexes; source branch, owner-member client module, feature-gated preliminary guest route, Windows CLI templates.
- **NOT DONE:** site/UI release and routing, real AI model invocation, Mission plan-writing API, actual email/social/partner/OAuth authorization, private Mission media uploads, mobile apps, sandbox-provider E2E and production browser role verification.
