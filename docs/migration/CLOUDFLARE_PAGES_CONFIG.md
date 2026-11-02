# Cloudflare Pages — production configuration for the Interplanetary Fund migration
#
# This file records the exact settings the Pages project must have. It is written
# to be read against the dashboard, not to be applied automatically: changing
# production build settings is a deliberate action.
#
# Verified state before this change (from the independent audit):
#   project           interplanetaryfund-migration
#   source repository interplanetarysister/interplanetary-fund2
#   production branch main
#   root directory    /            (repository root)
#   build output      dist
#   automatic deploys disabled
#
# What is actually deployed — verified, not assumed
#
# The audit described the source repository as interplanetary-fund2 and concluded
# the public site is therefore the Base44 app. Probing the live deployment
# contradicts that. The evidence, in order of strength:
#
#   * https://interplanetaryfund-migration.pages.dev serves a bundle with ZERO
#     occurrences of "base44". It does contain @supabase/supabase-js.
#     interplanetary-fund2 is `base44-app` with 338 base44 references and a data
#     layer at src/api/base44Client.js, so the live site is not fund2.
#   * The live bundle contains none of the routes /dashboard, /inbox,
#     /notifications, /profile, /following, /ledger, /withdrawals, /donors.
#     fund2 declares all of those; apps/web declares most of them. So the live
#     site is not fund2 and not apps/web either.
#   * The live routes that do appear - /create, /discover, /campaigns,
#     /community, /my-blog - are all present in the root app of
#     interplanetarysister/InterplanetaryFund, which has 19 routes.
#   * The live document head (title "Interplanetary Fund · What if?", theme
#     #121530) matches this repository's root index.html. apps/web and fund2's
#     root index.html instead use title "Interplanetary Fund — What If?" and
#     theme #101b34.
#
# Conclusion: the public site is the ROOT app of
# interplanetarysister/InterplanetaryFund - the pre-migration app - and it is
# stale. The deployed bundle is 408,356 bytes; a fresh build of the root app here
# is 473,650 bytes, so the deployment predates the work in this repository.
#
# This is a correction to the audit, and it matters for two reasons. First, the
# live site is not Base44, so the migration is further along than the audit
# implied. Second, it means nobody is serving the branded apps/web frontend yet.
#
# What could not be established from here
# ---------------------------------------
# The live bundle filename (/assets/index-or7R9T2l.js) appears nowhere in this
# repository's history, `dist/` is gitignored, and no committed dist exists. So
# the deployment was produced from some tree that cannot be correlated to a
# commit here. Whether the Pages project's source repository setting genuinely
# reads interplanetary-fund2 is therefore NOT something this environment can
# confirm. Read the setting in the dashboard and reconcile it with the evidence
# above before changing it.
#
# It is possible the source setting points at this repository already, and the
# audit recorded a stale or misread value. Check before acting.

# Required settings after the change
# ----------------------------------
# Note: the live site already returns 200 for /campaigns and
# /campaign/00000000-0000-4000-8000-000000000000, so a SPA fallback is already in
# effect on the current deployment even though the deployed tree has no
# _redirects file. Do not assume the fallback is absent just because the source
# lacks the file. apps/web does ship public/_redirects, so this stays correct
# after the switch either way.
#
#   production branch  main
#   root directory     apps/web
#   build command      npm ci && npm run build
#   build output       dist
#
# `apps/web` is self-contained: it has its own package.json, package-lock.json
# and vite.config.js, and imports nothing from the repository root. Verified by
# exporting only apps/web with `git archive` into an empty directory, running
# `npm ci`, and building successfully with the environment variables below. That
# is the same isolation Cloudflare Pages provides when root directory is set to
# apps/web.
#
# `npm ci` is preferred over `npm install` because it installs exactly the
# lockfile and fails rather than silently resolving a different tree.

name: interplanetaryfund-migration
production_branch: main

build:
  root_directory: apps/web
  command: npm ci && npm run build
  output_directory: dist
  # Node 20 or newer; apps/web uses Vite 6.
  node_version: "20"

# Environment variables. These are public by design: Vite inlines them into the
# browser bundle, so every value here is readable by anyone who loads the site.
# The Supabase anon/publishable key is meant to be public and is safe to expose
# only because Row Level Security is the actual access control. Never place a
# service_role key or any other secret here.
env:
  production:
    VITE_SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co"
    # Set the project's publishable (anon) key in the dashboard. Left as a
    # placeholder here because committing a key to git, even a public one,
    # invites it being mistaken for a secret and reused somewhere it matters.
    VITE_SUPABASE_PUBLISHABLE_KEY: "<set in dashboard>"
  preview:
    # A preview deployment must point at a non-production database so that
    # exercising the preview cannot write to production data. Set this only once
    # a preview or staging Supabase project exists; until then, do not enable
    # preview deployments that share the production project.
    VITE_SUPABASE_URL: "<set only when a preview database exists>"
    VITE_SUPABASE_PUBLISHABLE_KEY: "<set only when a preview database exists>"

# Redirects. The migration frontend is a single-page app, so every unknown path
# must serve index.html or a deep link such as /campaign/<id> would 404 on a
# hard refresh. This is the standard Pages SPA fallback. The file lives at
# apps/web/public/_redirects so it is copied into dist at build time.
redirects:
  - from: "/*"
    to: "/index.html"
    status: 200

# Domain. interplanetaryfund.com is currently served by Wix. The DNS cutover is
# a separate, explicitly authorised step and is not part of this change. Do not
# attach the apex domain to this Pages project until the preview below has been
# validated against real data.
domain:
  intended: interplanetaryfund.com
  cutover: not_authorised
  currently_served_by: wix

# Verification checklist before the domain is switched. Each item is evidence,
# not an intention.
verification_required:
  - The preview deployment loads and renders the migration frontend, not the Base44 app.
  - Sign-in works against the production Supabase project and a session survives a reload.
  - Campaign discovery lists real published campaigns from the production database.
  - Campaign creation writes a row whose owner_id is the signed-in account.
  - Editing a campaign updates it, and a second account cannot edit it.
  - Following a campaign and the resulting notification both work.
  - The inbox lists real rows and marking one read persists.
  - A deep link such as /campaign/<id> loads on a hard refresh, not only via client navigation.
  - The browser bundle contains no service_role key: grep dist/ for the key.
  - Every page is usable at a 390x844 mobile viewport.
  - docs/migration/PRODUCTION_RECONCILIATION.sql has been run and its output reviewed.
  - The two pending migrations applied cleanly, or the preflight refused them and the divergence was resolved.
