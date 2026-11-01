# IFund Admin AI Connections consolidation — 2026-10-13

## Scope and result
The old standalone administrator `/connect` instructions for external MCP assistant clients now appear under **Admin Integrations → AI Connections**, with the route `/admin/integrations?view=ai`.

- The existing `src/pages/Connect.jsx` instructions are reused as a component inside `src/pages/IntegrationsAdmin.jsx`; no new external services or libraries.
- The administrative navigation now has **Admin Integrations** instead of the redundant **Admin connection setup** entry.
- Legacy `/connect` links redirect to `/admin/integrations?view=ai`; saved links remain useful.
- The existing `/admin/integrations` provider registry is still present in the same page as the **Provider integrations** section.
- The MCP endpoint `/api/mcp`, `base44/mcp/config.json`, and the OAuth consent route `/oauth/consent` are preserved without changing their behavior.
- Built-in IFund agents under `/agents` remain separate from external AI clients. No agents, entities, permissions, credentials, or provider integrations were deleted.
- UI navigation remains admin-gated by `AdminRoute` and by `IntegrationsAdmin`'s own administrator check.

## Limits
This is a UI/navigation consolidation, not a new provider connection. No new MCP grant list, in-app token revocation endpoint, or client connection status checker was implemented. External clients continue to handle their connection setup and their own credential revocation; the user approves/denies requests via the existing IFund OAuth consent flow.

## Open-source discovery and reuse decision
GitHub code search was performed for `MCP OAuth connect server` prior to modification. No third-party source is needed for a two-tab admin UI and a legacy route redirect. Reusing IFund's existing React Router, Base44 MCP OAuth infrastructure, and previously implemented content minimizes security risk, dependency licensing and maintenance work, and operating costs. No hosted service or package was added.

## Verification
- `npm run build`: passed, including route, bundle, accessibility-related selector and provider readiness contract checks.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `node scripts/verify-mobile-layout-contract.mjs`: passed.
- `node scripts/test-oauth-delegation-flow.mjs`: passed.
- `node scripts/verify-admin-authorization-contract.mjs`: passed.
- `node scripts/verify-ifund-links-assets.mjs`: passed.
- Additional static checks: legacy path redirect, admin guard precedes AI content, all MCP/OAuth files and routes preserved.

## Rollback
Restore the Base44 checkpoint preceding this change, or revert the limited edits to `src/App.jsx`, `src/components/Layout.jsx`, `src/pages/Connect.jsx`, and `src/pages/IntegrationsAdmin.jsx`. OAuth settings must not be reset as part of rollback.

## Deployment
Changes are saved in the Base44 source repository and checkpointed. A successful build is not proof that the latest version is published. Do not claim the production UI is updated until publication/preview is separately verified.
