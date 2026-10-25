# IFund Supabase Table Editor — verified population state (2026-10-25)

**Project to populate:** `InterplanetaryFund` / `ssibsfmtodgximseeqsv`.
**Existing separate source staging:** `Ifund` / `tzehxfikoslihnclhxuz`.
This file documents actual connected-database reads and writes, not estimates or a claim of completed source migration. Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).

## What is already populated in the new Supabase project

- `public.ifund_profiles`, `public.ifund_campaigns`, `public.ifund_posts`, `public.ifund_connections`: **schema created, RLS enabled, 0 rows**. The new project's `auth.users` has **0 users**. Real campaigns cannot be linked to unprovisioned identities; do not generate fake users or publish legacy drafts.
- `ifund_transfer.campaign_snapshots`: **27 rows** from the old private `campaign_shadow`. Key/id and recorded-manifest comparison passed. Post-transfer payload digest check **18/27 PASS; 9/27 FAIL** (JSON serialization), so these remain **unverified, private, non-financial-authoritative**. One individual reserialization trial passed; the complete fix did not.
- `ifund_transfer.content_snapshots`: **0 rows**. User-content cross-project inserts were stopped by connector safety checks. Do not claim imported content.
- `ifund_transfer.source_inventory`: **20 verified metadata records** across prior Supabase tables and entity types, created via count-only query, recording **785 source staging rows**. This is accurate metadata, **not a transfer of those 785 records**. The 20 breakdown entries:
  - `campaign_shadow` Campaign 27 (27 staged)
  - `content_shadow` Recommendation 100; Notification 94; FeatureFlag 24; AgentConversationRun 13; Agent 10; SocialPost 10; HelpArticle 6; Community 2; DiscussionPost 2; FoundingWaitlist 2; PublicProfile 2; SupportTicket 1
  - `source_records` PlatformConnection 32; CampaignUpdate 10
  - `owner_identity_map` 10; `import_batches` 4; `agent_activity_shadow` 397; `agent_delegation_shadow` 26; `cutover_control` 13
- All `ifund_transfer` tables have RLS enabled; anonymous and authenticated browser roles have **no SELECT privilege**. Never expose that schema through the Supabase Data API.
- Applied migrations to new project: `ifund_phase1_application_runtime_schema`, `restrict_rls_auto_enable_event_trigger_api`, `ifund_private_source_shadow_transfer`, `ifund_private_source_inventory`. Existing public helper `rls_auto_enable()` is no longer invocable by `anon` or `authenticated`; security-advisor scan found zero findings after this restriction.

## Required import integrity gates

1. Correct the nine JSON byte-digest mismatches and prove every transferred row equals source **by digest, id, and count**. Never replace original financial snapshots by an unverified total.
2. Move the **266 content_shadow records** and **42 source_records** only over a secure owner-authorized transfer route that preserves byte representation. Stage these in private tables and scrub/secure any stored connection credentials. No user-facing access until per-account permissions are verified.
3. `owner_identity_map` rows refer to a different Supabase project and do **not** automatically authorize users in the new project; require fresh verified auth linking before assigning campaigns. Zero target `auth.users` rows currently block public `ifund_campaigns` inserts due to FK.
4. Reconcile complete Base44 exports: 95 entity definitions are **schema**, not evidence that 95 source datasets were exported. Source ZIP verified 1,232 GitHub reference files only; no complete original database/media export.
5. PayPal donations, support additions, withdrawal balances, processor fees, and ledger events are financial records: **no verified source-to-provider reconciliation**, so never import or activate financial totals on guesses.
6. The public Cloudflare Pages deployment currently uses **the old project**; do not switch to the new project without data parity and authentication proof. Pages source is still a partial preview.

## Next independently reviewable action

Use an authenticated owner-controlled, secret-safe PostgreSQL-to-PostgreSQL transfer with **no sensitive rows in GitHub, logs, tools, or chat**. Source/target DB credentials must be injected as runtime secrets (not stored in this repo). Transfer in idempotent batches, hash source `jsonb::text` with SHA-256, hash target canonical `jsonb::text`, abort on any mismatch, and record verified counts per entity. Identity/finance activation is a separate explicit gate.

Email service migration is intentionally outside this scope.
