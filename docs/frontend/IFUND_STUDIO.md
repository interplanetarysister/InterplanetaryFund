# IFund Website Studio

The Website Studio is the super-admin page builder for Interplanetary Fund.

## Scope

- Creates and edits structured pages stored in the canonical production Supabase project.
- Supports responsive desktop/mobile preview, reusable section types, ordering, draft saving, publishing, public page rendering, and revision history.
- Uses the existing verified-admin RPC for both frontend visibility and server-side authorization.
- Does not directly modify application source code. Source-code changes are handled through the GitHub build/release pipeline; the next builder capability is a repository-connected code workspace with a narrowly scoped GitHub App installation.

## Cost policy

- No paid AI provider is used.
- AI layout assistance uses Cloudflare Workers AI only when the free binding and daily quota are available.
- The structured editor remains usable when AI is disabled or its free quota is exhausted.
- No automatic paid fallback, upgrade, or metered provider is permitted.
- If a free provider is unavailable, the builder must continue with manual editing and the normal GitHub/Cloudflare release path.

## Security and automation

- Admin access is checked server-side; client metadata is not authorization.
- Page updates use optimistic concurrency so a stale browser tab cannot overwrite a newer revision.
- Switching pages saves a dirty draft first; editor controls are disabled while a save is pending.
- Published pages are public-read only. Drafts and revision history are administrator-only.
- Page deletion is intentionally unavailable so published URLs and history are not destroyed.
- Publishing a page is an explicit content action, but routine save, versioning, and build checks do not require a second human approval.

## Release checks

- Preview build runs the changed Studio API test file plus the complete `apps/web` production build. The full legacy repository suite is already independently verified and is too long to repeat inside the Pages build timeout.
- Pages Functions route `/api/*` through the same Worker router used by the migration API, with the migration preview gate remaining disabled.
