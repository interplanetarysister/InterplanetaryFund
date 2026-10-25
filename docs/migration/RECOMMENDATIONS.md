# Recommendation migration preparation (Phase 6)

Authority: [migration issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).

The source repository is **read-only**. This script **never** calls Base44 or Supabase and cannot modify a database.

1. Owner obtains an authorized complete JSON array export of all 836 Base44 `Recommendation` records into a private location. The export must include the original `id` and `title` for every record.
2. In a trusted Node.js environment, run:
   ```sh
   node scripts/migration/prepare-recommendations.mjs /secure/recommendations.json /secure/recommendation-batches
   ```
3. Inspect `manifest.json` and nine files `recommendations-01.json` through `recommendations-09.json` (eight groups of 100 and one of 36). Verify each checksum independently before authorizing any import.
4. **Do not import into production** under issue #137. A separate reviewed importer must verify the destination schema, owner authorization, complete source-to-destination field parity, idempotency, and rollback in a nonproduction environment before the owner performs a cutover import.

The prior 100 staging rows contained only a limited set of fields. They are not evidence of full parity; the complete export is required to repair them. The existing Supabase staging data is not modified by this script.

Never commit exports, generated batches, personal data, credentials, or SQL containing live records.
