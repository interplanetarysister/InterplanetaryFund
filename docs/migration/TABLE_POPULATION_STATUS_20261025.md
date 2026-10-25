# IFund Supabase table population — verified 2026-10-25

Authoritative plan: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).
This is a record of applied connected-Supabase operations. It does not claim the live application has feature parity or that financial transactions were verified.

## Projects and current routing
- **Designated replacement database:** `InterplanetaryFund`, `ssibsfmtodgximseeqsv`.
- **Existing old Supabase migration source:** `Ifund`, `tzehxfikoslihnclhxuz`.
- **Current live Cloudflare Pages build** still points to the older `tzehxfikoslihnclhxuz` project. It has **not** been silently changed. The new project has **0 auth.users**; its public campaign/posts tables remain **empty** until account ownership can be established.

## Installed tables and access verification
- **79** private `ifund_stage` tables (one per nonfinancial/non-credential Base44 entity).
- **12** private `ifund_finance` tables (financial entity contracts; no transactions or balances imported).
- **4** private `ifund_secrets` tables (credential-related entity contracts; no credentials imported).
- **3** private `ifund_transfer` tables (`campaign_snapshots`, `content_snapshots`, `source_inventory`).
- **4** existing initial `public.ifund_*` app tables (all zero rows at audit).
- **All 102 tables have RLS enabled.** Each of the 95 typed private entities has an explicit `deny_clients_*` RLS policy. The 3 private transfer tables also have explicit deny policies, and all 98 private tables return **zero anon/authenticated SELECT grants**. These are provisional private staging contracts, **not** finished business authorization or public production RLS parity.
- Security advisor scan after policies: **zero findings**. Previously public-executable `public.rls_auto_enable()` event-trigger helper access is revoked from `anon` and `authenticated`.

## Population counts confirmed
| Table / dataset | Rows | Interpretation |
| --- | ---: | --- |
| `ifund_transfer.campaign_snapshots` | 27 | Private payload preservation, not financial authority |
| `ifund_stage.campaign` | 27 | Typed nonfinancial campaign mapping, owner UIDs NULL |
| `ifund_transfer.source_inventory` | 20 | Observed category counts for **785** source-side staged records; these are **metadata only**, not copied payloads |
| `ifund_transfer.content_snapshots` | 0 | Cross-project private payload transfer was blocked; do not claim migration |
| `public.ifund_campaigns` | 0 | No owner mappings into target auth.users; do not invent identities |
| `public.ifund_posts` | 0 | No verified end-user identity migration |

### Campaign integrity proof
- Original source/target campaign snapshot ID and recorded digest manifests match **27/27**.
- A raw `jsonb::text` digest compared against the imported records initially matched **18/27**. The nine differences arose from decimal-number serialization between connectors.
- **Independent stronger comparison:** a recursive per-node JSON structural digest that preserves field paths, scalar types, arrays and objects while normalizing numeric trailing zero scales (using `trim_scale(numeric)`) was computed **independently within each source and destination database**. The two sorted lists matched **27/27**. No raw payloads were exported for this comparison.
- The resulting `ifund_stage.campaign` contains **17 active source-status snapshots and 10 drafts**. These are **private historical statuses**, **not publicly activated**.
- Field-level typed mapping reconciled IDs, title, summary, story, category, goal, status and cover image at **27/27** each. All 27 have NULL destination owner UIDs, NULL raised_amount and NULL donor_count to prevent fabricated financial truth.
- The original raw JSON text checksums still differ for 9; this is a serialization caveat, **not an assertion of raw byte identical archives**. The raw snapshots remain private; don't rewrite their recorded source digests to conceal differences.

### Source-side remaining data
Old `ifund_migration.content_shadow` has **266** records including Recommendation 100, Notification 94, FeatureFlag 24, AgentConversationRun 13, Agent 10, SocialPost 10, HelpArticle 6, and smaller types; they have **not yet been copied to new target**.
Old `ifund_migration.source_records` holds **42** records (PlatformConnection 32, CampaignUpdate 10); they have **not been copied**.
Additional staging metadata: owner_identity_map 10, import_batches 4, agent_activity_shadow 397, agent_delegation_shadow 26, cutover_control 13, recorded in `source_inventory`. The 785 aggregate is across heterogeneous **old staging** datasets; it does not guarantee complete Base44 production data.

## Required next gates
1. Owner-controlled secure byte-preserving `scripts/migration/transfer_supabase_snapshots.py` with the two project DB URLs supplied solely at runtime, not as chat messages or committed secrets. That script is committed, **not executed/tested against linked accounts**.
2. Securely transfer remaining staged content and audit/identity records only to correctly protected private tables. Respect owner scopes, credential references and consent; user data is never available in public staging.
3. Verify Base44 source completeness for all 95 entities and associated media. The source ZIP contains **code**, not live table rows.
4. Create/prove destination Supabase Auth accounts with verified owner linking. Then map campaigns to `auth.users` and expose only fully authorized public rows under production RLS.
5. Reconcile donations, fees, ledger holds and withdrawals against PayPal/provider evidence **before** allowing payment operations; preserve gift-first accounting policy.
6. Complete the 184 backend ports, UI parity, payment webhooks, provider OAuth, workflows and production testing; **do not unpublish Base44** based only on DNS/schema readiness.

Email work was explicitly set aside.

## Continued implementation — 2026-10-25 (secure transfer source records)

- Applied `ifund_private_source_snapshots_and_idempotent_import_grants` to the designated Supabase project. Added private RLS-protected `ifund_transfer.source_snapshots` for 42 legacy source-record snapshots, and corrected `service_role` UPDATE grants required by `INSERT ... ON CONFLICT DO UPDATE` on existing private snapshot tables. **New table has 0 records** until the secure importer actually runs.
- Read-only source inspection shows the 42 old source records comprise **10 CampaignUpdate** and **32 PlatformConnection** rows. Keys inspected included no credential payload keys, but the importer independently refuses nested password, token, secret, credential, private-key or API-key field names.
- Extended `scripts/migration/transfer_supabase_snapshots.py` to cover all three source datasets (minimum counts **27 campaigns, 266 content, 42 source records**); preserves original source-record owner labels only as unverified provenance. Source/destination project DNS identity checks restrict database URLs to exact project hosts or recognized Supabase poolers. Connection transport requires TLS. Script remains dry-run by default and must never log row data or database credentials.
- Committed ten Python offline security/integrity tests. GitHub Actions run [40186805154](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40186805154) passed Python syntax, all Python tests, npm unit tests, npm lockfile checks and Vite build. **The overall job FAILED on a separate pre-existing Prettier formatting check** for `src/lib/legalPolicy.js`, `src/pages/About.jsx`, `src/pages/Privacy.jsx`, and `src/pages/Terms.jsx`. This remains an explicit code hygiene blocker; do not represent the full CI run as green.
- Independently queried new Supabase: 4 private transfer tables each deny SELECT to `anon`/`authenticated`; latest Supabase security advisor returned **0 findings**.
- The secure cross-project copy has **NOT run** (direct connector payload transfer was previously blocked), so `content_snapshots` remains **0**, `source_snapshots` remains **0**, and `ifund_stage.campaign` remains **27**. The importer needs authenticated runtime database connection strings supplied via secret storage or an approved owner-controlled runner. Do not include credentials in GitHub, comments, chat, or CI logs.
