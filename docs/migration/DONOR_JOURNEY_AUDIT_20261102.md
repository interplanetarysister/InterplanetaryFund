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

The last public observation also saw the campaign list fail with
`permission denied for table ifund_campaigns`. The source currently selects
explicit public columns, but that source change is not proof the live database
grant or deployed bundle has been corrected.

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

## Source parity counts

Counts are derived from the current `main` route source, not from live browser
rendering:

- Read-only Base44 source `interplanetary-fund2/src/App.jsx`: **58 explicit
  routes**, plus wildcard.
- Current production-root candidate `src/App.jsx`: **18 explicit routes**,
  plus wildcard.
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

Branch: `fix/campaign-detail-terminal-states-20261102`.

These are narrow UI reliability and route-definition repairs. They do not enable
payments, change permissions, or claim a live-site fix. They have not been merged
or deployed.

## CI and deployment evidence

- PR #190's `Main release candidate checks` run
  [41402106624](https://github.com/interplanetarysister/InterplanetaryFund/actions/runs/41402106624)
  passed dependency installation, lockfile verification, root tests, root
  production build and the configured formatting checks. This validates that
  PR's head, not the live runtime.
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
  no usable Cloudflare credential was available here. Do not infer those
  settings from a matching bundle alone.

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
   ownership, donor history, admin gates and mobile navigation.
5. **Payment provider verification:** authorized PayPal business-account
   access to verify the platform-support hosted link and, separately, the
   campaign checkout/webhook/ledger design. No real payment or financial
   transaction is permitted for testing.

## Readiness decision

**Not production-ready.** The current root frontend has no campaign checkout,
the branded frontend deliberately keeps campaign donations paused, there are
no active campaigns in the last inspected database snapshot, and the
deployment workflow is blocked before build/publish by a missing public
Supabase URL variable. Authenticated parity, hosted Supabase behavior,
source-data ownership, workflows, agents, integrations, mobile parity and
live post-deployment verification remain unproven.
