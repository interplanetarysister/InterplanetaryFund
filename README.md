# Interplanetary Fund

> **What if?** — Independent application rebuild on Supabase + Cloudflare, with Wix as the domain manager.

**Migration branch**: `migration/base44-exit-supabase-cloudflare-wix`. This is **not yet a production-complete Base44 replacement**. Do not switch DNS or unpublish the existing application based solely on this branch.

## Local development

1. Use Node 22+. Install with `npm install` (or `npm ci` once a committed lockfile is generated).
2. Copy `.env.example` to `.env.local` and add only the *publishable* Supabase key. Never commit a service-role key.
3. Review and apply `supabase/schema.sql` to staging first, then test RLS and publishing.
4. Run `npm run dev`, `npm test`, and `npm run build`.
5. Once deployment settings and usage are approved, `npm run deploy` publishes the Cloudflare Worker plus built static assets. Configure the Wix domain to route to Cloudflare only after migration gates pass.

## Architecture

- `src/`: React browser app. Authentication and row-level access via Supabase, no Base44 client.
- `supabase/schema.sql`: isolated `ifund_*` tables with RLS. Existing admin-mail tables are untouched.
- `worker/`: Cloudflare Worker route handlers; `wrangler.jsonc`: SPA static assets.
- `docs/MIGRATION.md`: truth-based cutover checklist and remaining migrations.

Current preview does **not** process payments, withdraw funds, grant admin privilege, or claim platforms are connected. These must be implemented and verified before live cutover.
