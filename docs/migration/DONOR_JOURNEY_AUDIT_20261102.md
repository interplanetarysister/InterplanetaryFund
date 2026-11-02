# Donor journey and public parity audit — 2026-11-02

## Scope and evidence boundary

This is a source-backed audit plus the last available public-site observation. It is
not an authenticated end-to-end browser audit.

- The public-site observation recorded on 2026-11-01 found the reduced root app on
  `interplanetaryfund.com`, no published campaigns, a campaign-table permission
  error, missing `/donate` and `/giving` routes, and no usable campaign checkout.
- A fresh public HTTP recheck on 2026-11-02 could not be completed: the web fetch
  returned an access error and the runtime could not resolve public hostnames.
  Therefore the 2026-11-01 live observations are explicitly historical, not
  represented as a fresh 2026-11-02 runtime result.
- No authorized signed-in browser session was available. Member and admin pages,
  OAuth callbacks, and authenticated donor history were not visited.
- No payment was initiated or submitted. No DNS, domain routing, payment
  configuration, production database, or unrelated production setting was changed.

## Donor journey

### A. Campaign donation

| Step | Evidence | Result |
|---|---|---|
| Homepage | The deployed root-app source renders `Feed`; it has campaign discovery and campaign-creation links, but no PayPal/platform-support button. Its footer says the preview does not enable payment processing. | No donation CTA on the currently documented live frontend. |
| Discover | Root `Discover.jsx` selects active campaigns from `ifund_campaigns`. The last database inspection found one draft and zero active campaigns. | No campaign is available to select. |
| Campaign detail | Root `CampaignDetail.jsx` shows title, category/status, cover, summary, funding goal and story only. It has no `DonateDialog`, checkout control, donation history or updates. Its copy says the preview does not process payments. | Campaign checkout is not implemented in the live root app. |
| Direct donation route | Root `App.jsx` has no `/donate` or `/giving` route; unknown paths fall through to Page not found. | No standalone donation route. |
| Payment completion | No campaign payment endpoint/checkout is wired into the root app. | Cannot complete a campaign gift. |

The last public observation saw `permission denied for table ifund_campaigns`.
The current `main`-branch root `Feed.jsx` and `CampaignDetail.jsx` use explicit
public-column projections. The last measured production branch still uses
`.select("*")` for both `ifund_campaigns` and `ifund_posts`. The live database
confirms anon has no table-level SELECT on either table and cannot select
`owner_id` or `author_id`; it can select the intended public columns. The
production-branch queries therefore remain incompatible with the grants. Do
not widen grants to make `select("*")` work; deploy the explicit-column code
only after branch reconciliation and verification.

### B. Platform support donation

The original Base44 homepage includes a separate PayPal platform-support button.
The independently hosted `apps/web` homepage also includes that button, and its
`PayPalDonateButton` uses the owner-supplied platform-support link.

That path is **not a campaign donation**: the code explicitly says the payment
supports IFund operations and does not credit a campaign. It is absent from the
currently documented live root app. The external PayPal checkout was not opened
or verified in this run, and no payment was made.

### C. What the original source actually does

The read-only Base44 source contains a campaign `DonateDialog` with preset/custom
amounts, an optional 10% platform contribution, PayPal checkout, conditional
Google Pay and Apple Pay, owner-provided Cash App, and crypto options. It also
uses provider capability and feature-flag checks.

Important qualification: the original `usePublicCampaignFundraising` hook
fails closed to **paused** until Base44's `getFundraisingMode` returns
`public_campaign_fundraising: true`. In paused mode, the original dialog offers
platform support only and explicitly says that the campaign cannot receive the
gift. The source therefore does not prove campaign donations were enabled at
the time of this audit.

The current independent `apps/web` hook hardcodes campaign fundraising to
`false`; its funding card disables campaign checkout and displays the paused
notice. This preserves the fail-closed behavior but does not replace the
original server-backed fundraising-mode setting or campaign checkout.


## Supabase production snapshot — read-only, 2026-11-02

The canonical Supabase organization is on the **Free** plan; project
`ssibsfmtodgximseeqsv` is `ACTIVE_HEALTHY`. No SQL writes or migrations were
run during this audit.

- `public.ifund_campaigns`: 2 rows — 1 active and 1 draft, owned by 2 distinct
  users. The anonymous RLS policy permits active campaigns only.
- `ifund_stage.campaign`: 28 rows with 28 distinct legacy IDs. Only 20 rows
  have `owner_auth_uid` mapped, across 3 destination owner UUIDs; 8 rows have
  no mapped owner. The public campaign table contains only 2 rows, so the
  staged/public counts still require row-by-row ID and ownership reconciliation
  before any further promotion.
- Anonymous privileges are column-scoped: `id`, title/content fields and the
  approved public metadata are readable; table-level SELECT is false and
  `owner_id` is not readable. On `ifund_posts`, `author_id` is also withheld.
  This is intentional privacy hardening, not a reason to grant private columns.
- Financial records are empty: `ifund_donations`, `ifund_payment_events`,
  `ifund_donation`, `ifund_financial_operation`, `ifund_withdrawal`, PayPal
  subscription intents, PayPal billing webhooks and generic webhook events each
  have 0 rows. No campaign-payment ledger or withdrawal is evidenced.
- `ifund_stage.campaign_update` and `campaign_translation` each have 0 rows.
  The staging tables for agents/agent activity are empty, and
  `ifund_ops.workflow_jobs`, `workflow_control` and
  `workflow_execution_log` each have 0 rows.
- There are 69 applied migrations and 4 active Edge Functions: three mail
  ingress/admin-mail functions and `ifund-campaign-draft-preview`. That draft
  preview function is not a payment checkout or payment webhook.

This snapshot supersedes the earlier 2026-11-01 statement that there were no
active campaigns. It does not prove the live page can display the active row;
the production-branch `select("*")` query is still blocked by the verified
column-level grants.

## Source parity counts

Counts are derived from the current `main` route source, not from live browser
rendering:

- Read-only Base44 source `interplanetary-fund2/src/App.jsx`: **58 explicit
  routes**, plus wildcard.
- Current `main`-branch root app `src/App.jsx`: **18 explicit routes**,
  plus wildcard.
- The last measured Cloudflare Pages production-branch candidate,
  `migration/phase7-offline-cutover-gate` at `ffc117349756c95cbe661d9e05ccc6fdcf63d6ae`,
  has only **12 explicit root routes**, plus wildcard. Its `src/pages/CampaignDetail.jsx`
  still uses `.select("*")` and has no rejection handler or terminal error state.
  The campaign-detail repair in PR #191 is on a branch targeting `main`; it does
  **not** repair that production-branch candidate.
- Branded `apps/web/src/App.jsx`: **32 directly declared route patterns**,
  plus 24 entries generated from its two Coming Soon arrays. One array entry
  duplicates the implemented `/my-blog` route, so there are **23 unique
  placeholder paths** and 55 unique explicit path patterns, plus wildcard.
  This branch removes that duplicate and adds a regression test.

The 23 unique `apps/web` placeholder paths are:

- Standalone: `/onboarding`, `/globe`, `/oauth/consent`, `/activate`.
- Layout: `/community/:id`, `/u/:id`, `/giving`, `/communications`,
  `/mission`, `/ai-images`, `/institutions`, `/institutions/:id`,
  `/devices`, `/donors`, `/ledger`, `/subscriptions`, `/withdrawals`,
  `/agents`, `/ops`, `/platform`, `/analytics`, `/connect`, and
  `/admin/*`.

The route totals are not a parity score: aliases and wildcard grouping differ,
and page content, authorization, data, links and behavior still require
route-by-route evidence.

The production-branch candidate and `main` have diverged: `main` is 131 commits
 ahead of that branch and 48 commits behind it; their merge base is
`d835fac80e548c3bd679087e60ee7b071aa85074`. PR #190 previously recorded ten
resolvable conflicts when reconciling `main` into that branch, followed by a
failure in `tests/function-security.test.js` involving the phase-7
`ifund_identity.claim_verified_owner` SECURITY DEFINER function. Do not merge
`main` wholesale or assume a `main`-targeted PR will update the live build.
Cloudflare dashboard confirmation is still required before any publication.

## Campaign page comparison

| Capability | Original Base44 campaign page | Current root app | Branded `apps/web` |
|---|---|---|---|
| Campaign details/story | Yes | Basic fields only | Yes |
| Campaign donation dialog | Yes, gated by fundraising mode | No | Deliberately disabled |
| Recent donations / donor list | Yes, via backend function | No | No |
| Campaign updates | Yes | No | No |
| Translation | Yes | No | No |
| Related campaigns | Yes | No | Yes |
| Follow/share | Yes | No | Yes |
| Owner/admin management tools | Yes | Basic edit route only | Partial/guarded; not equivalent |
| Mobile donation affordance | Yes | No | Button scrolls to funding card; checkout remains disabled |

## Safe repairs made on this branch

1. The root campaign-detail page previously rendered `Loading…` forever when the
   Supabase client was absent, a campaign did not exist, a permission/query error
   occurred, or the request rejected. It also displayed raw backend error text.
   The repair adds explicit loading, not-found and retryable-error outcomes,
   cancels stale responses, uses generic public error text, and clearly discloses
   that the root preview cannot accept campaign donations. Five unit tests cover
   successful, missing, not-found and error outcomes.
2. The branded frontend declared `/my-blog` as both a real member publication
   route and a Coming Soon route. The duplicate placeholder entry is removed,
   with a regression test protecting the implemented route.
3. The branded homepage hardcoded `isAuthenticated = false` and `user = null`,
   so signed-in members always saw guest calls to action. It now reads the shared
   Supabase session hook, displays a loading status while the session resolves,
   and shows member or guest actions only for the matching session state. A
   focused static regression test protects this contract.
4. The root app's global auth bootstrap could leave every route on its loading
   screen forever if `auth.getUser()` rejected. A tested helper now resolves
   failed lookups to a fail-closed signed-out UI state, guards against updates
   after unmount, and prevents a late initial lookup from overwriting a newer
   auth-state event. Server-side RLS remains authoritative.

Branch: `fix/campaign-detail-terminal-states-20261102`.

These are narrow UI reliability and route-definition repairs. They do not enable
payments, change permissions, or claim a live-site fix. They have not been merged
or deployed. PR #191 targets `main`, not the last measured production-branch
candidate; the production branch still contains the original indefinite-spinner
implementation.

## CI and deployment evidence

- At PR #191 head `7cd493758c49fe4ac33c6bb862bc5bf0582b6ea3`, the following CI set passed:
  - [Main release candidate checks — 41515124364](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41515124364):
    214/214 root tests, root build, lockfile reproducibility and the targeted
    targeted Prettier check passed. The separate full-source Prettier scan reports
    20 pre-existing files as unformatted; that reporting step is explicitly
    `continue-on-error` and does not block the job.
  - [Frontend production build and tests — 41515124466](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41515124466):
    214/214 root tests, 134/134 `apps/web` tests, and both frontend builds passed.
  - [Reporter blog migration checks — 41515124497](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41515124497):
    214/214 root tests and root build passed.
- PR #190's `Main release candidate checks` run
  [41402106624](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41402106624)
  also passed dependency installation, lockfile verification, root tests, root
  production build and the configured formatting checks. This validates CI
  artifacts, not live runtime behavior.
- The branded frontend deployment workflow failed twice:
  - [41398882334](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41398882334)
  - [41398960349](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41398960349)
- Both stopped at the preflight because the repository variable
  `VITE_SUPABASE_URL` is unset. Build, test and Cloudflare publish steps were
  skipped. No deployment occurred.
- The workflow deploys `apps/web`, not the root app currently documented as
  live. It requires Cloudflare Pages credentials and the public Supabase URL
  and publishable key as repository variables.
- The exact Cloudflare Pages production source branch, root directory and
  current deployment commit still require dashboard/API confirmation. The
  Cloudflare connector required interactive input in this automation run, and
  no usable Cloudflare API session was available here. The checked-in deploy
  workflow builds `apps/web`, defaults to project `interplanetaryfund-migration`,
  and selects branch `main` for its production input; that does not match the
  last measured production-branch candidate `migration/phase7-offline-cutover-gate`.
  The separate `interplanetaryfund-migration-preview` project is documented as
  connected to `main`. Do not use this workflow for live publication until the
  Cloudflare project and production branch are confirmed.

## Blockers requiring external access

1. **Cloudflare Pages access:** authorized dashboard/API session to verify the
   actual project, source repository, production branch, build root, output
   directory, deployment commit and free build allowance.
2. **GitHub Actions variables/secrets:** permission to set the public
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables and
   verify the existing Cloudflare deployment credentials by name. Secret
   values must not be pasted into chat or committed.
3. **Supabase access:** authorized session for the canonical project
   `ssibsfmtodgximseeqsv` to reconcile actual grants, policies, applied
   migrations, active campaign rows, source-data ownership and payment-related
   objects before any activation.
4. **Authenticated site session:** authorized member and admin sessions to
   test protected routes, OAuth, return-to behavior, account lifecycle,
   ownership, donor history, admin gates and mobile navigation. The available
   saved browser profiles list Google, Facebook and GitHub sign-ins, but none
   lists `interplanetaryfund.com`; no IFund member/admin session was available.
5. **Payment provider verification:** authorized PayPal business-account
   access to verify the platform-support hosted link and, separately, the
   campaign checkout/webhook/ledger design. No real payment or financial
   transaction is permitted for testing.

## Readiness decision

**Not production-ready.** The current root frontend has no campaign checkout;
the branded frontend deliberately keeps campaign donations paused. One active
campaign now exists in Supabase, but the last measured production-branch query
still requests private columns and cannot read it. The campaign staging data is
not reconciled to destination ownership, the payment/ledger tables are empty,
and the deployment workflow is blocked before build/publish by a missing public
Supabase URL variable. Authenticated parity, hosted Supabase behavior,
source-data ownership, workflows, agents, integrations, mobile parity and
live post-deployment verification remain unproven.


### Follow-up validation and zero-cost boundary — 2026-11-02

On branch head `1838270b19b1a31eecd4433a324367dba90326f1`, all three public-repository
standard-runner workflows completed successfully:

- [Main release candidate checks — 41516491733](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41516491733)
- [Reporter migration checks — 41516491831](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41516491831)
- [Frontend production build and tests — 41516491757](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41516491757)

The repository is public and these workflows use standard `ubuntu-latest` runners;
GitHub documents standard hosted runners for public repositories as free. No larger
runner, paid CI service or protected credit was used. Cloudflare Pages' published
Free limit is 500 builds per month and one concurrent build, but the account's
remaining allowance could not be inspected. No Cloudflare Pages build or deployment
was started.

The saved-profile inventory was read-only. No login, OAuth flow, PayPal checkout,
payment, database write, DNS change or deployment was performed.
