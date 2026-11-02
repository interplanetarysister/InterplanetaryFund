# Production readiness assessment — 2026-11-02

This is a status report, not a claim of completion. It separates what is
implemented and tested from what is unverified and what is blocked, and it names
who can unblock each item.

**Verdict: not ready for production.** Two blockers are environmental and cannot
be cleared from this workspace (no Supabase credentials, no Cloudflare
credentials). One blocker is a schema apply that is written and tested but
deliberately unapplied because it changes authorization behavior. Two decisions
are required from the owner.

---

## 1. What this session changed

Branch `feature/owner-campaign-lifecycle-20261102`, commit `cf5129e`, pushed to
PR #186. CI green on all three workflows that run for it.

| File | Change |
|---|---|
| `supabase/migrations/pending/20261102_ifund_member_schema_completion.sql` | new — creates the objects the code already queries; closes B16 |
| `tests/helpers/pglite.js` | new — real-Postgres test harness |
| `tests/member-schema-migration.test.js` | new — 11 tests |
| `supabase/migrations/pending/README.md` | new — apply order and verification method |
| `docs/migration/BLOCKERS.md` | B16 updated; B18, B19 added |
| `docs/migration/STATUS.md` | reconciliation section |
| `package.json`, `package-lock.json` | `@electric-sql/pglite` devDependency |

No deployment, no SQL apply, no DNS change, no payment code touched.

## 2. What is implemented and tested

- **Root app:** `npm test` 107/107, `npm run build` succeeds.
- **`apps/web`:** `npm test` 105/105, `npm run build` succeeds.
- **Migration SQL:** executed on PostgreSQL 16 (PGlite) with two active accounts
  and one suspended account; 11 tests covering table existence, RLS isolation,
  constraints, idempotency and the B16 fix.

The suite found a real defect in the migration's first draft (`create policy` is
not idempotent), so the idempotency claim is now actually true rather than
asserted.

## 3. The decisive finding: code and schema had diverged

The committed migration set created **6** `public.ifund_*` tables. The code
queries **11**. Five tables, two columns and one function were referenced but
defined nowhere in the repository or its history:

| Object | Referenced by | Created before? |
|---|---|---|
| `ifund_legal_acceptances` | `apps/web/src/components/auth/MemberAccess.jsx` | no |
| `ifund_notifications` | `apps/web/src/lib/inbox.js` | no |
| `ifund_inbox_items` | `apps/web/src/lib/inbox.js` | no |
| `ifund_follows` | `apps/web/src/lib/followedCampaigns.js` | no |
| `ifund_official_publications` | `apps/web/src/lib/editorial.js` | no |
| `ifund_profiles.account_status`, `.account_deletion_pending` | `accountLifecycle.js`, `MemberAccess.jsx` | no |
| `ifund_current_account_is_active()` | pending follows migration, new write policies | no |

Consequence: the member agreement gate, the Universal Inbox, notifications,
campaign follows and the account-status check each read something that did not
exist, so every one failed closed. The pending
`20261101_ifund_legal_acceptance_and_follows.sql` also assumed two of those
objects existed, so it could not have applied as written. Recorded as B18.

The migration is additive and idempotent, keeps the initial migration's
least-privilege pattern (revoke all, then column-level grants; server-owned
columns never granted to a browser), and defaults `account_status` to `pending`
rather than `active` so a newly seen account cannot silently acquire member
access.

## 4. Security findings

**B16 — suspended accounts could publish.** The post and campaign insert
policies checked only ownership, so a suspended or deletion-pending account
could insert through PostgREST regardless of any client gate. Fixed in SQL
(both policies now require `ifund_current_account_is_active()`), verified
against real Postgres, **not yet applied**.

**`ifund_profiles` is owner-readable only.** RLS is `id = auth.uid()`, so a
public profile page at `/u/:id` is not implementable without a public-read
policy. Not changed here; it needs a product decision about which profile
columns are public.

**Client-side gates are not authorization.** The browser checks in
`socialPosts.js` and `MemberAccess.jsx` are defence in depth. RLS is the
boundary, and until the migration is applied the boundary is still permissive.

## 5. Reconciliation status against the directive

The directive lists audit findings that require verification. What could and
could not be checked from here:

| Finding | Status |
|---|---|
| 133 tables across nine schemas | **Not verifiable here.** No credentials (B15). The repository contains no migration for a `migration`/import schema, so those objects exist only in the live database. |
| 13 migration services not cleared for cutover | **Not verifiable here.** No such table or code in the repository. |
| 10 legacy owner mappings / 3 verified identities / 7 awaiting login | **Not verifiable here.** No mapping table, seed or import script in the repository. |
| 4 import batches, 482 records, all pending verification | **Not verifiable here.** No import batch table or verification code in the repository. |
| No database-backed workflow control records | **Consistent with the repository.** There is no workflow/job table in any migration. |
| No queued workflow jobs | **Consistent with the repository.** No job queue code exists. |

I am not asserting that the first four findings are wrong — only that the
evidence for them is not in this repository and this environment cannot reach
the database that holds it. Anyone treating them as verified without querying
`ssibsfmtodgximseeqsv` would be guessing.

## 6. Feature completeness: route parity

The parity baseline lists 58 routes from the original platform. `apps/web` has
30. The 32 absent routes split into two groups.

**Correctly deferred (financial, administrative, or infrastructure):**
`/admin/*` (10 routes), `/ledger`, `/withdrawals`, `/donors`, `/giving`,
`/subscriptions`, `/analytics`, `/ops`, `/platform`, `/sustainability`,
`/organization-mail`, `/external-accounts`, `/integrations`,
`/founding-members`, `/institutions`. These need schema that does not exist, and
the financial ones must not be faked.

**User-facing and genuinely missing:** `/globe` (the interactive Earth campaign
map), `/u/:id` (public profile, blocked on the RLS policy above), `/agents`,
`/ai-images`, `/communications`, `/devices`, `/connect`, `/community/:id`,
`/my-blog`, `/mission`, `/onboarding`, `/activate`, `/oauth/consent`.

`apps/web/src/App.jsx` also routes 3 paths to a `ComingSoon` placeholder.

**Authentication:** `apps/web` supports email and password only —
`signInWithPassword`, `signUp`, `resetPasswordForEmail`. The directive asks for
Google, Facebook and Instagram. Instagram is explicitly out of scope per
AGENTS.md. Google and Facebook OAuth are **implemented in the root app**
(`src/pages/Auth.jsx` calls `signInWithOAuth`) but **not ported to `apps/web`**.
Porting them is a concrete, bounded next task.

**Financial features:** the directive specifies a 7% platform fee deducted at
withdrawal. There is no donation, ledger, withdrawal or fee code in this
repository and no table for any of it. Nothing was activated, which is correct.
This remains entirely unbuilt.

## 7. Blocked, and on whom

| Blocker | What is needed | Who |
|---|---|---|
| B15 | Supabase credentials or a CLI session for `ssibsfmtodgximseeqsv` — to apply the migration and run the two-account checks against the real project | owner |
| B17 | Cloudflare secrets: `CLOUDFLARE_API_TOKEN` (Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`; variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | owner |
| B19 | The Pages project's configured build command and output directory, to confirm `apps/web` is what is deployed | owner |
| B18 | A staging apply of the member migration **after** reconciliation sets `account_status='active'` for verified accounts | owner + staging |
| Import reconciliation | The four batches must be validated against `ssibsfmtodgximseeqsv`; unresolved identities must not be assigned by matching email | owner + staging |

## 8. What I recommend next

Ordered by value per unit of risk:

1. **Owner reports the Pages build configuration (B19).** Cheap to check, and it
   determines whether any `apps/web` work is live at all.
2. **Port Google and Facebook OAuth into `apps/web`.** Bounded, testable now, no
   credentials needed, and it is an explicit directive item.
3. **Reconcile accounts to `account_status='active'`, then apply the member
   migration to staging and run the two-account checks.** This unlocks five
   member features and closes B16 for real.
4. **Build `/globe` and the remaining discovery surfaces** on the existing
   `ifund_campaigns` table.
5. **Do not start payments until the ledger schema exists and is reviewed.**

I have not opened a separate PR for this report. It describes the work on
PR #186, and the directive asks for one reviewable change per phase.
