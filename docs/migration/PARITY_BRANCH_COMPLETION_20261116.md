# Geocoding and source-backed asset branch reconciliation

Source baseline: `7b5c362a9a5c5b8b818bf14354a48ba7e11e03e1`.
Review date: 2026-11-16 UTC. This records source implementation and local tests;
it does not claim a hosted release or live signed-in provider acceptance.

## migration/geocode-city

The old branch implemented Nominatim behind an isolated migration Worker and a
separate password-entry diagnostic page. The canonical campaign editor instead
had 26 local U.S. presets and manual coordinates, with no online city action.

The independent city lookup now lives in `worker/geocodeCity.js`, with a shared
city-only response contract, authenticated browser transport, and a click-only
action in the existing `CampaignLocationFields` used by Create/Edit Campaign.
The existing U.S. presets remain usable without online lookup. Search selects
an approximate point in local form state; it does not save, publish, change map
opt-in, infer a campaign location, or send device GPS to a provider. Late search
and device responses are rejected after input changes, opt-out or unmount.

The canonical shared router must import `routeGeocodeCity` from
`./geocodeCity.js` and dispatch **only** `/api/geocode/city` to it. The coordinator
owns that router change. Existing Pages catch-all/native API transport then
uses the same canonical code; no second worker deployment or legacy Base44 SDK
URL is necessary.

Security/compatibility changes from the old branch are deliberate:

- Default disabled unless `IFUND_GEOCODE_ENABLED=enabled`, with exact canonical
  Supabase URL, publishable key and existing server-only quota credential.
- POST-only, 1 KiB streamed JSON bound, one city field, 2–80 characters, Unicode
  place names supported, no numeric coordinates/postal codes, URLs or addresses.
- Supabase Auth verifies a nonanonymous, confirmed-email owner; an RLS-scoped
  profile read checks exact owner, active state and no deletion pending.
- Reuses the already-existing atomic `ifund_device_rate_limit(text,integer,integer)`
  RPC. Owner limit is ten searches per minute; one shared application-wide bucket
  admits one uncached provider lookup per **two** seconds. Browser callers cannot
  choose keys or limits. Read-only catalog inspection confirmed EXECUTE grants
  only for `postgres` and `service_role`; no SQL or grant change was made.
- Public city-result cache entries contain only broad coordinates/name/provider
  attribution, keyed by query hash, with a seven-day TTL. Identity is freshly
  checked before cache access. No durable application records are cached.
- The provider origin/path is fixed to
  `https://nominatim.openstreetmap.org/search`; `featureType=city`, one result,
  identifying User-Agent, no redirects and ten-second network timeout. No member
  token, service key, account ID, private file or campaign content goes there.
- Provider bodies are bounded and city type/coordinate syntax/ranges checked.
  Coordinates are rounded to 0.1° before returning to browser state. No
  `parseFloat` prefix acceptance, fake location or raw provider error is returned.
- OpenStreetMap attribution is visible. Queries happen only on explicit button
  click, with no keypress autocomplete or background/bulk search.

Current public Nominatim requirements and search parameters were inspected at
<https://operations.osmfoundation.org/policies/nominatim/> and
<https://nominatim.org/release-docs/latest/api/Search/>. A single distributed
database bucket is used rather than an isolate timer or per-location limiter,
so concurrent callers cannot multiply the provider budget.

Retired branch material: separate `geocodeWorker` deployment/verifier/password
form, old SDK aliases, and broad historical migration snapshots/policy overrides.
Their replacement is the current canonical session/router/release contract.
The old feature's city-selection behavior is implemented; those legacy wrappers
must not be restored merely to reconcile history.

Runtime gate: router integration, a reviewed manual preview artifact, exact live
bindings/flag, and a signed-in active-owner city lookup with wrong-owner/inactive
denials remain to be verified before enabling hosted geocoding. No feature flag,
secret, quota counter, deployment or provider setting was changed in this work.

## fix/source-backed-preview

`apps/web/asset-sources.json` reconciles all 18 original public assets plus the
font stylesheet and three OFL licenses, with exact SHA-256 and byte length.
All artwork/font bytes came from the existing authorized Git branch. The three
license texts preserve their content with one trailing space normalized; both
source and normalized hashes are recorded. No remote media was
downloaded and no private/campaign asset was imported.

The homepage hero was already preserved at
`public/images/base44-archive/19cbf6ba785409de9ac0.png`, with source SHA-256
`468ed782bacfa2e70c5ec524dae7d2ecebadf18c5ebce9b1fa849722d4d06d3e`.
That existing file is reused; another `home-hero.jpg` copy is not created.

Sixteen original Fraunces/Inter/Manrope font files, their stylesheet/licenses,
and the PayPal wordmark are restored to the public application bundle. Canonical
CSS now references the bundled stylesheet; both platform-support buttons use the
local wordmark. The UI no longer depends on a Google Fonts fetch or a remote
PayPal image request for those assets. Runtime `.dev.vars` files are ignored to
preserve the old branch's useful credential-hygiene correction.

The branch's alternative `server/worker.js`, Python preview exporter, backend
bundle scripts, Codespaces setup/proxy, old root preview scripts and build-wrapper
dependency changes are superseded by the current Pages Functions router,
canonical web build, development environment, immutable manual release and
rollback controls. Its old auth/menu/page changes are superseded by current
verified-account, guest-draft and unified-permission behavior. Its public-feed
projection fix is superseded by the current moderated public social RPC. No
obsolete frontend, automatic source trigger or Base44 runtime is restored.

No user-media transfer is part of these public bundled assets. Their source bytes
are all present and verified, so there is no missing-media manifest for this
branch. This does **not** certify the separate Base44 private-source/R2 migration
queue, missing source-media checksums, or original app retirement.

## Verification

`node --test tests/geocode-city.test.js apps/web/tests/city-geocode.test.js
apps/web/tests/bundled-source-assets.test.js apps/web/tests/us-city-presets.test.js
apps/web/tests/atlas-locations.test.js apps/web/tests/atlas-owner-integration.test.js`
passed **34/34** tests. They exercise real parsers/handlers with bounded provider
and Auth test doubles, concurrent quota denial, cached-result credential isolation,
guest/session changes, invalid precision, attribution and actual public-file
hashes/references. They do not claim a live provider roundtrip or browser pass.

Machine-readable per-path decisions are in
`parity-branch-completion-20261116.json`. Canonical full-suite/build and router
integration are required on the combined release candidate before merging.
