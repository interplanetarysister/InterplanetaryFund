# IFund Studio — initial implementation

This branch adds the first independent Studio foundation to the migration integration branch.

## Included
- Admin-only frontend entry at /admin/studio.
- Server-side role verification against Supabase Auth app_metadata.role for admin and super_admin.
- Cloudflare Worker API for structured page documents.
- Supabase migration defining Studio page storage and matching RLS policy.
- Section editing, drag/drop reordering, accessible move controls, responsive preview, and draft persistence.
- Strict block validation; no arbitrary HTML or script execution.

## Deliberate boundaries
- Studio pages are separate from the live app router. Marking a page published records Studio status only; it does not deploy code or expose a new production route.
- AI code generation and GitHub publishing are not enabled in this first package.
- The Worker preview gate remains disabled by default. The SQL file is a migration artifact only and has not been applied to the connected Supabase project.
- No production deployment, DNS change, payment change, or live data operation is performed by this branch.

## Administrator provisioning
The account must already have a trusted Supabase Auth app_metadata.role value of admin or super_admin. This role must be set through a trusted administrative process, never through browser profile fields or a client request. The frontend hides the entry point for other roles; the Worker and Postgres RLS independently enforce access.

## Next package
Add an owner-approved, audited server-side publishing adapter that translates Studio documents into reviewed application changes. Keep GitHub credentials server-side, require preview and review, and preserve branch protections and release gates.
