# Blockers and evidence — migration Phase 1
Updated: 2026-10-24. Authority: [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137).
**Status vocabulary:** VERIFIED = observed in connected source; SUPPORTED = documented capability without IFund production trial; UNKNOWN = requires authorized runtime/provider verification. No production changes are authorized by this file.

## B28 — OPEN: three open PRs propose changes to the same `ifund_campaigns` grant surface

Found while reviewing everything awaiting merge to `main`. Three open PRs each change, or depend on, the
anon column grant on `public.ifund_campaigns`, and they are mutually inconsistent:

* **#186** (`20261102_ifund_public_read_hardening.sql:95-97`) replaces the table-wide anon grant with an
  explicit column list: `id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,updated_at`.
* **#182** (`20261101_planetary_atlas_public_locations.sql`) adds `latitude`, `longitude`,
  `atlas_city`, `atlas_country`, `atlas_visible` to the table and grants nothing for them. Its new page
  `src/pages/PlanetaryAtlas.jsx:18` reads `latitude,longitude,atlas_visible` as an anonymous visitor.
  Its own comment (line 30) asserts "SELECT of active campaigns is already public", which is only true
  while the grant stays table-wide.
* **#188** (`docs/migration/sql/public_campaign_detail_updated_at_column_grant.sql`) adds a column grant
  on the same table, outside `supabase/migrations/`.

Each PR is internally consistent. Together they are not. If #186 and #182 both land, the Atlas select
raises `42501 permission denied` and the page renders empty for every anonymous visitor.

**Why this matters beyond the one page:** grant narrowing is a global change to a shared object, but it
was reviewed as a local change. Every concurrent reader of the narrowed columns has to be checked, not
just the readers already merged.

**Resolution:** one owner for the `ifund_campaigns` grant surface, and one review that covers all three
proposals together. Either add the atlas columns to the anon grant (only alongside the opt-in consent
UX #182 defers) or keep the Atlas behind authenticated access, and drop the duplicate grant in #188 in
favour of a single migration. Recorded on all three PRs.

## B27 — RESOLVED IN CODE, NOT YET APPLIED: the 66 missing entity tables

The storage gap recorded above is now closed. `scripts/generate-entity-tables.mjs`
reads the reference entity schemas and emits
`supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql`, plus
`docs/migration/base44-entity-tables.json` as the machine-readable form.

Measured result, not estimated:

    referenced entities            76
    already had a table            10
    tables created here            66
    declared columns               736
    enum check constraints          97

All 76 entities the backend references are now backed by a table, so every one of the
184 functions has storage to read and write.

What the generator does, and why each choice was made:

* Types follow the declared schema: `string` to `text`, `number` to `numeric`,
  `boolean` to `boolean`, `integer` to `integer`, and every `object` or `array` to
  `jsonb`. Objects and arrays are not narrowed because the reference stores free-form
  structured values in them and narrowing would reject data the application already
  accepts. A union such as `["string","null"]` becomes the non-null member and stays
  nullable.
* A declared `enum` becomes a check constraint, but only when every member is a usable
  string literal. 97 of the 150 declared enums qualify; the rest are left permissive
  rather than given a wrong constraint.
* A `default` is emitted only for booleans and numbers. String defaults are omitted,
  because they encode business choices that belong to the handler and a wrong default
  is harder to notice than a missing one.
* Every table carries Base44's implicit columns. They are not declared as properties
  but every record has them and the backend reads them: 75 of 184 functions reference
  `created_by_id` and 53 reference `created_date`. `created_at` and `updated_at` are
  also emitted here because 16 and 12 entities declare them as properties, and emitting
  the declarations would collide with the implicit pair and fail the migration.
* `id` is `text`, matching the original record identifiers. The existing blog tables
  already use this convention, and keeping the original id preserves the identity that
  cross-references inside the functions rely on.

Access: every generated table is deny-by-default. RLS is enabled, no privilege is
granted to `anon` or `authenticated`, and no policy is created, so nothing can read or
write these tables through a browser key until an access rule is written deliberately.
The ported handlers are expected to use a service-role client. This is asserted for
every table, both by reading the catalog and by exercising the denial.

The file is purely additive: it only contains `create table`, `enable row level
security` and `revoke all` against tables it creates itself, so applying it cannot
change a table it does not own. A test asserts that too.

Proven by `tests/entity-tables.test.js` (20 tests): coverage against the inventory,
agreement between the committed SQL and the committed manifest including the exact
column lists, text primary keys, RLS enabled everywhere, no browser privileges
anywhere, enforcement of declared enums, tolerance of null enums, numeric and boolean
fidelity, jsonb round-tripping, idempotency, and composition with the rest of the
pending chain.

**Still requires owner action:** applying it, and then the data import. This
environment has no database credentials.

## B24 — RESOLVED IN CODE, NOT YET APPLIED: the public Stories RPC does not exist in production

`apps/web/src/lib/editorial.js` calls `rpc("ifund_public_blog_entries_read", ...)`
for every public story, from `listPublishedStories()` and `getPublishedStory()`.
Measured against production ssibsfmtodgximseeqsv:

    POST /rest/v1/rpc/ifund_public_blog_entries_read
      -> 404 {"code":"PGRST202","details":"Searched for the function
              public.ifund_public_blog_entries_read with parameters ..."}

The function does not exist, so both Stories entry points fail and the pages render
their error state.

Why this survived review: `apps/web/tests/published-stories-parity.test.js` reads
`editorial.js` as text and asserts that the `rpc(...)` call is spelled correctly,
with the right argument names. That test passes whether or not the function exists
in the database. A source-text assertion cannot observe database state. The new
`tests/public-blog-entries-read.test.js` closes that class of gap directly: it calls
the function, and it also compares every `rpc()` name in the client against the
functions the migrations define, so a call site can no longer pass while the
function behind it is absent.

**Why it must be a function, not a table read.** Probing the anon grant column by
column on production shows the author identity columns are withheld:

    ifund_blog_entries  readable: id, status, title, body, summary, type, featured,
                                  published_at, blog_id, created_at, updated_at
    ifund_blog_entries  NOT readable: owner_auth_user_id, legacy_owner_user_id
    ifund_blogs         NOT readable: owner_auth_user_id, legacy_owner_user_id

`listPublishedStories({author})` filters by author, and the author reference is
exactly the column anon may not read. A direct query cannot express that filter, so
the resolution has to happen inside a SECURITY DEFINER function that returns only
public fields.

**Resolution:** `supabase/migrations/pending/20261102_ifund_public_blog_entries_read.sql`.
Defines the function with the four-argument signature the client calls
(`p_author_ref`, `p_blog_id`, `p_entry_id`, `p_limit`), matching the original text
ids, returning only published entries whose parent publication is `active`, nesting
the parent blog as `jsonb` because `editorialContracts.verifiedPublishedEntries`
checks `row.blog.status`. It clamps the limit server-side, pins `search_path`, is
STABLE and read-only, and revokes execute from PUBLIC before granting it to anon and
authenticated. Proven by 13 tests.

## B25 — RESOLVED IN CODE, NOT YET APPLIED: the committed anon grants are looser than production

The same column-by-column probe found that this repository's committed migrations
grant anon a table-wide select where production grants only the public columns:

    committed:  grant select on public.ifund_campaigns,public.ifund_posts to anon;
                grant select on public.ifund_blogs,public.ifund_blog_entries to anon;
    production: anon may not read ifund_posts.author_id,
                ifund_campaigns.owner_id, ifund_blog_entries.owner_auth_user_id,
                ifund_blog_entries.legacy_owner_user_id, ifund_blogs.owner_auth_user_id,
                ifund_blogs.legacy_owner_user_id

Both row policies permit public rows, so a table-wide grant lets anon read the
account uuid behind every community post, campaign and story. That is more than
publishing the content requires. The committed migrations are behind production
here, which means applying them as written would *widen* access rather than
reproduce it.

Narrowing anon is safe for every reader in this repository: the public pages and the
worker select explicit column lists that already exclude the identity columns
(`src/pages/{Discover,Feed,CampaignDetail}.jsx`, `src/pages/{Community,Feed}.jsx`,
`worker/reads.js`). `authenticated` keeps its table-wide grant, because the
ownership policies and the owner-scoped reads are written against `owner_id` and
`author_id`.

**Resolution:** `supabase/migrations/pending/20261102_ifund_public_read_hardening.sql`.
Verified by tests that assert anon can still read every column the public pages and
the worker select, and cannot read any identity column.

## B26 — RESOLVED IN CODE, NOT YET APPLIED: ifund_my_post_ids is missing from the migrations

`src/pages/Community.jsx` asks `rpc("ifund_my_post_ids")` which of the 50 visible
posts the signed-in member may delete, and reads `item.post_id` from the result.
Production answers:

    POST /rest/v1/rpc/ifund_my_post_ids -> 401
      {"code":"42501","message":"permission denied for function ifund_my_post_ids"}

so the page degrades to "ownership controls are temporarily unavailable" and shows
no delete control. The function is not defined by any migration in this repository,
so a database built from these migrations would not have it at all.

It cannot be answered client-side for the same reason as B24: `ifund_posts.author_id`
is withheld from anon, so the client cannot compare it to its own id.

**Resolution:** the same hardening migration defines `ifund_my_post_ids()` with the
`(post_id uuid)` return shape the page reads, resolving `author_id` inside a
SECURITY DEFINER body and returning only post ids. Proven by tests that it returns
the caller's posts and never another member's.

## Base44 backend inventory

`docs/migration/BASE44_FUNCTION_INVENTORY.md` and
`docs/migration/base44-function-inventory.json`, generated by
`scripts/inventory-base44-functions.mjs` from `interplanetarysister/interplanetary-fund2`
(read-only reference; run with `BASE44_SOURCE=/path/to/checkout`). Measured, not
estimated:

* 184 function entrypoints, all with source.
* 95 entity schemas; 76 entities are referenced by functions.
* Of those 76, **only 8 have a table in this repository**. 68 do not.
* 54 functions are classified financial and stay gated.

Of the 130 non-financial functions, only 27 touch nothing but entities that already
have a table, and most of those need shared modules or external providers. The
dominant blocker is therefore the 68 missing tables, not handler code: a function
cannot be ported faithfully without the table it reads and writes. That is the
critical path for the remaining backend migration, and it is recorded here rather
than presented as progress.

## B23 — RESOLVED IN CODE, NOT YET APPLIED: production's ifund_legal_acceptances has no primary key

Measured directly against production ssibsfmtodgximseeqsv. This did not need
credentials: the Supabase URL and publishable key ship in the deployed bundle, and
`scripts/reconcile-production-schema.mjs` reads them from there and probes
PostgREST exactly as an anonymous browser would. Run it any time; it exits 1 when
it finds a divergence.

Column by column, production holds:

    public.ifund_legal_acceptances
      present  owner_id, terms_version, explicit_consent, accepted_at,
               acceptance_method, terms_path, privacy_path
      ABSENT   id, created_at

`id` absent means the table has no primary key. That is a defect in the existing
table independent of anything this repository wants to add: a table without a
primary key cannot be referenced by a foreign key, cannot be updated by id, and is
excluded from logical replication.

It also means the member-schema migration could not have repaired it. That file
declares the table with `create table if not exists`, which against a table that
already exists does nothing whatsoever. The declared primary key, the defaults and
the unique constraint were all being silently discarded, and the migration would
have reported success.

**Resolution:** `supabase/migrations/pending/20261102_ifund_legal_acceptances_repair.sql`.
It adds `id` (nullable, backfilled, then NOT NULL and defaulted), promotes it to
the primary key only if the table has none, adds `created_at`, and adds the
`(owner_id, terms_version)` unique constraint after collapsing any duplicates. It
tests the catalog before every step, so it is idempotent, and it never drops a
column or deletes a row. It sorts before the member schema, so the member schema's
preflight then passes instead of refusing.

Proven by `tests/legal-acceptances-repair.test.js` (11 tests), which reproduces
production's exact shape, applies the repair, and shows the member-schema
preflight refusing before it and passing after.

**Still requires owner action:** applying it. This environment has no database
credentials, so the migration is written, tested against a reproduction of
production's real shape, and unapplied. Apply `..._legal_acceptances_repair.sql`
before `..._member_schema_completion.sql`.

### Everything else measured against production came back clean

The same script confirms:

* All ten tables the client queries exist, under the `ifund_` names the client
  uses. There is no naming divergence.
* Every column the client reads or writes exists. The client contract is
  satisfied, so the member gates that previously failed closed will work.
* `ifund_legal_acceptances` is the only table whose declared columns are missing
  any.
* Anon cannot read non-public rows: zero non-active campaigns, zero non-active
  blogs, zero unpublished blog entries, zero unapproved publications.
* Anon cannot write: POST to campaigns, profiles and notifications all return 401.

One caveat on the write probe: a POST naming a column that does not exist is
rejected by PostgREST with 400 before RLS is consulted, which looks like a failure
to deny but proves nothing about authorization. The script uses real columns so
the request reaches RLS. An earlier version of the script reported a false alarm
for this reason and was corrected.

## B22 — privileged functions are outside migration control (partly unresolved)

The Supabase security advisor flags privileged functions for review. Auditing what
this repository can see:

* Three functions are defined across all migrations. All three are safe.
  `ifund_touch_updated_at` is a trigger and security invoker.
  `ifund_current_account_is_active()` and `ifund_public_campaign_detail(text)` are
  SECURITY DEFINER, and both pin `search_path = public, pg_temp`, which is the
  property that makes a definer function safe. Both also revoke execute from
  PUBLIC before granting to specific roles, and both are read-only.
  `tests/function-security.test.js` asserts all of this and fails if a future
  function is added as a definer without a pinned path.

* The unresolved part. `public.ifund_public_campaign_detail(text)` is SECURITY
  DEFINER and calls
  `public.ifund_migration_active_campaign_preview(p_after_source_id, p_limit)`.
  **No migration in this repository defines that function.** It exists in the live
  database, created by a path this repository does not contain. Because the outer
  function runs as its owner, the inner function's privileges and its own
  `search_path` are not reviewable from source, and the advisor's finding may be
  about exactly this function.

  This is not inherently a defect. A definer function calling another definer
  function is normal. It is a gap in what can be verified: the security of
  `ifund_public_campaign_detail` depends on a function nobody here can read.

  **Next proof:** run query 7 and 7b in
  docs/migration/PRODUCTION_RECONCILIATION.sql against
  ssibsfmtodgximseeqsv. Query 7 reports, for every function in `public` and
  `ifund_ops`, whether it is SECURITY DEFINER and whether its `search_path` is
  pinned, and flags any definer without one. Query 7b reports who may execute it.
  If `ifund_migration_active_campaign_preview` is reported as a definer with no
  pinned path, it needs the same `set search_path = public, pg_temp` treatment the
  other two have. Do not apply that change blind: the function's body is unknown,
  and pinning a path can break a function that relies on a different one.

  **Blocks:** independent verification of the public campaign detail path. Not a
  blocker for anything else, since that function is read-only and exposes only
  fields the preview already marks public.

A second, related observation: because these functions were created outside this
repository's migrations, `supabase db push` would not reproduce the live schema.
The reconciliation report's migration-history section is what establishes the gap.

## B21 — react-router advisories in the deployed root app (fixed)

`npm audit` on the root app reported two moderate advisories against
`react-router`, installed at 6.30.4:

* GHSA-wrjc-x8rr-h8h6 — open redirect via backslash in `<Link>` and
  `useNavigate`. This is the same attack class `src/lib/authReturnTo.js` already
  guards against at the redirect boundary, so the two protections overlap.
* GHSA-337j-9hxr-rhxg — arbitrary constructor injection via
  `deserializeErrors()` in SSR hydration. Not reachable here: the app is a
  client-rendered SPA and never calls the SSR hydration path.

Both advisories cover the whole 6.x line (`>=6.0.0 <7.18.0`), so the obvious
patch bump to 6.30.6 does **not** clear them — verified, not assumed. The fix is
7.18.5.

The upgrade was low risk because the app imports only stable core APIs:
`BrowserRouter`, `Link`, `NavLink`, `Route`, `Routes`, `useLocation`,
`useNavigate`, `useParams`, `useSearchParams`. No data router, loaders, actions or
`json()`/`defer()` are used.

The branded frontend already ran react-router 7.18.x, so this brings the two
frontends onto one major version.

Verification: `npm test` and `npm run build` both pass on a broken router, because
neither renders a route, so a render suite was added —
`tests/root-router-runtime.test.js` renders real root-app components inside a
real `MemoryRouter` and asserts a `Link` still produces an anchor with the right
href, that `useLocation` resolves, and that a hostile title stays escaped. 6
tests. `npm audit --omit=dev` now reports 0 vulnerabilities for both apps.

## B1 — Can all Base44 records, including donations and financial ledgers, be exported?
**SUPPORTED API route / UNKNOWN completeness.** Base44 supports Data-dashboard per-entity CSV export and paginated SDK `entities.<Type>.list/filter` reads; [official SDK docs](https://docs.base44.com/sdk-getting-started/client) show `asServiceRole.entities.<Type>.list()` inside Base44-hosted functions, but not external service-role usage. Authorized Base44 owner could run an audited, read-only function that paginates **every** entity (including Donation, HoldingLedgerEntry, FinancialOperation, Withdrawal, WebhookEvent, payouts) to JSONL/JSON; dashboard CSV can be used as independent reconciliation. A management API/CLI alternative may be possible but has not been verified with app permissions. Respect pagination, rate limits, PII access and financial consistency.
**Test export:** NOT RUN/NOT VERIFIED by this migration effort. **Per-entity row counts:** UNKNOWN (none established). **Checksums:** UNKNOWN. No user data has been copied. No indication that a source-code ZIP includes database records. **Blocks:** production database import and cutover. **Next proof:** owner-authorized read-only 1-entity sample with count and hash, then all 95 entities plus financial provider ledger reconciliation and a no-write-delta cutover plan.

## B2 — Are passwords/OAuth links transferable? How will users sign in?
**UNKNOWN identity export.** `base44/entities/User.jsonc` describes application profile fields, not necessarily Base44 authentication password hashes or portable Google-provider links. There is no verified export of password hashes, provider subject IDs, or live sessions. Do **not** claim transferable passwords, hashes or OAuth grants based on a third-party article. Plan: export allowed User profile rows (including stable legacy ID/email with consent); provision/claim Supabase Auth accounts after independent email verification or fresh Google OAuth; password-based users use Supabase password reset or magic links. Map old identity IDs to new auth.users IDs with verified ownership, preserving associated campaign/donation records. No implicit admin role from email/metadata. **Blocks:** seamless account cutover and correct ownership reconciliation; does not block scaffold or schema.

## B3 — Where are uploaded images/files; bulk export?
**SUPPORTED hosted-URL storage / UNKNOWN bulk completeness.** Source `src/components/media/MediaUpload.jsx` calls `uploadUserImage(base44, file)`; media URLs are stored in entity rows. Some are Base44-hosted media URLs and may need authorization or expiring signed access. Public URL downloads can be scripted; private URLs must be handled with authorized sessions, not made public. No complete file/bytes inventory, bulk download, hashes or read-through test is verified. Plan enumerate **all** file-bearing fields and rich-content links, download bytes in a permitted authenticated batch, hash, upload to **private/public scoped Supabase Storage buckets** with RLS, update URLs after verification. **Blocks:** media parity and cutover.

## B4 — Which built-ins and what replacements?
**VERIFIED in source:** `@base44/sdk` entity CRUD and Auth; `integrations.Core.InvokeLLM`, `GenerateImage`, `SendEmail`; upload/image-watermark helper; `functions.invoke`; hosted agents, connectors, workflows. Source directory inventory on main: **95 entities, 184 function entrypoints, 11 connectors, 10 agents, 17 workflows, 1 mcp file**. These counts describe source definitions, not implemented ports. Replacement map:
- Entity CRUD, realtime, access rules → Supabase Postgres + RLS + Realtime where applicable; `ifund_ops` already exists privately.
- Auth → Supabase Auth; explicit role tables/authorization and migration proof.
- Uploads/image policies → Supabase Storage plus server-side watermark and controlled generation.
- InvokeLLM/GenerateImage → independently configured AI model/image provider called server-side through Cloudflare Worker/Supabase Edge Function; quotas and consent required.
- SendEmail → provider-backed transactional email integration with sending-domain verification; existing mail ingress is not assumed to provide outbound capability.
- Hosted functions, agent tools, webhooks, scheduled workflows → authenticated Worker/Edge Functions and private workflow queues, preserving idempotency, audit, provider scopes and permission checks.
- Connectors → provider-specific OAuth refresh/token storage in private secrets/vault; disabled until verified provider handshake.
**Blocks:** complete feature parity; does not block documentation or scaffold.

## B5 — Where are PayPal/Stripe webhooks and secrets?
**VERIFIED code destination, UNKNOWN provider state.** `interplanetary-fund2/base44/functions/setupPayPalSubscriptionWebhook/entry.ts` hard-codes `https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook` and contains a provider registration/verification path; successful execution/remote registration was **not** checked. PayPal campaign callbacks may have separate paths. `base44/functions/stripeWebhook/entry.ts` reads `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` through `base44:runtime`; the Stripe dashboard's configured endpoint is **UNKNOWN**. Other PayPal credentials and OAuth provider grants may live exclusively as runtime/dashboard secrets; existence, values, scopes and rotation status were not inventoried. **Never export secret values to Git, logs or migration reports**. Owner must verify endpoint registrations in PayPal/Stripe dashboards, inventory names and supported rotation flows, provision fresh Cloudflare/Supabase secrets, validate signed sandbox webhooks and idempotent receipt settlement before production changes. **Blocks:** live financial operations, safe payouts, final cutover.

## B6 — What are source migration branches, and which Supabase migrations are actually applied?
**VERIFIED branch diffs:** [owner-proof-gate branch](https://github.com/interplanetarysister/interplanetary-fund2/tree/migration/owner-proof-gate-20261023) is a diverged working branch with owner identity/consent gates, guarded campaign previews and shadow reconciliation tools (85 commits ahead, 16 behind main at inspection). Do not merge blindly or assume main contains its latest work. [private-agent-conversation-store branch](https://github.com/interplanetarysister/interplanetary-fund2/tree/migration/private-agent-conversation-store-20261022) adds `docs/migration/independent-agent-conversations.sql` as its lone branch-diff file (1 commit ahead, 36 behind main); this is a proposal, **not evidence of applied SQL**.

**VERIFIED via Supabase project `tzehxfikoslihnclhxuz` list_migrations:** 25 recorded applied migrations, in order:
1. `20261019143600_create_isolated_business_mail_foundation`
2. `20261019145629_business_mail_secure_ingress_and_private_text`
3. `20261019145646_member_mail_backend_rpc_for_trusted_edge`
4. `20261019164158_admin_inbound_email_private_foundation`
5. `20261019164218_admin_email_recipient_validation_correction`
6. `20261019164253_admin_email_upsert_conflict_index`
7. `20261019164540_ifund_admin_mail_access_control`
8. `20261019165248_ifund_admin_mail_access_audit`
9. `20261019201418_fundraising_mail_subdomain_text_only_grace_storage`
10. `20261019201605_fundraising_outreach_agent_permissions_foundation`
11. `20261020044731_ifund_mail_atomic_read_audit`
12. `20261021064337_create_private_ifund_campaign_shadow`
13. `20261021223621_extend_private_campaign_shadow_nonfinancial_parity`
14. `20261023012122_ifund_private_workflow_queue_initial`
15. `20261023012527_ifund_workflow_atomic_claim_and_completion`
16. `20261023013549_ifund_workflow_lease_fencing`
17. `20261023013721_ifund_workflow_guarded_enqueue`
18. `20261023013815_ifund_core_private_migration_staging`
19. `20261023053831_ifund_private_agent_delegation_activity_shadow`
20. `20261023073825_ifund_agent_shadow_verified_identity_and_campaign_gate`
21. `20261023084110_ifund_owner_candidate_email_matches_unverified`
22. `20261023103745_ifund_owner_proof_service_only_atomic_rpc`
23. `20261023184125_ifund_active_campaign_preview_service_only_20261023`
24. `20261023225544_ifund_owner_scoped_private_campaign_preview_rpc`
25. `20261024232855_ifund_content_shadow`

**VERIFIED table-list subset:** `ifund_ops.workflow_jobs`, `ifund_ops.workflow_control`, `ifund_ops.workflow_execution_log` and three `public` mail tables all had RLS enabled. The three workflow tables show zero rows in the list summary; this is **not** a proof of all internal/private schemas or all source entity counts. Existing `ifund_ops`, existing functions and private shadow schemas must not be recreated or mutated without review. None of the new scaffold SQL was applied by this effort.

## Cutover rules
Do not merge old PR #136 (based on pre-reset history). Source of truth: issue #137. Do not deploy, change Wix/Cloudflare DNS, alter provider dashboards, or run production DDL/export operations in this phase. All pending evidence and ownership actions remain explicit blockers. No estimated effort is an assertion of readiness.

## B7 — Dependency lockfile and build verification
**PARTIALLY RESOLVED (2026-10-24).** A `package-lock.json` now exists with 210 dependency-metadata entries, including TailwindCSS, PostCSS, Autoprefixer and zero Base44 package entries. To avoid using paid build resources, the lock tree was assembled by retaining verified package-integrity metadata from existing npm lockfiles, with exact direct package versions, rather than running `npm install`; this is **not** a claim of successful npm resolution, installation, or reproducible build. Full `npm ci` and `npm run build` remain **UNVERIFIED**, because this local runner cannot reach `registry.npmjs.org` (EAI_AGAIN / DNS failure). The actual checked-in `package.json` uses React 18, React Router 6, Vite 6, Supabase client 2.105.4 and TailwindCSS 3.4.19; Wrangler is not a build requirement for Phase 1 and deployment is intentionally out of scope. A static metadata consistency check found matching declared direct dependencies and no unresolved lockfile dependency paths, but this does not substitute for `npm ci`. Next proof on a no-credit runner with registry access: `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, `npm run build`, and `npm ls --all`. If npm reports a mismatch, regenerate lock with `npm install --package-lock-only` and commit correction before marking Phase 1 complete. **Blocks:** dependency/build certification, not static inventory. 

## B8 — Owner-approved sign-in decision and provider setup (PARTIALLY RESOLVED 2026-11-03)
**Original decision recorded 2026-10-24:** Supabase Auth with Google OAuth and Facebook OAuth, plus a **numeric emailed one-time code** fallback. Instagram is a social connection only, **not an authentication provider**. Password-based sign-up and password-based login were removed from the preview `Auth.jsx`.

**Owner direction updated 2026-11-03:** Existing accounts may also sign in with their existing password, alongside email magic-link/OTP. This supersedes the password-login removal only. **Password sign-up remains disabled.** No password reset flow or new credential creation is introduced by this change.

**Runtime evidence 2026-11-03 (canonical project `ssibsfmtodgximseeqsv`):**
- Three Auth users exist; all three have confirmed email addresses, email identities, and non-empty password hashes. Hash presence does not prove a user's entered password is correct; never request or expose passwords.
- Auth logs show the attempted email OTP request returned 200 and was sent as `magic_link`; a subsequent `/verify` returned 303 and a login event was recorded. Both requests used `http://localhost:3000` as the referer because the attempt occurred before PR #193's same-origin redirect fix was deployed.
- Google and Facebook authorization attempts returned 400 with `provider is not enabled`.

**Code repair merged in PR #193:** email sign-in now supplies the current site origin plus the existing validated `returnTo` destination as `emailRedirectTo`. The currently configured email template sends a magic link, not a numeric token; the UI can handle either template. Google/Facebook buttons are hidden unless explicitly enabled with `VITE_SUPABASE_OAUTH_PROVIDERS`.

**Password sign-in PR #194:** adds password login for existing accounts only, retains email link/code sign-in, and explicitly leaves password sign-up disabled. Its Cloudflare Pages preview build passed `npm ci`, `npm test`, and `npm run build`; the preview login page displays both methods. It is not production until merged and deployed.

**Still requires Supabase Auth configuration verification:** set the Site URL to `https://interplanetaryfund.com`; confirm the redirect allowlist includes the apex production callback; change the email template to use `{{ .Token }}` if numeric codes are required instead of magic links; configure custom SMTP before public users depend on email delivery; and set appropriate rate limits. Google/Meta remain disabled until provider apps and credentials are approved. Do not enable Instagram or password sign-up. For verified-email ownership-link consent and fallback-to-Base44-email procedure, see [PHASE3_AUTH_PLAN](PHASE3_AUTH_PLAN.md).

## B9 — Historical source counts, NOT exported records
**UNVERIFIED as of 2026-10-24:** `interplanetary-fund2` branch `migration/owner-proof-gate-20261023`, `host/migration/content-parity-manifest.mjs`, reports `User:10`, `Campaign:27`, `PlatformConnection:32`, `Recommendation:836`, `Donation:0`, `Withdrawal:0`. This manifest describes a source snapshot, **not** a successfully run API, CLI, or service-role export with row-by-row hashes. The manifest's staged recommendation count is only `100`; it does not demonstrate complete migration. All counts, especially financial zeros, are provisional until owner-approved real export plus PayPal/Stripe ledger reconciliation. Owner approval is mandatory **before** any real Base44 data or media export.

## B10 — Phase 1 build verification and code review
Local execution environment cannot resolve npm registry DNS (`EAI_AGAIN`). Public-repository standard GitHub Actions is the no-billing run route; `.github/workflows/migration-phase1-checks.yml` is configured to execute a real npm-generated lockfile, clean `npm ci`, `npm test`, `npm run build`, and Prettier from an internet-connected runner, with only a non-production phase-branch commit for formatting and lockfile if permitted. **Report the actual workflow run and logs in STATUS.md; never claim this passed until the completed workflow reports success.**
CodeRabbit previously produced a manual `CHANGES_REQUESTED` review with four major findings: missing CSS build dependencies, anonymous draft loss, edits overwritten by session refresh, and cascading deletion of campaign history. Source fixes for the first three were already committed; the campaign user deletion FK was changed to `RESTRICT` in the proposed unapplied SQL. `.coderabbit.yaml` now adds automatic review of migration target branches. A latest-head review is requested but not a substitute for a completed review.

## B11 — Payment webhook cutover (OWNER APPROVAL REQUIRED)
Keep `https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook` explicitly recorded as a currently **hard-coded URL in source**, not as a verified active provider dashboard registration. The provider's actual PayPal/Stripe webhook destinations, live secrets and idempotency behavior are UNKNOWN. No webhook, payout setting, PayPal account or Stripe configuration may change before the owner approves a specific plan in the separate payments PR. Old Base44 endpoint remains untouched and Base44 stays live/read-only throughout the development phases.

**B7/B10 resolution update — 2026-10-25 UTC:** [Actions run 40156868430](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/40156868430) executed a real `npm install --package-lock-only`, installed `npm ci` dependencies, passed **9/9** `npm test` checks, passed `npm run build` (Vite 6.4.3, 2.08s), and ran Prettier `--write` plus `--check`. Generated package lock and formatter changes were committed as `b62e726`. Prior local npm `EAI_AGAIN` no longer blocks reproducible **hosted** build validation. It does not establish Phase 2-7 parity; latest CodeRabbit findings and approval-gated integrations remain unresolved. 

## B12 — Runtime secret handoff and payment destination mismatch (2026-10-25, NOT CONFIGURED)
**VERIFIED names only:** The Base44 owner authenticated to CLI and listed 20 secret **names**. Cloudflare Worker secret-name reads (non-mutating) returned zero bindings for `interplanetary-fund2` and `ifund-oauth`; the unrelated `ifund-email-ingress` Worker had three existing mail secrets. This does not cover Pages variables, encrypted values, future Workers, or secret ownership. [Full inventory](SECRET_DESTINATIONS.md).

**UNKNOWN/blocks payment cutover:** Where the PayPal REST app actually sends notifications, whether its merchant matches the hosted-link receiver, how to obtain a valid `PAYPAL_WEBHOOK_ID`, and whether PayPal hosted checkout emits the expected events. The proposed [platform-support webhook PR #145](https://github.com/interplanetarysister/InterplanetaryFund/pull/145) needs `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_URL` and modern `SUPABASE_SECRET_KEY` (or a legacy service_role JWT). New Supabase secret keys are **not** bearer JWTs; PR #145 has a staged code fix and tests for this. No credential values were imported, no key was rotated, no new Worker configured or deployed, and no real payment was attempted.

**Critical project separation:** Both Supabase projects are active. The owner has designated the newer `ssibsfmtodgximseeqsv` target in PR #148, but the older published Pages deployment has not been safely switched. Do not point production payment Workers at the newer project until schemas, users, ledger correctness, tests and source-parity requirements pass.


## B13 — Code merged, independent production cutover still blocked (2026-10-25)

**Verified after PRs #138, #149, #150 and #151 were merged:**
- Destination Supabase `ssibsfmtodgximseeqsv`: `auth.users = 0`; `public.ifund_campaigns = 0`; `public.ifund_posts = 0`. No signed-in two-user RLS smoke test can be truthfully claimed yet.
- Cloudflare: 16 production Worker route patterns on apex/www point to `interplanetary-fund2` instead of the independent Worker in #150. The legacy Worker retains Base44-dependent behavior from the prior runtime audit.
- Pages: `interplanetaryfund-migration` production deployments disabled, production branch `migration/phase7-offline-cutover-gate`; merging the integration branch does not change the published application.
- Frontend feature flags and Worker migration preview mode remain disabled by default. The deployed PayPal webhook/ledger, payout account approval, bank/donor ownership, and provider settlement are unverified.

**Actions blocking safe Base44 shutdown:** Securely migrate verified Supabase users and campaign ownership with explicit consent, reconcile source content/media and donations, audit RLS and browser column grants with actual two-account negative tests, review/merge remaining source phases and PayPal/finance/webhooks, deploy independent Worker and Pages to a nonproduction route, prove Base44-free HTTP response parity and rollback, then separately authorize production cutover. Data import must not be faked by relabeling the private legacy snapshot tables.

**Merge queue:** #139–#143 currently have conflicts after #138 landed and unresolved review findings. Resolve their conflicts and review findings one at a time rather than force-merging old stacked changes; #141/#142 contain API/UI implementations already extracted cleanly to merged #150/#151. #144/#146/#147/#148 are draft/review-gated; #145 platform-support payments alone are not campaign donations and withdrawals. Obsolete #136 must never be merged.

## B14 — Owner campaign publish flow is code-complete but runtime-unverified (2026-11-02)

**VERIFIED in source and unit tests:** `apps/web` now has owner campaign management (`/campaigns`, `/campaigns/:id/edit`). Status transitions `draft → active → paused → active` are enforced client-side; publish readiness mirrors the `ifund_publish_complete` constraint from `supabase/migrations/20261025011400_initial.sql`; every query is scoped to `owner_id = auth.uid()`; returned rows are verified; deletion is limited to drafts. 18 new `node:test` cases pass (58/58 in `apps/web`), the Vite build succeeds, and the preview server renders the routes.

**UNKNOWN / blocks a truthful "publishing works" claim:**
- No authenticated browser session has exercised the flow. `ssibsfmtodgximseeqsv` has **zero Auth users**, so the publish→Discover round trip, the live constraint behavior, and cross-account RLS negative tests cannot be run yet.
- The required browser grants for the lifecycle are assumed to match `20261025011400_initial.sql` (`insert(owner_id,...)` / `update(title,...,status)` for `authenticated`). Whether the **live** destination project has those exact grants is unverified; a previously applied broader or narrower grant set would change behavior. See the Phase 1 note that source grant corrections are not applied live.
- Whether the published Pages project serves this `apps/web` bundle at all is unchanged from `DEPLOYMENT-GATES.md`: the public-site-port branch is not the deployed production branch.

**Next proof:** create one test Auth user, insert one owned draft, publish it, confirm it appears in an anonymous `ifund_campaigns?status=eq.active` read, then confirm a second user cannot read or modify it. That requires owner authorization for a non-production Supabase environment. No production change was made.

## B15 — Supabase runtime verification blocked: no credentials in the development environment (2026-11-02)

**Cannot be executed here.** The requested Priority 2 runtime verification (registration/authentication, campaign create → edit → publish → Discover, pause/resume, owner-only permissions, cross-account RLS, persistence after refresh) requires an authenticated session against `ssibsfmtodgximseeqsv`.

**Exact blocker:**
- No Supabase credentials are available: `SUPABASE_URL`, `SUPABASE_ANON_KEY`/publishable key, `SUPABASE_SERVICE_ROLE_KEY`/`sb_secret_...`, and any database password are all unset in this environment. Only `GITHUB_TOKEN` is provided.
- No `supabase` CLI, `psql` or `wrangler` binary is installed, so no management API or direct SQL connection can be made.
- Only `apps/web/.env.example` and `.env.example` exist; no populated `.env` file is present.
- Creating test Auth users requires the service-role/secret key or the dashboard, neither of which is available, and doing so is a live write to the destination project that the AGENTS.md rules gate behind explicit owner authorization.

**What is verified instead (source-level):** the required schema, policies and grants are present in `supabase/migrations/20261025011400_initial.sql` — `status in ('draft','active','paused')`, the `ifund_publish_complete` check, owner-scoped insert/update/delete policies, and the column-level browser grants that cover `status`. This confirms the code is written against the intended contract; it does **not** confirm the live project matches it.

**To unblock, the owner must provide one of:** a non-production Supabase project with the migrations applied plus a service-role key for creating test users; or an existing staging project with two test accounts. Per the migration rules, a separate staging environment or test credentials must be explicitly authorized. No production data or financial records were read or modified.

## B16 — `ifund_posts` insert policy does not check account status (2026-11-02)

**Defect (partially fixed in the browser, still open server-side):** `/social` and `/community` were not wrapped in `MemberAccess` and inserted posts straight into `ifund_posts` from the browser. The RLS policy in `supabase/migrations/20261025011400_initial.sql` is:

```sql
create policy ifund_posts_insert on public.ifund_posts
  for insert to authenticated with check (author_id = (select auth.uid()));
```

It checks only ownership. It does **not** check `ifund_profiles.account_status = 'active'` or `account_deletion_pending = false`. So an authenticated account that is suspended, or scheduled for deletion, could still insert posts by calling PostgREST directly, regardless of any client-side gate.

**Fixed in the browser (this branch):** `src/lib/socialPosts.js` adds `canMemberPost` (confirmed email + `verifyAccountLifecycle`) and `publishPost`, which validates the body to 1–2000 characters — the same rule as `worker/communityWrites.js` — and the feed page now gates its composer and publishes through that path instead of a raw insert. 8 new tests, including that a suspended account or an unconfirmed email attempts no write at all. `apps/web` is now 92/92.

**Still open / requires server work:** the browser fix is UX and defence in depth only. RLS remains the boundary, and the boundary is permissive. Closing it needs a policy or trigger that consults `ifund_profiles` for the acting user, for example:

```sql
with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.ifund_profiles p
              where p.id = (select auth.uid())
                and p.account_status = 'active'
                and p.account_deletion_pending = false)
);
```

That is a schema change to a table the AGENTS.md rules require to be independently reviewed and staging-tested before any application, and it cannot be applied here (no credentials, no CLI — see B15).

**Fix written and verified against real Postgres (2026-11-02):** `supabase/migrations/pending/20261102_ifund_member_schema_completion.sql` section 8 replaces both the post and campaign insert policies with a check that calls `public.ifund_current_account_is_active()`. Verified by executing the migration on PostgreSQL 16 (PGlite) with three accounts — a suspended account's insert is now rejected and an active account's succeeds (`tests/member-schema-migration.test.js`, 11 tests). **Status: fixed in SQL, not yet applied to the live project.** Until the migration is applied, a suspended account can still post by bypassing the UI.

**Follow-up (2026-11-02): the first fix was incomplete.** It guarded `INSERT`
only. A suspended owner could still reach `status = 'active'` by *updating* a
draft created while the account was active, and could still edit campaign
content. Reproduced on PostgreSQL 16: a suspended owner ran
`update public.ifund_campaigns set status='active'` and one row changed. The
member migration now also gates `UPDATE` on `ifund_campaigns` (both `USING` and
`WITH CHECK`). `ifund_posts` has no `UPDATE` policy in the committed set, so its
insert policy is its only write path.

The gate is deliberately asymmetric: `DELETE` on campaigns is left owner-only so
a suspended account can still remove its own drafts. Publishing and editing are
what the lifecycle gate blocks.

10 tests in `tests/account-lifecycle-write-gate.test.js` cover both halves,
including the publish-by-update bypass, content edits, the deletion-pending
boolean, and the fail-closed case of an account with no profile row.


## B17 — Cloudflare Pages deploy cannot run here: no API token (2026-11-02)

**Deploy is prepared and blocked on credentials only.**

- Attempting `npx wrangler pages deploy dist --project-name=interplanetaryfund-migration --branch=preview` fails with:
  `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.`
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and any `CF_*` variable are all unset, and there is no `~/.wrangler` or `~/.config/.wrangler` auth state.
- The GitHub Actions workflow `.github/workflows/deploy-web-pages.yml` is ready to do the publish once the repository secrets/variables exist.

**To unblock, the owner must add:** repository secret `CLOUDFLARE_API_TOKEN` (scoped to *Cloudflare Pages: Edit*), repository secret `CLOUDFLARE_ACCOUNT_ID`, and repository variables `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`. Then run the workflow with `production: false` for a preview, and confirm the preview URL before any production run. Do not add a service-role key: it would be baked into the public bundle.

**Not done here:** no DNS change. Attaching `interplanetaryfund.com` remains a dashboard action behind the cutover gate in `apps/web/DEPLOYMENT-GATES.md`.

## B18 — The committed migration set created 6 tables; the code queries 11 (2026-11-02)

**Defect:** a code-versus-schema reconciliation found that the committed migration set (`20261025011400_initial.sql` plus the two blog migrations) creates six `public.ifund_*` tables, while `src/`, `apps/web/src/` and `worker/` query eleven:

| Table | Referenced by | Was it created? |
|---|---|---|
| `ifund_profiles`, `ifund_campaigns`, `ifund_posts`, `ifund_connections`, `ifund_blogs`, `ifund_blog_entries` | multiple | yes |
| `ifund_legal_acceptances` | `apps/web/src/components/auth/MemberAccess.jsx` | **no** |
| `ifund_notifications` | `apps/web/src/lib/inbox.js` | **no** |
| `ifund_inbox_items` | `apps/web/src/lib/inbox.js` | **no** |
| `ifund_follows` | `apps/web/src/lib/followedCampaigns.js` | **no** |
| `ifund_official_publications` | `apps/web/src/lib/editorial.js` | **no** |

Also missing: `public.ifund_current_account_is_active()` (called by the pending follows migration and now by the corrected write policies), and the `ifund_profiles.account_status` / `account_deletion_pending` columns that `apps/web/src/lib/accountLifecycle.js` and `MemberAccess.jsx` select.

**Impact:** the member agreement gate, the Universal Inbox, notifications, campaign follows and the account-status check all read a table or column that did not exist, so each failed closed. Two of the missing objects were also assumed to exist by `supabase/migrations/pending/20261101_ifund_legal_acceptance_and_follows.sql`, which therefore could not have applied as written.

**Fix written (2026-11-02):** `supabase/migrations/pending/20261102_ifund_member_schema_completion.sql` creates all of it — additive, idempotent, RLS on every table, explicit column-level grants, server-owned columns never granted to browsers, and `account_status` defaulting to `pending` (never `active`). Verified on PostgreSQL 16 by `tests/member-schema-migration.test.js`, which also asserts that every `ifund_*` table the code queries now exists.

**Not applied.** This needs a staging apply and a two-account check against `ssibsfmtodgximseeqsv` (B15). Applying it changes behavior: an account not yet reconciled to `account_status='active'` can no longer publish posts or create campaigns. That is the intended fail-closed behavior, but reconciliation must set `active` for verified accounts first, or legitimate members will be locked out of publishing.

## B19 — The Cloudflare Pages project may build the root frontend, not `apps/web` (2026-11-02)

**Finding:** this repository contains two React applications. The root `src/` app is the earlier migration preview (routed via `src/App.jsx`: `/`, `/discover`, `/campaign/:id`, `/create`, `/edit/:id`, `/mine`, `/community`, `/blogs`, …). `apps/web/` is the branded application with the owner campaign lifecycle, share kit, mobile shell and Supabase transport. Only the root app has `_redirects`-independent SPA behavior handled by Pages defaults; `apps/web` carries `public/_redirects` and `public/_headers` added for Pages.

`.github/workflows/deploy-web-pages.yml` publishes `apps/web/dist`, but the existing Pages project `interplanetaryfund-migration` was created earlier and its build configuration is not in this repository. `docs/migration/OWNER_ACTIONS.md` already asks the owner to "check whether interplanetaryfund.com currently serves the new, incomplete Cloudflare Pages app".

**Why it matters:** if the Pages project builds the repository root rather than `apps/web`, the branded application is not what visitors see, and none of the `apps/web` work is live.

**Required owner action:** open Cloudflare dashboard → Workers & Pages → `interplanetaryfund-migration` → Settings → Builds & deployments, and report the configured build command and output directory. If it builds the root app, switch it to the `apps/web` build (`npm ci && npm run build` with root directory `apps/web`, output `dist`) or deploy via the workflow instead. This cannot be inspected from here: no Cloudflare credentials (B17).

## B20 — Any authenticated account can publish to the official blog (2026-11-02)

**Defect (exploitable, live on the deployed root app):** the committed blog
migration's insert policy is self-referential:

```sql
create policy ifund_blog_entries_owner_insert on public.ifund_blog_entries
  for insert to authenticated
  with check (owner_auth_user_id = (select auth.uid()));
```

It asks whether the row claims the actor owns it, not whether the actor owns the
blog the row is filed under. `blog_id` is never compared against
`ifund_blogs.owner_auth_user_id`. So any authenticated account can insert a row
with its own `owner_auth_user_id` and the official Reporter blog's `blog_id`.
Combined with `ifund_blog_entries_read_public_or_owner`, a row inserted with
`status = 'published'` is immediately readable by `anon`.

**Reproduced, not theorised.** `tests/blog-entry-ownership.test.js` applies the
committed migrations to PostgreSQL 16 and inserts a published entry into the
official blog as a non-owner: the insert succeeds and an anonymous query returns
the row. The suite keeps that as a named regression guard so the defect cannot be
quietly forgotten.

**Why this is live:** the deployed production bundle is built from the repository
root, and the root app contains the reporter publishing workspace
(`src/pages/MyBlog.jsx` via `src/lib/blogs.js`). The client does check the blog
owner first, but RLS is the boundary and the boundary was missing, so PostgREST
can be called directly.

**Related gap in the same family:** the update policy's `WITH CHECK` also
inspected only `owner_auth_user_id`, so a member holding any entry could retarget
its `blog_id` onto the official blog.

**Fix written (2026-11-02):**
`supabase/migrations/pending/20261102_ifund_blog_entry_ownership_fix.sql`
requires that the acting user owns the blog the entry is filed under, on insert,
update (both `USING` and `WITH CHECK`) and delete. It depends only on
`ifund_blogs`, which the committed set already creates, so it is independent of
the member-schema migration and either apply order works. A legitimate owner
keeps create, publish, edit and delete.

**Not applied.** 8 tests in `tests/blog-entry-ownership.test.js` cover the hole,
the fix, owner capability, retargeting, third-party access and idempotency. The
file also contains a read-only remediation query to find any forged rows already
present; it is not run automatically and no existing row is deleted.

**Until applied, treat any published entry on the official blog as unverified.**


## B29 — VERIFIED PRODUCTION DEPENDENCY: public.ifund_current_user_is_verified_admin

The Studio Worker calls `public.ifund_current_user_is_verified_admin()` indirectly
through `public.ifund_current_user_is_verified_super_admin()`. A read-only
inspection of the intended production project on 2026-11-03 confirmed that both
functions exist, are SQL/STABLE SECURITY DEFINER functions with an empty pinned
search_path, deny execution to `anon` and `PUBLIC`, and grant execution to
`authenticated`.

The verified-admin function also checks protected `app_metadata.role` values or
a verified legacy-owner mapping against the source owner, active account,
confirmed email, and unique destination mapping. Its dependencies include the
existing `ifund_transfer.owner_identity_map`, `ifund_stage."user"`, and
`public.ifund_profiles` objects.

**Migration parity is still outstanding:** this function is present in the
production database but is not defined in the current preview branch's committed
migration set. The test suite records it as a documented production dependency
rather than pretending the preview branch is independently bootstrappable. Before
a fresh-project cutover, include the verified function and its prerequisite
schemas/tables in the ordered migration chain and validate it against production.
No production SQL was changed during this verification.
