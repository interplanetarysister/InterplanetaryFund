# Uploaded ZIP source intake — 2026-10-25

Source: \`interplanetaryfund (2).zip\`, SHA-256 \`e14131d5660d450bdea4bd5169beb6825698c88f294aacc4f4a804242dedd8cd\`.

The ZIP was independently inspected file-by-file, and every archive member's Git blob SHA was calculated locally. The pinned read-only source's Git tree returned **the same 1,238 filename + blob-SHA pairs**: SHA-256 of the lexicographically sorted `path<TAB>git-blob-sha<LF>` records is `8f7af90a8feaced978d029a27737408cb605e264e91af5d38e6682c6be281885` for both. This establishes matching content for all 1,238 ZIP files against the pinned GitHub source. The source also has nine `.github` files that are not present in the ZIP and were excluded. The 1,232 imported files were subsequently verified against the target branch's Git tree, with **1,232/1,232 matching blob SHAs**.

- Imported as inactive migration reference: **1232 files**.
- Withheld pending credential review: **6 files**.
- Entities: 95 definitions; backend function directories: 184; frontend pages: 57.
- Existing Supabase/Cloudflare implementation has not been replaced.
- Source configurations and code still depend on Base44 and must be ported separately.
- No production database rows or complete ledger/user exports are included.

See \`migration/reference/2026-10-25-base44-export/SOURCE_MANIFEST.json\` for exact file checksums, exclusions, and paths. Do not deploy this archive or merge into \`main\` without migration review.
