# Original-product parity contract — independent IFund

Source of visual and functional truth: read-only `interplanetarysister/interplanetary-fund2`.
Target: `interplanetarysister/InterplanetaryFund`, independent Cloudflare/Supabase architecture.

## Non-negotiable parity
Keep original branding, layout, typography, responsive placement, page structure, navigation, user journeys, and feature entry points. Replace the underlying Base44 SDK, auth, entities, integrations, automations and storage with independent services. Do not substitute a pared-down prelaunch interface for the finished product. Do not claim a screen is migrated solely because its route renders.

## CampaignDetail source-to-target audit
The original `src/pages/CampaignDetail.jsx` includes these UI modules absent from the current `apps/web/src/pages/CampaignDetail.jsx`:
- CampaignTranslation, FollowButton, UpdatesSection, DistributionPanel
- ShareCampaignKit, CrossPlatformTotals, ImportedCampaignSync
- CashAppSettings, CryptoCampaignSettings
- EditCampaignDetailsDialog, EditAIInstructionsDialog
- OutreachAgentPanel, CampaignHealth, AICoach, DeleteCampaignButton
- DonateDialog (replace its provider calls with verified independent campaign checkout)
- PrelaunchNotice (operational notice only; not part of permanent launch UX)

Original page: 221 source lines; target page: 159 lines at audit. Line counts are only a discovery aid, not proof of parity.

## Implementation rule
For each original module, preserve its intended UX and business rules, identify Base44 calls, implement Supabase/Cloudflare equivalents with server-side access controls, verify real data and workflow outcomes, then mark parity complete. Keep the source repository read-only. Never insert fabricated totals, profiles, donations or successes.

## Release gates
1. Original vs independent screenshot comparison across phone and desktop.
2. Feature-by-feature route and interaction comparison.
3. No runtime request to Base44 endpoints or reliance on Base44 credentials.
4. Auth/permissions, donation ledger, agent workflows, sharing, uploads and social connections work independently.
5. Web and Android app pass equivalent workflows.
6. Build and deployment only when specifically authorized by the owner.


## Checkpoint fidelity and recovery contract
Every checkpoint labeled **full-platform replica** must be independently restorable to the same functioning user experience as the last verified complete original platform. A code commit, partial port, schema-only migration, or screenshot is **not** a certified replica.

A certified checkpoint requires:
- Immutable source revision and matching dependency lockfiles, asset hashes, and Android artifacts where applicable.
- Verified original-versus-target route inventory, visual snapshots at mobile and desktop sizes, and functional acceptance results for every original feature.
- Database schema, migration history, complete authorized data snapshot, object storage inventory, ownership relationships, and tested restore procedure; keep personal data protected.
- Reproducible environment variable **names and secret references**, never secret values in source or checkpoint reports.
- Infrastructure definitions and mappings for Cloudflare, Supabase, domain/DNS, authentication, OAuth, payments, agents, scheduled workflows, and integrations.
- Real provider callbacks, idempotent ledger and withdrawal accounting, permissions, and authenticated user journeys verified against the target.
- Proof of **zero Base44 runtime dependencies**, including network calls, credentials, hosted functions, storage, or workflow execution.
- Restore rehearsal evidence, timestamp, responsible verifier, integrity hashes, and explicit known gaps.

**Labeling:** `development-snapshot` until all gates pass; only `certified-full-replica` after restore and functional verification. Preserve the last known working original checkpoint and never overwrite it with a partial migration. No claim of certification without evidence. No builds/deployments without the owner's specific authorization.
