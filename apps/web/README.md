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

Sign-in and registration, member sessions, Terms acceptance gating, campaign creation and dashboard, community, social, blogs, old database-backed help articles and submission forms, the Founding Members page, and every owner or admin tool on the campaign page (editing, distribution, outreach agents, AI coach, translations, follow, share kit, recent supporters, donation dialog). Platform error reporting and Firebase diagnostics were also removed.

## Assets

The Base44-hosted logo and hero images (media.base44.com) were replaced with local files. The logo uses `public/ifund-logo.jpg`. The home hero loads `public/images/home-hero.png`. That file could not be downloaded during the port, so add it to restore the original hero art. Until then the deep-space gradient shows on its own.

## Preview deploys

The preview workflow is staged at `apps/web/ci/web-preview.yml`, but is **not installed** at `.github/workflows/web-preview.yml` because the connected token could not write workflow files. No PR-triggered build should be presumed to run until that placement is verified. If the repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist, it deploys to the separate Cloudflare Pages project `ifund-web-preview` and comments the URL. Otherwise it uploads `dist` as an artifact. It never touches DNS, production, or the existing Pages project.
