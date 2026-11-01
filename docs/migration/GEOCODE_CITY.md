# geocodeCity incremental replacement

State: implemented, compared locally with the original handler, and deployed to
an isolated Cloudflare Worker. **Signed-in live success, original campaign UI
integration, and production switch remain pending. Do not mark complete.**

## Original operation and contract

Reference: read-only `interplanetarysister/interplanetary-fund2` at
`d681fb36c37f86de8d32a60f4350853d0c792f87`:

- `base44/functions/geocodeCity/entry.ts`
- `base44/shared/accountGuard.ts`
- `src/pages/CreateCampaign.jsx:102` (`locate` action)

The function authenticates, rechecks the authoritative account lifecycle, trims
a string city (1–200 UTF-16 code units), and calls the existing OpenStreetMap
Nominatim search with `format=jsonv2&limit=1&q=…` and the original User-Agent.
It returns numeric `lat`, numeric `lng`, and `display`. The caller writes those
coordinates into local form state. The function does not persist a campaign,
charge a donor, send a message, or alter a ledger.

Preserved responses for valid original JSON requests:

| Case | HTTP | Body |
| --- | --- | --- |
| Active signed-in account and match | 200 | `{lat,lng,display}` |
| No session | 401 | `Sign in to continue.` error |
| Missing account record | 401 | `This account is no longer available.` error |
| Deletion pending | 403 | Original scheduled-for-deletion error |
| Disabled account | 403 | `This account is no longer available.` error |
| Missing, blank, non-string or overlong city; malformed JSON | 400 | `A city name is required` error |
| No geocoder match | 404 | `Location not found` error |
| Geocoder non-success | 502 | `Geocoding service unavailable` error |
| Geocoder network/JSON failure | 500 | `Unable to geocode this location right now` error |

Both function paths dispatch the replacement:
`/functions/geocodeCity` and
`/api/apps/6a67a778342a8fe05ee79cba/functions/geocodeCity`.

## Independent implementation and explicit differences

`worker/geocodeCity.js` uses Supabase `/auth/v1/user`, followed by a fresh,
owner-filtered, RLS-scoped `ifund_profiles` read with the caller's bearer.
It pins **only** `https://ssibsfmtodgximseeqsv.supabase.co` and uses a
publishable key; no privileged database key or Base44 runtime is involved.
Account lifecycle columns are not writable by browser roles in the observed
destination grants. No user-editable metadata authorizes the operation.

Security differences from the original are explicit: 4 KiB streamed JSON-body
bound, JSON content type, POST-only endpoint, 10-second upstream timeout,
redirect rejection, no-store responses, and 502 for nonfinite coordinates.
Null destination lifecycle fields are denied pending migration verification;
the original tolerated missing lifecycle flags. Unavailable profile status is
503, rather than pretending the account is deleted. These differences require
review before production activation. The existing destination lifecycle guard
already requires an active status and a false deletion-pending flag.

The public geocoder receives no bearer, email, Supabase key or profile ID.
Original Nominatim usage is retained. Live rollout must account for its shared
service usage policy; no new paid geocoder or geocoding library was introduced.

Reuse discovery: [osm-search/Nominatim](https://github.com/osm-search/Nominatim)
is the original upstream (GPL-3.0; source activity observed 2026-10-28).
Reusing the existing HTTPS API needs no vendored server or new dependencies.
No self-hosted Nominatim instance or extra provider was activated. Data usage
and attribution remain subject to the existing OSM service policy.

## Deployment and rollback

- Worker: `ifund-geocode-staging`, account `c95db4f2c901f32776471b85f1eda15d`.
- URL: <https://ifund-geocode-staging.interplanetary-fund.workers.dev>.
- Private sign-in test page:
  <https://ifund-geocode-staging.interplanetary-fund.workers.dev/__verify/geocode>.
- Supabase target: `ssibsfmtodgximseeqsv`.
- Deployment ID: `b7774cf181c840cf83b8efcc3d88c51e`.
- Uploaded 2026-11-01 11:36:58 America/Los_Angeles (19:36:58 UTC).
- Bundle SHA-256:
  `63cfd535926f4e58a2c080d42635dcfc39d2a25d25dec7f70641ea2f5bd541c9`.
- `SUPABASE_PUBLISHABLE_KEY` is a Cloudflare encrypted secret binding. Its
  intentionally browser-safe value is available only to the opt-in verifier;
  the verifier rejects secret and legacy JWT-shaped keys. No value is in Git.
- Configuration: `worker/wrangler.geocode.json`; independent entrypoint:
  `worker/geocodeWorker.js`. No production routes, schedules or service bindings.
- In the shared `worker/index.js`, the new operation stays disabled unless
  **both** `MIGRATION_API_PREVIEW` and `IFUND_GEOCODE_ENABLED` are enabled with
  the canonical project configuration. No existing Worker was redeployed.

Rollback for staging: disable this Worker's workers.dev subdomain or set its
geocoding/verifier flags disabled. Production still uses its existing behavior;
there is no production geocoding route to roll back. A future production switch
must record the exact prior route/dispatcher and preserve the Base44 function.

Deployment authorization is granted for this build by the owner's 2026-11-01
instruction. No additional deployment confirmation is required.

## Verification and remaining gate

- `node --test tests/geocode-city.test.js`: **25 passed**. This includes 15
  differential cases executing pinned original handler/account-guard bytes;
  source fixture SHA-256 checks; active/disabled/deleted/pending accounts;
  encoded cities, JSON validation, no match, upstream errors; caller-token
  isolation; wrong-project rejection; body bound; disabled dispatch; and
  staging verifier configuration protections. External collaborators are test
  doubles; they are not production data or production functionality.
- Chromium verifier orchestration: synthetic success and rejected-login cases
  passed. Password/token/email are absent from the report and persistent browser
  storage; successful test signs out its newly created test session.
- Deployed Chromium checks: verifier HTML/config 200; missing bearer 401;
  invalid bearer 401; original SDK path without bearer 401; unrelated migration
  API 404. Config is pinned to the intended project and uses a publishable key.
- Nominatim read-only connectivity check: actual London lookup returned 200
  with numeric coordinate strings. This is not a signed-in Worker success.
- Read-only Supabase metadata: three Auth users and three profiles with active,
  non-deletion-pending lifecycle status at observation. No user data was changed.

The owner can run the live positive test on the linked staging page using a
Supabase test account with a password. Credentials go directly to Supabase;
the bearer stays in memory, the test signs out that session, and the downloaded
report contains only status codes, public location results and test metadata.
No password, OTP, session token or service-role key should be sent in chat.
The browser test page is diagnostic tooling, not a replacement product login.

Before switching production: prove the live signed-in 200 path; review the
listed compatibility differences; verify any intended frontend dispatcher uses
a Supabase session; restore and test the original location button/form behavior
and coordinate persistence; check provider usage handling; record a route-level
rollback; and recheck unrelated production routes. The current independent
campaign editor lacks the original location action and complete campaign model.

Machine evidence: [geocode-deployment.json](contracts/geocode-deployment.json).
