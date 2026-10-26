# Cached snapshot transfer — October 25, 2026

Scope: Phase 6 of issue #137. The owner requested completion of the migration. This report records private staging writes actually performed, not production feature parity.

## Verified result

Source: the existing private migration caches in Supabase project `tzehxfikoslihnclhxuz`. Destination: the existing `ifund_transfer` schema in designated project `ssibsfmtodgximseeqsv`.

- **741 previously absent records inserted**: 266 content snapshots, 42 campaign-update/connection snapshots, 397 activity-history snapshots, 26 delegation-history snapshots, and 10 identity-map snapshots.
- **27 pre-existing campaign snapshots reconciled**. All recorded source digests matched the source before repair. Nine destination payloads had JSON numeric serialization differences. A guarded UPDATE replaced only payload representations when the old/new JSONB values were equal, the stored digest matched the current source digest, and both authority flags were false. All 27 now match exact source SHA-256.
- **768/768 cached payloads verified** by recomputing SHA-256 from destination JSONB text and comparing against the source ID/digest pairs. Counts: `campaign_snapshots=27`, `content_snapshots=266`, `source_snapshots=475`. All 741 newly copied IDs matched independent destination reads.
- Transfers used batches of 50, 100, 100, 16, 42, 100, 100, 100, 100, 33. Inserts used `ON CONFLICT DO NOTHING`; no source records were deleted or changed. No runtime user/campaign ownership was assigned.
- All four `ifund_transfer` tables still have RLS enabled. Both `anon` and `authenticated` lack schema USAGE and table SELECT privileges. Source/financial authority flags remain false.
- Updated 18 private source-inventory groups with counts and explicit cache-only provenance. No raw row contents, private IDs, emails, credentials, or generated transfer SQL are included in Git.

| Cached source | Records | Destination |
|---|---:|---|
| content_shadow / Agent | 10 | content_snapshots |
| content_shadow / AgentConversationRun | 13 | content_snapshots |
| content_shadow / Community | 2 | content_snapshots |
| content_shadow / DiscussionPost | 2 | content_snapshots |
| content_shadow / FeatureFlag | 24 | content_snapshots |
| content_shadow / FoundingWaitlist | 2 | content_snapshots |
| content_shadow / HelpArticle | 6 | content_snapshots |
| content_shadow / Notification | 94 | content_snapshots |
| content_shadow / PublicProfile | 2 | content_snapshots |
| content_shadow / Recommendation | 100 | content_snapshots |
| content_shadow / SocialPost | 10 | content_snapshots |
| content_shadow / SupportTicket | 1 | content_snapshots |
| source_records / CampaignUpdate | 10 | source_snapshots |
| source_records / PlatformConnection | 32 | source_snapshots |
| agent_activity_shadow / private historical snapshot | 397 | source_snapshots |
| agent_delegation_shadow / private historical snapshot | 26 | source_snapshots |
| owner_identity_map / private historical snapshot | 10 | source_snapshots |
| campaign_shadow / Campaign | 27 | campaign_snapshots |

## Repeatable tools

`scripts/migration/snapshot-transfer.mjs` accepts JSONL rows containing `entity_type`, `source_id`, exact PostgreSQL `source_payload::text AS payload_text`, and `encode(extensions.digest(source_payload::text,'sha256'),'hex') AS payload_sha256`. Source snapshots may also carry `source_owner_id`, `source_updated_at`, and `original_payload_sha256`. Do not round-trip payload text through JavaScript numeric values. Historical agent/identity projections use their qualified source-relation names as entity types; they are not misrepresented as original Base44 entity exports.

Read-only source query pattern (use the authorized project connection):

```sql
select entity_type, source_id,
       source_payload::text as payload_text,
       encode(extensions.digest(source_payload::text, 'sha256'), 'hex') as payload_sha256
from ifund_migration.content_shadow
order by entity_type, source_id;
```

Keep exports and generated SQL in private local files. The tool does not connect to any database, execute SQL, provision accounts, or publish data. It verifies input hashes, rejects duplicate IDs, emits at most 100 records per statement, writes SQL with mode 0600, and refuses overwriting an existing file. Example:

```sh
mkdir -m 700 migration-data
node scripts/migration/snapshot-transfer.mjs content /secure/content-source.jsonl migration-data/content.sql
node scripts/migration/snapshot-transfer.mjs source /secure/source-source.jsonl migration-data/source.sql
node scripts/migration/snapshot-transfer.mjs verify /secure/content-source.jsonl /secure/content-destination.jsonl
```

Execute reviewed generated SQL only through the authorized destination connection. Re-export actual destination `source_payload::text` and recompute its digest; copying the recorded digest alone is not proof. Exit code 0 plus `ok:true` is required for exact set/payload verification. Console summaries omit records.

## Runtime gates still open

This proves copying the **available Supabase caches**, not a complete 95-entity Base44 export. Cached Recommendations contain only 100 entries; previous historical claims of 836 are not reconciled by this transfer. Uploaded source ZIPs contain application definitions/code, not a complete verified live row export. Migration control/checkpoint rows were not activated in the destination.

The destination still has **zero Auth users, zero public campaigns, zero public posts**. No owner consent or role claim was fabricated. Provider grants, payments/webhooks/payouts, media bytes/watermarking, independent agents/workflows, and full frontend parity remain incomplete.

`scripts/migration/verify-owner-rls.sql` provides a 17-check rollback-only synthetic database-role probe. Its execution attempt returned an invalid/expired request-state error; it is **UNVERIFIED**, not a pass. A fresh read confirmed Auth users, public campaigns and public posts remained at zero. This script does not prove real Supabase Auth sign-in or token issuance even if it passes later. Inspect user-defined triggers before running synthetic fixtures.

## Validation

Local Node v24.22.1: `npm ci --ignore-scripts --no-audit --no-fund` passed (152 packages); `npm test` passed **77/77** (including seven snapshot-transfer tests); `npm run build` passed (Vite 6.4.3). These are local no-provider build/unit checks, not browser/Auth/payment integration proof. SQL readback verified all snapshot hashes and private access restrictions as described above.

## Hosting correction already performed in this conversation

Cloudflare Pages deployment `a77758ec-ee5a-4a16-be6b-cfce55119c8f` succeeded with frontend Supabase settings pointing to the designated project. It deploys `migration/phase7-offline-cutover-gate`, commit `ffc117349756c95cbe661d9e05ccc6fdcf63d6ae`, not the integration branch. Website DNS already points to Pages. This does not establish completion of Phase 7 or justify removing the Base44 source. The owner reported Base44's email domain verification complete; end-to-end internal inbox send/receive remains unverified.

