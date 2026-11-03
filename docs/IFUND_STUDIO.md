# IFund Studio — initial implementation

This branch adds the first independent Studio foundation to the migration integration branch.

## Included
- Admin-only frontend entry at /admin/studio.
- Server-side role verification against Supabase Auth app_metadata.role for admin and super_admin.
- Cloudflare Worker API for structured page documents.
- Supabase migration defining Studio page storage and matching RLS policy.
- Section editing, drag/drop reordering, accessible move controls, responsive preview, and draft persistence.
- Public renderer at /p/:slug for published documents; public API and RLS expose published rows only.
- Strict block validation; no arbitrary HTML or script execution.

## Deliberate boundaries
- Published Studio documents render at /p/:slug once the frontend and Worker are deployed and the Studio migration is applied. This publishes structured content, not application code, and does not modify existing application routes.
- AI code generation and GitHub publishing are not enabled in this first package.
- The Worker preview gate remains disabled by default. The SQL file is a migration artifact only and has not been applied to the connected Supabase project.
- No production deployment, DNS change, payment change, or live data operation is performed by this branch.

## Administrator provisioning
The account must already have a trusted Supabase Auth app_metadata.role value of admin or super_admin. This role must be set through a trusted administrative process, never through browser profile fields or a client request. The frontend hides the entry point for other roles; the Worker and Postgres RLS independently enforce access.

## Next package
Add an owner-approved, audited server-side publishing adapter that translates Studio documents into reviewed application changes. Keep GitHub credentials server-side, require preview and review, and preserve branch protections and release gates.


## Verified deployment and access blockers (2026-11-03)

- The Cloudflare Pages project that owns interplanetaryfund.com currently has production and preview deployments disabled. Its stored Git source configuration names interplanetary-fund2, while the latest recorded deployment was built from InterplanetaryFund main. Do not assume a new branch will deploy automatically.
- Existing domain Worker routes still point to the legacy interplanetary-fund2 Worker and a separate catch-all Worker. The migration API Worker is not routed for /api/studio/* yet.
- The existing migration API Worker has the preview flag and publishable-key binding, but its current settings do not include the required SUPABASE_URL binding. Its readiness check therefore cannot pass. No route or binding was changed.
- A read-only check of the currently configured Supabase Auth project found three accounts and no account with app_metadata.role set. No role was assigned. The owner must identify which existing sign-in account should receive the admin role before Studio can be opened by that account.
- The Supabase Studio migration has not been applied. The Supabase preview branch integration is disabled, so this PR does not have an isolated Supabase preview database.

These are release and account-provisioning blockers, not reasons to weaken role checks or switch live traffic.

## AI-assisted layout generation

- The Worker includes a Cloudflare Workers AI layout-generation endpoint using GLM-4.7-Flash. It returns structured page sections only; it does not execute or generate application code.
- Generated content is schema-validated and returned as an unsaved draft. An administrator must review and explicitly save it.
- A private database quota function limits generation to two requests per platform per UTC day.
- The AI binding is present in Wrangler configuration, but IFUND_STUDIO_AI_ENABLED is deliberately set to disabled. Do not enable it until the account's Workers plan and free allocation are confirmed.
- Cloudflare documents a 10,000-Neuron daily free allocation for Workers AI. Workers Free requests fail after the free allocation; Workers Paid usage above the allocation is billed at $0.011 per 1,000 Neurons. This project must not upgrade or incur AI charges without explicit owner approval.
- GLM-4.7-Flash is listed among models available on Workers Free. The generation endpoint uses prompt-constrained JSON and validates the returned structure because this model is not listed in Cloudflare's JSON Mode supported-model list.

References:
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/changelog/product/workers-ai/
- https://developers.cloudflare.com/workers-ai/features/json-mode/
