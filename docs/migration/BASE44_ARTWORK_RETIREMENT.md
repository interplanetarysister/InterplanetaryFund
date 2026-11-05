# Base44 artwork retirement — preservation ledger

Status: IN PROGRESS. Original frontend source: `interplanetarysister/interplanetary-fund2/main`.

## Verified completed
- Original homepage hero was copied from the public Base44 media URL into `apps/web/public/images/base44-archive/19cbf6ba785409de9ac0.png`.
- `apps/web/public/images/base44-archive/manifest.json` records the source, local path, byte length and SHA-256 digest.
- The homepage now references the local Cloudflare Pages asset rather than Base44. Integration commit `aff755fa` passed frontend and release-candidate CI and deployed to preview.
- `scripts/archive_base44_artwork.py` inventories public Base44 media URLs found in the destination frontend and archives supported images; the GitHub Actions archive job completed successfully.

## Remaining before Base44 retirement
1. Inventory all original `interplanetary-fund2` static artwork, platform logos, mobile splash assets, favicon and app icons. Copy only needed files into the appropriate destination paths and verify licensing/brand usage.
2. Inventory all Base44 image references in original frontend source, not only destination source; archive all publicly accessible images and verify SHA-256 hashes.
3. Export authenticated/private campaign media and user uploads with appropriate owner permissions and access controls. Do **not** make private media public or commit personal uploads to Git.
4. Move campaign uploads and AI-generated artwork to Supabase Storage or Cloudflare storage with explicit bucket policies, ownership enforcement, file validation, and stable application URLs. Record original-to-destination mappings.
5. Audit CSS, JSX, database content, email templates, mobile builds and published articles for remaining Base44-hosted assets. Test missing-image fallbacks and deep links.
6. Verify images render in mobile and desktop previews; preserve originals, dimensions and attribution where required.
7. Retire Base44 media URLs only after all required files are copied, access tested, backups confirmed and final production cutover approved.

## Safety gates
- Public website assets may be committed to the repository; user-generated or private campaign files must go to access-controlled object storage.
- Never treat a successful URL replacement as proof that every media file has been migrated.
- Do not delete original Base44 assets or disconnect Base44 until migration inventory and parity checks are complete.
