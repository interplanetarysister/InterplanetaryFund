# Interplanetary Fund public site (apps/web)

Standalone React + Vite + Tailwind port of the public pages of the Interplanetary Fund web app, taken from the Base44 export (`migration/reference/2026-10-25-base44-export/`). It has no Base44 dependencies.

## Run locally

```bash
cd apps/web
cp .env.example .env.local   # fill in publishable values
npm install
npm run dev                  # http://localhost:5173
npm run build                # outputs dist/
npm run preview
```

Node 20 or newer.

## Environment variables

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (canonical project `ssibsfmtodgximseeqsv` only) |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key only. Never a service-role key. |

Never commit real values. Without them the site still renders, and Discover and Campaign pages show the original "couldn't load" retry card.

## What is ported

- `/` Home, `/about` About, `/terms` Terms, `/privacy` Privacy
- `/discover` Discover and `/campaign/:id` Campaign detail, inside the original Layout (sidebar, mobile header, drawer, bottom nav, quick actions, back-to-top, legal footer)
- The original `index.css`, `styles-ifund-studio.css`, Tailwind config, shadcn ui components actually used (button, input, badge, progress, skeleton, dialog, image), brand assets, copy, and the light/dark theme logic from `App.jsx`
- Every route from the original app that is not ported yet stays linked and opens a branded "Coming soon on the new platform" page. Unknown routes show the original 404 page.

## Data

`src/api/publicData.js` uses `@supabase/supabase-js` and the anon key:

- Campaign list: RLS-filtered read of `public.ifund_campaigns`, requiring `status=active`; the original cards use the stored real title, summary, story, category, cover image and goal. Raised totals and donor counts remain `null` until independently reconciled.
- Campaign detail: public lookup by canonical UUID with the same `status=active` restriction. The earlier proposed `ifund_public_campaign_detail` RPC is no longer required and its pending old-project SQL must NOT be applied for this frontend.
- The public data client explicitly rejects Supabase URLs outside `ssibsfmtodgximseeqsv`; do not mix old Worker/JWKS secrets or project settings. The destination has zero published campaigns as of the October 28 read-only inspection. Empty state does not mean existing Base44 records were deleted.

## Public Help Center

`/help` and `/help/:slug` now use the original topic-grid/search/article composition and public, locally bundled guidance, without calling Base44. These currently document migration availability rather than pretending previously created help records or support tickets have been imported. The contact link opens an email draft and is not a verified support-ticket transaction.

## Donations

Campaign donations are paused, as on the live site. The "CAMPAIGN DONATIONS ARE CURRENTLY PAUSED" banner is kept and campaign checkout is disabled. The separate Interplanetary Fund platform-support PayPal link (unchanged from the original) still appears where it did before.

## Not ported (yet)

The current code includes Supabase sign-in/registration, an owner dashboard, private campaign draft saving, and an opt-in campaign-writing assistant backed by the existing authenticated Supabase Edge Function `ifund-campaign-draft-preview`. These are not yet proof of complete end-to-end production acceptance. Payment checkout, withdrawals, agent/workflow parity, all 59 historical route behaviors, and provider integrations remain incomplete or gated.

## Assets

The Base44-hosted logo and hero images (media.base44.com) were replaced with local files. The logo uses `public/ifund-logo.jpg`. The home hero loads `public/images/home-hero.png`. That file could not be downloaded during the port, so add it to restore the original hero art. Until then the deep-space gradient shows on its own.

## Preview deploys

The preview workflow is staged at `apps/web/ci/web-preview.yml`, but is **not installed** at `.github/workflows/web-preview.yml` because the connected token could not write workflow files. No PR-triggered build should be presumed to run until that placement is verified. If the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist, it deploys to the separate Cloudflare Pages project `ifund-web-preview` and comments the URL. Otherwise it uploads `dist` as an artifact. It never touches DNS, production, or the existing Pages project.

## Cloudflare Pages deployment — 2026-11-01

The `interplanetaryfund-migration-preview` Cloudflare Pages project is connected to `interplanetarysister/InterplanetaryFund` main. Its production build runs `npm --prefix apps/web install --no-audit --no-fund && npm --prefix apps/web test && npm --prefix apps/web run build`, with output `apps/web/dist`. Main-branch automatic deployments were enabled for this separate project on 2026-11-01. This is distinct from `interplanetaryfund-migration` (the current domain's Pages project), whose Git source and cutover must be reconciled and verified separately. New code is not claimed live until the corresponding Cloudflare deployment succeeds. Financial operations remain disabled.

## Source-backed preview build (current)

The original UI is executable code in this directory: `src/pages`,
`src/components`, `src/index.css`, `src/styles-ifund-studio.css`, the Tailwind
configuration, and `public/`. Cloudflare needs the compiled artifact from this
code; design instructions cannot replace these files. The root `src/` scaffold
is a separate application and produces a different UI.

Run `npm run build:preview` from the repository root. It runs a frozen install,
40 frontend tests, Vite, and `scripts/verify-artifact.mjs`, producing
`apps/web/dist`. Cloudflare source settings for this artifact are root
`apps/web`, command `npm ci --ignore-scripts --no-audit --no-fund && npm test &&
npm run build`, output `dist`. Keep the existing preview/builder work available
while this source-backed artifact is checked; do not replace production routing.

The previously missing hero is now `public/images/home-hero.jpg` (the exact
original image bytes). Fraunces, Inter and Manrope font subsets and OFL licenses
are local under `public/fonts`; the original PayPal wordmark is also bundled.
`asset-sources.json` records upstream URLs and SHA-256 hashes. The build fails
on a missing referenced asset, altered source asset, remote CSS design asset,
Base44 runtime URL or the wrong root-app bundle. `dist/ifund-build.json` records
source/artifact hashes and explicitly states that full platform parity is
unverified. No design generation runs during deployment.

The original AuthLayout is restored as JSX. Password/reset/registration calls
continue to use Supabase. The original Google/Apple/Facebook button composition
now invokes Supabase OAuth; provider registrations, callback allowlists and
actual social sign-in are unverified. Do not describe them as live integrations
based on rendering. This change does not migrate Base44 users or provider grants.

The owner's 2026-11-01 approval retains the current preview's agent icons and
space-themed display names. `src/lib/presentation.js` applies these labels to
the original navigation structure without changing URL paths or permissions.
The source video, when supplied, will be used for further visual comparison.
All unported routes and remaining behavior stay explicitly unfinished.

The same build now also bundles `server/worker.js` into Pages `_worker.js` and
limits dynamic dispatch with `_routes.json`. This serves the independent
campaign, community-post, owner-account and geocoding API on the preview's own
origin, using the designated Supabase project and caller-scoped RLS. Public posts
select only public columns. Missing sessions are rejected; financial checkout
has no invented success path. Authenticated write journeys still need actual
signed-in runtime verification. Home/navigation now read real Supabase session
state rather than hard-coding every visitor as signed out.

## GitHub Codespaces

Check out `fix/source-backed-preview` and rebuild the dev container. The checked-in
`.devcontainer` selects Node 24 and installs both manifests. `npm run dev:preview`
starts the original-source frontend on forwarded port 5173 and a loopback-only
independent API on 8787, with Vite proxying API traffic. It obtains only the
intentionally public configuration from the source preview, or accepts a
`VITE_SUPABASE_PUBLISHABLE_KEY` Codespaces secret. No private key is fetched or
committed. Codespace port visibility stays private by default.

`python3 build_preview.py` builds/tests/verifies the actual frontend and backend.
`python3 build_preview.py --deploy` uses the existing Cloudflare CLI credentials
and deploys only to `interplanetaryfund-source-preview`; it does not switch the
production domain. Cloudflare credentials belong in encrypted environment
settings, never in the Python file.
