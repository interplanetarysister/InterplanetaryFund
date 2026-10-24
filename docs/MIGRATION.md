# Base44 exit plan — replacement repository

## Inventory and ownership
- Canonical repository: `interplanetarysister/InterplanetaryFund`, migration branch `migration/base44-exit-supabase-cloudflare-wix`.
- Reference-only source repository: `interplanetarysister/interplanetaryfund-base44`; the replacement does not import Base44 SDK, embed Base44 domains, or require Base44 credentials.
- Connected Supabase project ID: `tzehxfikoslihnclhxuz` (us-west-2). The snapshot reviewed 2026-10-24 had only three existing admin-mail tables, **not** campaign data; no claim is made that Base44 campaign records have already migrated.
- Cloudflare deployment target: `interplanetary-fund` Worker. Wix retains DNS ownership until an explicit verified cutover.
- Branding, platform names, and truthful AI campaign-generation guidelines were inspected in Base44 source; adapted portable brand/platform code lives under `src/lib`.

## Migration gates before publication
1. Export full Base44 datasets, auth identities, media objects, attachments, custom entities, and function workflows. Verify independent archive and totals. A git source export is **not** an application data export.
2. Inventory all old database collections and resolve entity-to-Supabase mapping, field compatibility, ownership, relationship, deduplication, and withdrawals/donations ledger. Import with checksums and counts. Never fabricate financial records.
3. Create the staging schema from `supabase/schema.sql`; verify RLS (owner vs other account vs anonymous), and validate draft/save/publish tests. Confirm primary domain login/reset emails and return URLs.
4. Re-implement payment provider capture/webhooks and refunds, payout/withdrawal ledger, platform OAuth publishing, real successful sync, social agent task workflows, admin authorization, media watermarking, subscriptions, and AI generation using real APIs. Do not mark any integration connected until verified live.
5. Finish compatibility QA across desktop/Android, accessibility, performance, consent/terms, and public anonymous donate paths. Verify all exported record counts and media accessibility.
6. Deploy to Cloudflare staging using explicit owner-approved resource usage. Set Cloudflare Worker environment secrets outside Git. Point Wix domain to Cloudflare **only after** owner approves cutover and full transaction QA passes; roll back via Wix DNS if needed.
7. Move Base44 to read-only, ensure no lost writes via dual-write or tested delta export, and only unpublish it after final reconciliation.

## Current new repository scope
- Fresh React/Vite portal, public campaigns, community feed, account registration/sign-in, draft save, publish, edit, connection status page.
- Supabase-authenticated CRUD with strict RLS schema provided; payments and provider connections intentionally show unimplemented status rather than simulate successful processing.
- Cloudflare Worker SPA with /api/health; no paid builds or live changes triggered by repository creation.
- Source history of the former repository remains in Git commits for recovery.

## CodeRabbit migration instruction
@coderabbit implement complete migration of interplanetary fund application off of base 44. Transplant needed files to maintain the application, and web versions to the InterplanetaryFund repo.
