# Original Base44 frontend: executable preview handoff (2026-11-09)

Authority: issue #203. Canonical original UI: `interplanetarysister/interplanetary-fund2@936d35924bef8e5dd3b232821491ddb3f35cb562` (main observed in this run). Deployable repository: `interplanetarysister/InterplanetaryFund`. Integration target: `migration/base44-frontend-parity-20261103`; lead architect changes confined to `agent/lead-architecture` and PR #205. Source SHA is a snapshot, not a claim of a completed import.

## Frontend handoff and stop conditions

1. Frontend owner, on their own branch: compare the source tree, public assets, route map, mobile navigation, campaign wizard, and Base44 SDK configuration against the canonical source SHA. Preserve original behavior; no reconstructed substitutes. Produce a file-level import manifest with source paths, destination paths, and SHA-256 digests for copied binary assets.
2. Keep the currently working Base44 SDK, auth, data, and functions during this frontend-only phase. Do not replace, disable, or remove any dependency unit without a later, separately authorized unit-level migration.
3. Build the actual imported frontend from the existing repository build configuration. Do not substitute a simplified static page or silently change the Pages output directory. Confirm build output and SPA fallback before publishing a branch preview.
4. Deploy **preview only**. Record the Cloudflare deployment ID, branch, exact commit SHA, immutable deployment URL, and build status. Do not treat a production or reconstructed-UI deployment as proof of original frontend parity.
5. At mobile widths 360px and 390px, and at desktop 1280px, inspect homepage artwork, navigation, discovery, campaign detail, original AI wizard (five title options, two short descriptions, one story at a time with per-section regeneration), image upload/AI art choices, draft preview, and safe-area behavior. Save screenshots or video tied to the immutable preview URL.
6. As an unauthenticated guest, browse and compose a draft without forced login. Verify Save and Publish request authentication, preserve the exact draft through sign-up, and restore the draft on return. Do not falsely mark a draft published.
7. With an authorized test account, verify actual Base44-backed reads and nonfinancial draft operations from the **preview origin**, including CORS, cookies/session, callback routing and redirects. Verify failure paths without creating live financial events or public demo spam.
8. Review the full evidence packet and run `node docs/architecture/tools/verify-agent-release-evidence.mjs --preview <evidence.json>`. The validator checks evidence *shape*, not authenticity; reviewer must inspect screenshots, URLs, deployment logs and receipts.
9. On a preview failure, fix the defect on its owning branch, retest, and keep production untouched. Preserve the previous preview and original Base44 runtime as rollback references. Merge only after CI and peer review. Production remains gated by distinct financial, RLS, auth, rollback, and explicit owner-approval evidence.

## Cross-platform configuration inventory

Cloudflare Pages project: `interplanetaryfund-migration`, GitHub connected, production branch `main`. Preview Pages variables observed previously: `NODE_VERSION`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Production additionally has `NPM_VERSION`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`. These names are an inventory, not a directive to copy secret values or change runtime adapters.

Supabase production project: `ssibsfmtodgximseeqsv`; keep owner-scoped RLS and financial functions unchanged in the frontend-only phase. Never put a Supabase secret/service-role key into a VITE-prefixed variable or a public GitHub document. Existing preview service bindings for Strategy, Growth, Story, Communications and Connections must not be switched without independently tested parity.

## Evidence gaps and permissions

The Cloudflare deployment-list read in this run requested interactive authorization and therefore did not complete. No current immutable preview deployment ID, screenshot, or successful Base44 preview session was established. This is an evidence gap, **not** proof that deployment is broken. Request connected Cloudflare authorization through the normal owner flow when available; do not guess deployment status. This document itself does not deploy or modify another agent's branch.

No production DNS, live payments, Base44 retirement, or unrelated agent activation is authorized by this handoff.
