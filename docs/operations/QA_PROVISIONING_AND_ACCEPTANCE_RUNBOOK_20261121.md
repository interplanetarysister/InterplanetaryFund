# QA identity provisioning and authenticated acceptance runbook — 2026-11-21

## Status

**BLOCKED — no QA identities were created and no authenticated browser acceptance was performed.**

On 2026-11-21 the owner selected option **2**, explicitly authorizing elevated QA identities to be provisioned directly in the production Supabase project instead of an isolated QA project. This decision is recorded in the section below. Execution remains blocked because the required Supabase administrator credential is not available in any authorized secret store reachable from this environment. Rechecked on 2026-11-22: process environment and GitHub repository secrets still contain no Supabase admin key. The owner approval flag `IFUND_QA_PROVISION_APPROVED` was set to the exact required value `YES` at Windows user scope; this harness's shell snapshot does not inherit user-scope changes, so the value will also be injected explicitly when the provisioning command is executed. No password, JWT, service-role key or other credential value is recorded in this document.

## Kit audit (completed)

Source: `ifund-qa-provisioning-kit.zip`, extracted under the local temp directory only. Kit contents: `credentials.json`, `provision.mjs`, `README.txt`. The extract was **not** copied into the repository and `credentials.json` was not committed.

`provision.mjs` was audited before execution:

- It calls the official Supabase Auth Admin endpoint `POST https://<project>.supabase.co/auth/v1/admin/users` with the service key in `apikey` and `Authorization: Bearer` headers. This is the documented admin API; it does **not** insert into `auth.users` or mutate Supabase internal tables.
- It enforces three guards before any request: `SUPABASE_PROJECT_REF` must equal the kit's pinned `ssibsfmtodgximseeqsv`, `SUPABASE_SERVICE_ROLE_KEY` must be present, and `IFUND_QA_PROVISION_APPROVED` must equal `YES`.
- It sets `email_confirm: true`, `app_metadata.qa_account`, `app_metadata.qa_scenario`, and, for the two elevated scenarios, `app_metadata.role` of `admin` / `super_admin`.
- It persists `status: CREATED` and the returned user ID back into the kit's `credentials.json` after each successful creation.
- All five kit rows are still `NOT CREATED` with no `user_id`.

The script's transport is acceptable. It was **not executed**, because the required credential is unavailable.

## Credential search (completed, no values read or logged)

| Source | Result |
|---|---|
| Process environment | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `IFUND_QA_PROVISION_APPROVED`, `SUPABASE_URL`, `CLOUDFLARE_API_TOKEN` all unset |
| GitHub repository secrets | Only `CLOUDFLARE_ACCOUNT_ID` and `CONVEX_DEPLOY_KEY` |
| GitHub repository variables | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (browser-safe values) |
| `~/.supabase`, Supabase CLI config | Absent; Supabase CLI not installed |
| Windows Credential Manager | Only Microsoft/GitHub/gh identities; no Supabase credential |
| Repository `.env*` files | `.env.example` templates only, no values |
| Local secret stores / vault CLIs | No `az`, `op`, `vault` or equivalent available or authenticated |

**Exact missing requirement:** a server-side Supabase admin credential — either a modern `sb_secret_...` key or a legacy service-role JWT — delivered into a local environment variable or an authorized secret store. The kit additionally requires `IFUND_QA_PROVISION_APPROVED=YES`. No credential value should be pasted into chat, a terminal log, an issue, or Git.

Note: `provision.mjs` sends the key as a Bearer token. Modern `sb_secret_...` keys are not JWTs and must be sent with the `apikey` header only (see `docs/migration/SECRET_DESTINATIONS.md`). If only a modern key is supplied, the script needs a reviewed two-line header fix before execution; the project pin and approval guards must remain.

## Authorization-model finding (important)

The kit sets `app_metadata.role`, but that alone **cannot be assumed to grant admin or super-admin access** in this application.

- `public.ifund_current_user_is_verified_super_admin()` (`supabase/migrations/20261103120000_ifund_studio_super_admin.sql`) requires **both** `ifund_current_user_is_verified_admin()` **and** `auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin'`.
- `public.ifund_current_user_is_verified_admin()` is a verified production dependency with no defining DDL in the committed migration set (`docs/migration/BLOCKERS.md`, B29). Production documentation says it checks protected `app_metadata.role` values **or** a verified legacy-owner mapping against `ifund_transfer.owner_identity_map`, `ifund_stage."user"` and `public.ifund_profiles`, including source owner identity, active status, confirmed email and mapping uniqueness.
- The frontend's `useAdminAccess` calls the server RPC `ifund_current_user_is_verified_admin`; it never trusts browser profile fields. Whether the kit's protected `app_metadata.role` value is accepted must be confirmed from the live function definition, not inferred from documentation.

Therefore, after Auth Admin creation, elevated QA identities must be verified through the live RPC before they are treated as authorized. If they fail closed, a separately authorized, audited server-side mapping step is required. That step is **not** part of the supplied kit. Do not weaken `ifund_current_user_is_verified_admin()`, do not add a second role system, and do not modify real administrator mappings to make QA pass.

## Owner decision and production scope — 2026-11-21

The owner replied with option **2**, explicitly authorizing elevated QA identities to be provisioned in the production Supabase project `ssibsfmtodgximseeqsv`. No isolated QA project is configured.

Scope of this authorization:

- Exactly the five identities in the supplied QA kit.
- No new paid subscriptions, payment execution, payouts, refunds, routed mail, provider grants or external-platform actions.
- No modification or deletion of real owner, admin or super-admin accounts.
- No change to `public.ifund_current_user_is_verified_admin()`, `public.ifund_current_user_is_verified_super_admin()`, their grants, RLS or any other authorization gate.
- All synthetic campaign/ownership records must be clearly QA-marked and removed after acceptance.

## Verified-admin mapping approach (source-only, not executed)

1. Before any write, use authorized read-only database access to inspect the live definitions and dependencies:
   - `select pg_get_functiondef('public.ifund_current_user_is_verified_admin()'::regprocedure);`
   - `select pg_get_functiondef('public.ifund_current_user_is_verified_super_admin()'::regprocedure);`
   - Column and constraint metadata for `ifund_transfer.owner_identity_map`, `ifund_stage."user"` and `public.ifund_profiles`.
   Record only non-sensitive metadata outside Git; never commit private emails, IDs or keys.
2. Determine the exact protected role values and mapping fields the live verifier accepts. Do not infer them from older documentation.
3. If the live verifier accepts a protected role value already set by the kit, add **no** mapping row. Verify the result through an authenticated `ifund_current_user_is_verified_admin()` / `ifund_current_user_is_verified_super_admin()` RPC call after a real browser login.
4. If a mapping row is required, create only QA-specific rows using the live schema's exact columns and constraints. Each row must use a synthetic source-owner identity, the kit's confirmed email, active lifecycle state, the exact destination Auth UID returned by the Admin API, preserved uniqueness constraints, and a QA audit marker. Never edit or replace a real administrator's mapping.
5. Verify negative cases before browser acceptance: ordinary member and non-owner must return false; QA admin must satisfy verified-admin only if the live contract permits; QA super-admin must satisfy both verified-admin and the protected `super_admin` claim. Any failure is repaired in source or configuration, never by weakening the gate.

## Removal plan

After acceptance completes, or immediately if acceptance is abandoned:

1. Delete all five QA Auth users through the official Auth Admin endpoint `DELETE /auth/v1/admin/users/<user_id>`, using the user IDs recorded by the kit. Do not touch any other account.
2. Delete only mapping rows created solely for these QA identities, identified by the exact QA audit marker and destination Auth UIDs captured before and after the change. If no mapping row was created, record `none`. Never issue broad deletes against `ifund_transfer.owner_identity_map`, `ifund_stage."user"` or `public.ifund_profiles`.
3. Delete QA-marked synthetic campaigns, ownership records and test fixtures created for acceptance, using their exact IDs. Do not touch real campaigns or financial records.
4. Confirm every deleted session is invalidated by attempting a protected RPC with the old token/session and verifying failure.
5. Store a redacted completion record containing user IDs, deleted mapping-row IDs and timestamps, with no passwords, tokens, keys, private emails or campaign contents.

## Acceptance matrix to execute after credentials and mapping are available

| Identity | Authentication | Ownership / role checks | Browser routes and negative cases |
|---|---|---|---|
| QA Member | Real login with kit password; confirm session survives refresh | No admin RPC; no privileged role | `/dashboard`, `/profile`, `/campaigns`; member routes render, admin routes fail closed; logout invalidates session |
| QA Owner | Real login | Owns synthetic campaign; can edit own campaign only | `/campaigns/:id/edit` success on own campaign; non-owner campaign edit denied by backend, not just UI |
| QA Non-owner | Real login | Does not own QA Owner campaign; cannot read private drafts or edit | Same-owner success vs cross-owner denial; refresh and session switch |
| QA Admin | Real login after verified mapping | `ifund_current_user_is_verified_admin()` true; ordinary members false | Authorized `/admin/*` subset; non-admin denied; no payout or erasure actions |
| QA Super Admin | Real login after verified mapping | Verified admin **and** protected `app_metadata.role=super_admin` | Intended super-admin features; admin and member denied; no payment execution |

Also required for every row: public/private campaign visibility, auth persistence after refresh, logout session invalidation, backend rejection of unauthorized actions, narrow/mobile viewport, and no real financial balance or provider receipt.

## Read-only guest browser evidence

The project's `ifund-browser-access` harness is explicitly unauthenticated and read-only; it blocks non-GET methods and disallowed origins. It can verify public route rendering, console/network errors and layout, but it **cannot** perform any of the five logins above. Its results are preliminary guest evidence only and are not role acceptance.

## Definition of done (not yet reached)

1. A service-role/server key is supplied through an authorized channel.
2. The live verified-admin function definitions and dependency schemas are read through authorized read-only access.
3. The kit script is executed unchanged, or only with a reviewed key-header correction, after the project pin and approval guards pass.
4. The verified-admin mapping path is resolved according to the live contract, with no gate weakening and no real-admin mapping changes.
5. All five real browser logins and the matrix above pass, including negative cases and mobile viewports.
6. Failures are repaired with regression coverage and rerun.
7. The QA identities, mapping rows and synthetic fixtures are removed under the plan above and the redacted completion record is stored.
8. Only then may the release gate and deployment steps be reconsidered; they remain red and fail-closed until genuine per-route acceptance exists.
