# Canonical frontend decision and deployment plan — 2026-11-02

Inputs from the owner's independent check of the live Cloudflare Pages project:

- The latest production deployment of `interplanetaryfund-migration` was built
  from the **repository root** with output `dist`, deployed **2026-10-30**. It is
  **not** deploying `apps/web`.
- The project's current GitHub source setting references **`interplanetary-fund2`**,
  while the latest production deployment references **`InterplanetaryFund`**.
- Automatic production deployments are **disabled**.

## Decision: `apps/web` is canonical

`apps/web` is the canonical frontend. It has 28 pages to the root app's 17, and
every root route now has an `apps/web` equivalent. The one real gap — the
reporter publishing workspace — was closed on 2026-11-02 (commit `e4e2092`), so
`apps/web` is now a true superset of the root app's user-facing surface.

The remaining order is: **fix B20, verify in preview, promote `apps/web`, then
retire the root app from deployment.**

### Route-by-route

| Root route | `apps/web` equivalent | Notes |
|---|---|---|
| `/`, `/discover`, `/blogs`, `/blogs/:id`, `/campaign/:id`, `/community`, `/connections`, `/contact`, `/create`, `/help`, `/help/:slug`, `/login`, `/privacy`, `/terms`, `/about` | present | `apps/web` additionally has `/dashboard`, `/inbox`, `/notifications`, `/following`, `/profile`, `/social`, `/campaigns/:id/edit`, `/publications/:id`, `/founding-members`, `/download`, `/embed/campaign/:id`, `/forgot-password`, `/reset-password`, `/register` |
| `/edit/:id` | `/campaigns/:id/edit` | rename only |
| `/mine` | `/dashboard` + `/campaigns` | superset |
| `/my-blog` | `/publication` (and `/my-blog`) | **ported 2026-11-02 — gap closed** |

`apps/web` is now a strict superset in user-facing surface. `/my-blog` is routed
as well as `/publication`, so the root app's existing links keep working.

### The gap that was: the reporter publishing workspace (now closed)

**Closed 2026-11-02.** The root app could **create, save and publish** member
stories:
`src/pages/MyBlog.jsx` → `src/lib/blogs.js` (`getReporterWorkspace`,
`saveReporterStory`). `apps/web` only **reads** published stories
(`src/lib/editorial.js` → `ifund_public_blog_entries_read`).

This matters beyond parity, because it is why blocker B20 is live: the deployed
root app is the one holding the write path into `ifund_blog_entries`, and that
write path is missing its authorization check. Promoting `apps/web` without the
B20 fix would remove the exploitable surface by accident rather than by design,
which is not a fix — the RLS hole would remain open to anyone calling PostgREST.

The port needed **no new schema** — the committed blog migration already
contains owner insert/update/delete policies and grants. What it needed was the
B20 fix plus `apps/web/src/lib/reporterWorkspace.js` (owner-scoped, lifecycle-
gated, response-verified), `apps/web/src/pages/MyPublication.jsx`, two routes,
and 16 tests. All shipped in `e4e2092`.

## The Cloudflare configuration discrepancy is a supply-chain risk

The project's GitHub source setting points at **`interplanetary-fund2`**, which
`AGENTS.md` designates as **read-only source**. Two consequences:

1. If that setting is ever used to build, the deployment is built from a
   repository the migration is not allowed to build from — a different codebase
   than the one under review here.
2. It contradicts the latest production deployment, which came from
   `InterplanetaryFund`. A source setting that disagrees with the last known good
   deployment is exactly the condition under which an accidental production
   deploy ships something nobody reviewed.

Because automatic production deployments are disabled, the exposure today is
limited to whoever triggers a manual deploy. That is a reason to fix the setting
deliberately, not a reason to leave it.

**Recommended target configuration:**

| Setting | Value |
|---|---|
| Repository | `interplanetarysister/InterplanetaryFund` |
| Production branch | the branch that is actually reviewed and deployed — confirm before changing |
| Root directory | `apps/web` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Automatic production deployments | leave disabled until the preview path is proven |

Do not change this from here. It is a dashboard action, and it is the change that
decides what production serves.

## Deployment plan

Ordered, with a gate at each step. Nothing here is executed from this
environment: there are no Cloudflare credentials (B17) and no Supabase
credentials (B15).

1. **Apply the two pending security migrations to a preview/staging database.**
   `20261102_ifund_blog_entry_ownership_fix.sql` (B20) and
   `20261102_ifund_member_schema_completion.sql` (B18/B16). Verify with the
   in-repo suites plus the two-account checks against real Postgres.
2. **Run the B20 remediation query against the live project** (read-only, in the
   migration file) to find any forged entries already published under the
   official blog. Decide on cleanup as a separate reviewed action.
3. **Port the reporter workspace into `apps/web`**, using the existing blog
   schema, with tests covering the owner check. This is the last parity gap.
4. **Deploy `apps/web` to a Pages preview** via
   `.github/workflows/deploy-web-pages.yml` with `production: false`. Confirm the
   `*.pages.dev` URL: deep links, the embed route, auth round-trip, and mobile
   layout.
5. **Correct the Pages project source setting** to
   `interplanetarysister/InterplanetaryFund` with root directory `apps/web`.
6. **Promote to production only after 1–5**, then attach `interplanetaryfund.com`
   per `apps/web/DEPLOYMENT-GATES.md`.
7. **Retire the root app from deployment** once `apps/web` is serving, so there is
   one canonical frontend and no ambiguity about what a deploy means.

## Account lifecycle: verified-accounts-first, as directed

Confirmed and unchanged from the directive. The member migration defaults
`account_status` to `pending`, so an unreconciled account gains no access. The
sequence is:

1. Confirm destination authentication and ownership for each identity.
2. Activate **only** the verified accounts (`account_status = 'active'`).
3. Test in preview that activated accounts can publish and that suspended
   accounts cannot.
4. Then apply to production.

**The seven identities awaiting destination login stay inactive.** They must not
be activated by matching email addresses, and this repository contains no
mapping code, so nothing here can do it even accidentally. The three already
verified and the ten mappings are not modified by any migration in this branch:
the migrations add schema and policies, and touch no identity row.

## Hosted Supabase compatibility: still unverified, and I will not claim otherwise

You are right to keep this open. What is proven and what is not:

| Claim | Evidence |
|---|---|
| The SQL parses, constrains, triggers and RLS evaluate correctly | Proven: 19 tests across two suites on PostgreSQL 16 (PGlite) |
| Column-level grants behave as intended | Proven on PGlite |
| The policies behave correctly for two accounts and a suspended account | Proven on PGlite |
| The same holds on hosted Supabase, with its `auth` schema and PostgREST | **Not proven** — no credentials (B15) |
| Applying the migrations to the live project is safe | **Not proven** — requires a staging apply |
| The deployed bundle serves `apps/web` | **Not proven** — currently it serves the root app |

PGlite is a real Postgres engine, so the SQL evidence is strong. It is not
Supabase, so "works on PGlite" is not the same claim as "works in production",
and the difference is exactly the part that has not been tested.

## On the production Supabase records

You confirmed the 133 tables, 13 cutover services with acceptance flags false,
10 owner mappings (3 verified, 7 awaiting login), four import batches totalling
482 records pending verification, and zero workflow-control records or queued
jobs. Noted as authoritative and **outside this repository's reach**.

Nothing in this branch creates, recreates, overwrites or migrates any of those
records. Specifically:

- the two pending migrations are additive DDL only — no `insert`, no `update`, no
  `delete` against any existing row;
- no import, batch or identity table is touched;
- the B20 fix closes a write path and leaves existing rows exactly as they are.

The "zero workflow-control records / zero queued jobs" finding is consistent with
this repository: there is no job or workflow-control table in any migration, so
that machinery was never built here and must not be invented to make the audit
look complete.
