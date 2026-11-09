# Mandatory Base44 → Supabase / Cloudflare data-parity contract

**Effective:** 2026-11-09 UTC. **Status:** preservation staged; **not** a production cutover.

This adds a mandatory data-parity gate to the architecture contract and AGENTS.md. The original Base44 app remains a functional/source-data reference until verified owner-approved retirement. The authoritative implementation remains the existing `InterplanetaryFund` app on Cloudflare Pages/Workers + Supabase. Do not make a separate backend or restore Convex/Vercel.

## Every change must preserve source data

For each new or changed Base44 feature, page, function, campaign field, agent, payment integration, or source entity:

1. **Inventory** the source entity name and fields, current row counts, owners, legacy IDs, timestamps, attachments, consent and data classification. Inspect the actual Supabase schema and Cloudflare bindings before adding resources.
2. **Map** structured records into the existing Supabase project `ssibsfmtodgximseeqsv`, using explicit additive migrations, RLS, safe column grants, idempotent imports and verified owner identity mapping. Store original IDs and source timestamps; do not silently regenerate relationships or overwrite verified destination records.
3. **Preserve source evidence first** in `ifund_stage.base44_source_mirror` (private, RLS enabled and no browser-user grants). Source snapshots are **not** live account privileges, posted campaigns, verified donations, financial balances or accepted legal consent on the new system. Promotion requires independent validation and canonical ownership.
4. **Map asset bytes separately:** use the existing Cloudflare R2 bucket `ifund-media` and Supabase Storage private bucket `ifund-media`. Track originals in `ifund_stage.base44_media_import_queue`; use its stable target keys. Require HTTPS host allowlists, content-type and file-size validation, explicit authorized access, SHA-256/ETag and retrieval verification in **both stores** before marking an asset copied/verified. A URL reference or import-queue row is not a copied file. Keep buckets private until access policies are tested.
5. **Mirror only nonsensitive operational metadata** to Cloudflare KV. The existing `IFUND_INTEGRATION_REGISTRY` namespace has the key `ifund-migration-base44-parity-v1` for aggregate counts and migration policy. KV must never be the payment ledger, authoritative user account store or repository of personal data, credentials, OAuth tokens or signed media URLs.
6. **Security gates:** do not migrate raw passwords, device tokens, API keys, encrypted credential vaults, secret references or authentication/session values. Reauthorize integrations using their approved provider mechanisms. Preserve legacy roles and consent only as evidence, not authority. Never claim verified money without PayPal provider proof and idempotent ledger reconciliation. The 7% platform fee is deducted only at owner withdrawal.
7. **Verify before progressing:** compare counts **and** stable IDs/hashes; reconcile owner mapping, missing rows, deletes, uploads and permission denials; run negative tests and a rollback/preview smoke test. Never change production DNS, payout gates or decommission Base44 because a migration copy was created.

## Verified state — 2026-11-09 UTC

- **Source:** original Base44 iFund app (96 entity schemas inventoried). A direct read found 35 Base44 Campaign rows but only four records in operational `public.ifund_campaigns`; those are not proven matches.
- **Private Supabase source mirror:** 2,805 sanitized source-record snapshots across 59 source models, including campaigns, posts, distribution history, recommendations, audit metadata, authorization metadata, PayPal subscription webhook metadata, feature flags and registry records, user identity references, notifications, drafts, waitlist, and agent/activity history. The source model/legacy ID combination is an idempotent primary key. Backfilled data was not inserted into operational user-facing or financial tables.
- **Explicitly excluded credentials:** `UserCredentialVault` ciphertext/IV/salt and `RateLimitBucket` ephemeral counters are not imported; raw `PlatformConnection.credentials`, key hashes, device authorization hashes and token fields are excluded. Only safe identifying metadata from DeviceAuthorization and ExternalAgentApiKey was staged. Unverified identity and authentication material must never be replayed.
- **Media:** 64 source references, 38 unique URLs, recorded in the private media manifest; **zero verified byte transfers** to either R2 or Supabase Storage at this checkpoint. Cloudflare `ifund-media` already existed; Supabase private `ifund-media` was created. Treat all assets as pending.
- **Payment metadata:** `ifund_finance.pay_pal_campaign_webhook` is a new private, RLS-enabled, deny-by-default registry matching the Base44 campaign webhook data contract. It has **zero rows** until the provider registration is verified. A Base44 subscription webhook row is merely source evidence. Payment and payout activation remain disabled.
- **Security:** the source mirror and PayPal campaign registry have RLS enabled, with zero browser-user policies and privileges revoked from `PUBLIC`, `anon` and `authenticated`. Their no-policy state is intentional deny by default, not an access bug.
- **Cloudflare:** an aggregate-only policy/status record exists at KV key `ifund-migration-base44-parity-v1`, in the existing `IFUND_INTEGRATION_REGISTRY` namespace. This is not a replicated personal-data database.

## Remaining reconciliation / operational work

1. Compare each staged row with the intended canonical Supabase table and verify exact identity/ownership crosswalk before promoting. Operational tables remain partially populated; do not assume equivalence from shared titles or equal totals.
2. Build and test incremental Base44-to-Supabase source sync with narrowly scoped credentials and batching/retries. Backfill newly discovered models and deltas, including deletes; stop on permission or schema conflicts. The current snapshot is one-time, not proof of ongoing automatic sync.
3. Transfer/verify the 38 distinct authorized media files into both private stores and update URLs only after access tests. Keep original Base44 files until full reconciliation.
4. Finish PayPal campaign webhook registration/provider OAuth/sandbox acceptance, then provider-verified payment ledger and 7%-at-withdrawal tests. Never copy source webhook metadata as if it were provider verification.
5. Include the parity check in every feature implementation, migration review, preview acceptance, and owner sign-off. The original 59-route/184-entrypoint acceptance gate still applies.

**Audit rule:** report `SNAPSHOTTED`, `IMPORTED`, `PROVIDER_VERIFIED`, `ASSET_BYTES_VERIFIED`, and `LIVE` as separate states. Never conflate them.
