# Interplanetary Fund

Fresh repository for the Interplanetary Fund platform on **Supabase + Cloudflare**.

- Migration instructions: issue #137
- Read-only source app: `interplanetarysister/interplanetary-fund2` (Base44)
- Pre-migration files (Convex backend, fundforge, agent docs, QA reports) are preserved on the branch `archive/pre-migration-2026-10-24` and in git history. They are reference only and are not the source of truth.

## Phase 1 migration review

The active Phase 1 PR is made against `migration/supabase-cloudflare` (not `main`). See `docs/migration/{STATUS,BLOCKERS,INVENTORY}.md`. This is a preview scaffold, not a complete application migration. No Base44 data, passwords, donations, media, or payment secrets have been moved. Do not deploy or switch DNS.

Local setup (when npm registry access is restored): `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, review and commit `package-lock.json`, then `npm ci --ignore-scripts --no-audit --no-fund`, `npm test` and `npm run build`. Set only the publishable Supabase key in `.env.local` to use a **staging** database after the migration SQL has been reviewed. Current untested schema file is `supabase/migrations/20261025011400_initial.sql`. Do not apply it to the connected live project.
