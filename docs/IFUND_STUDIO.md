# IFund Studio — initial implementation

This branch adds the first independent Studio foundation to the migration integration branch.

## Included
- Admin-only frontend entry at /admin/studio.
- Server-side role verification against protected Supabase `app_metadata.role` or the existing `public.ifund_current_user_is_verified_admin()` function, which validates the original IFund owner identity mapping.
- Cloudflare Worker API for structured page documents.
- Supabase migration defining Studio page storage and matching RLS policy.
- Section editing, drag/drop reordering, accessible move controls, responsive preview, draft persistence, immutable revision history, and safe restore-as-draft.
- Public renderer at /p/:slug for published documents; public API and RLS expose published rows only.
- Strict block validation; no arbitrary HTML or script execution.

## Deliberate boundaries
- Published Studio documents render at /p/:slug once the frontend and Worker are deployed and the Studio migration is applied. This publishes structured content, not application code, and does not modify existing application routes.
- AI-assisted layout generation is implemented as an optional Worker capability but remains disabled by default; AI code generation and GitHub publishing are not included.
- The Worker preview gate remains disabled by default. The SQL file is a migration artifact only and has not been applied to the connected Supabase project.
- No production deployment, DNS change, payment change, or live data operation is performed by this branch.

## Administrator provisioning
Studio reuses IFund's existing verified-admin authorization. The account must either have a protected Supabase Auth `app_metadata.role` of `admin` or `super_admin`, or pass `public.ifund_current_user_is_verified_admin()` through the verified legacy-owner mapping. The mapping checks source ownership, active admin status, verified email, account lifecycle, and uniqueness. The frontend calls this function for navigation; the Worker calls it with the authenticated user's JWT; Postgres RLS calls the same trusted function. Do not set roles through browser profile fields or create a second owner identity system.

## Next package
Add an owner-approved, audited server-side publishing adapter that translates Studio documents into reviewed application changes. Keep GitHub credentials server-side, require preview and review, and preserve branch protections and release gates.


## Verified deployment and access blockers (2026-11-03)

- The Cloudflare Pages project that owns `interplanetaryfund.com` is `interplanetaryfund-migration`. Its stored Git source points to `interplanetary-fund2`, and production and preview deployments are disabled. The independent-repository projects are separate `pages.dev` projects and do not own the custom domain. Do not assume a new branch will deploy automatically.
- Existing domain Worker routes still point to the legacy interplanetary-fund2 Worker and a separate catch-all Worker. The migration API Worker is not routed for /api/studio/* yet.
- The existing migration API Worker has the preview flag and publishable-key binding, but its current settings do not include the required SUPABASE_URL binding. Its readiness check therefore cannot pass. No route or binding was changed.
- A read-only check found three authenticated accounts with three distinct, fully verified active-admin mappings to the original IFund source identity. None needs a new `app_metadata.role` assignment for Studio access. The Studio Worker and RLS now reuse the existing verified-admin function; no role or identity mapping was changed.
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
