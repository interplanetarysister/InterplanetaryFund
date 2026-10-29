# Interplanetary Fund independent web app

This is the independent React + Vite + Tailwind web application in `interplanetarysister/InterplanetaryFund`. It does not load the Base44 SDK or call Base44-hosted functions. The original application is retained in a separate repository as read-only migration evidence.

## Runtime

- React 18 and React Router
- Supabase Auth and Postgres using the canonical independent project
- Cloudflare Pages for the web frontend and Cloudflare Workers for independently implemented API routes
- Node 22.x for CI and build verification

## Environment

| Variable | Use |
| --- | --- |
| `VITE_SUPABASE_URL` | Canonical Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key (preferred) |
| `VITE_SUPABASE_ANON_KEY` | Legacy browser-safe anon key fallback |

Never place a service-role key or provider secret in a `VITE_*` variable. Worker-only configuration is separate from browser environment variables.

## Development and verification

From the repository root:

```sh
npm ci --no-audit --no-fund
npm test
npm --prefix apps/web test
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web exec -- vite build
```

The independent CI currently verifies 103 Worker/contract tests, 130 web regression tests, the source inventory, backend coverage, runtime-independence scan, and a Vite compile. The Vite command is deliberately run directly in CI so the code can be compile-checked while the production evidence gate remains closed.

`npm run build` invokes the `prebuild` release gate. It is expected to stop until all required release evidence is true. Do not remove or bypass that gate to force a deployment.

## Current completeness

The historical route inventory contains 59 routes:
- 44 are partial implementations;
- 15 remain explicit placeholders;
- 0 are verified as release-complete.

The app's route list, entity/function/agent/workflow/connector inventories are mapping aids, not evidence that the corresponding feature is live. Public-profile visibility, first-time signup/login in a real browser, legal-consent persistence, full campaign creation and AI assistance, backend parity, media migration, mobile/Android behavior, and production provider setup still require proof.

Campaign creation currently supports content-only draft saving and publication. It does not activate donations, checkout, withdrawals, or external platform distribution. The requested AI-generated five-title choices, two short-description choices, story generation/regeneration, and signature-style AI cover generation still need an independent provider-backed implementation; do not display a fake success or placeholder image.

## Security and data boundaries

- Member access requires provider-confirmed email and server-verified identity; UI guards do not replace Worker authorization or Supabase RLS.
- Public campaign reads are restricted to active records. Draft access and changes are owner-scoped.
- Do not infer ownership from names, email display strings, or campaign titles.
- Historical migration SQL is staged only until separately reviewed and explicitly applied.
- No source user records, campaign records, media, donations, credentials, or payment secrets are assumed imported.

## Branding and historical provenance

The independent frontend uses local brand assets and its own runtime configuration. References to Base44 or Convex in `docs/migration/` describe historical source behavior and migration/retirement evidence only; they are not dependencies of the independent app.
