# Interplanetary Fund — prospective donor journey audit

**Audit date:** 2026-11-01  
**Repository baseline:** `interplanetarysister/InterplanetaryFund` main at `105a3d922960de0c5992cfa9be5dbc21174c0c9a`  
**Scope:** Anonymous public pages and non-submitting donor-path inspection. No authentication, payment, or financial action was performed.

## Executive result

A prospective donor cannot currently make a campaign donation through `https://interplanetaryfund.com`. The custom domain serves a reduced preview build, shows a Supabase permission error, has no active campaigns, and exposes no platform-support PayPal button or campaign checkout. A second Pages hostname serves a much fuller app, but that version explicitly pauses campaign donations, has no active campaigns, and has an unavailable `/donate` route. Its PayPal platform-support link could not be independently verified.

This is not a production-readiness result. The original Base44 experience remains the comparison baseline.

## 1. Custom-domain donor journey

### Homepage — `https://interplanetaryfund.com/`

Observed:
- Minimal hero: “ONE UNIVERSE OF FUNDING”, “What if?”, and “The Universal Fundraising Operating System”.
- Calls to action are “Start a campaign” and “Explore campaigns”; no donor-facing Donate or PayPal-support action is present.
- Community feed says there are no posts.
- Campaign section says there are no published campaigns.
- The page visibly prints `permission denied for table ifund_campaigns`.
- No images were extracted from the page.

### Discovery and campaign paths

- `/discover`: displays the same permission-denied error and “No active campaigns yet.”
- `/campaign/demo`: remained on “Loading…” for the synthetic, non-existent ID rather than showing a clear not-found result.
- `/donate` and `/giving`: “Page not found.”
- Database read-only count confirms one campaign row, status `draft`; there are zero active campaign rows. No real campaign was available to follow into checkout.

### Other public destinations checked

- `/login`: offers Google, Facebook, and one-time email-code sign-in. No sign-in was attempted.
- `/create` and `/mine`: require sign-in.
- `/community`: says sign-in is required to post.
- `/connections`: says providers remain disconnected until an authenticated provider handshake and live sync verification; social publishing and automatic financial synchronization are not enabled.
- `/blogs`: Reporter page loads and displays articles.
- `/about`, `/contact`, `/help`, `/terms`, and `/privacy`: all returned the app’s “Page not found” response on the custom domain.
- `https://www.interplanetaryfund.com/` and `https://preview.interplanetaryfund.com/`: both returned HTTP 404 during this check.

## 2. Two public Pages hostnames serve materially different apps

- `https://interplanetaryfund-migration.pages.dev/` returns the same reduced preview content and `ifund_campaigns` permission error as the custom domain.
- `https://interplanetaryfund-migration-preview.pages.dev/` returns a much fuller Interplanetary Fund experience. Its homepage explicitly states **“CAMPAIGN DONATIONS ARE CURRENTLY PAUSED”** and explains that individual campaigns cannot accept donations; the separate PayPal link supports the platform only.
- The fuller hostname’s `/discover` says there are no active campaigns.
- Its synthetic `/campaign/demo` route correctly says “Campaign not found.”
- Its `/donate` route is unavailable.
- Its `/founding-members` page says early-access registration is being transferred and is not accepting registrations.
- The fuller hostname declares `https://interplanetaryfund.com/` as its canonical URL even though the custom domain currently serves the different reduced app. This is a public-host/canonical mismatch.

The difference is visible without changing DNS or domain routing. No routing changes were made.

## 3. PayPal platform-support path

The fuller homepage exposes the owner-provided PayPal Payment Link:

`https://www.paypal.com/ncp/payment/VMW5XU3Y46K5J`

The link is explicitly labeled as support for Interplanetary Fund itself, not a campaign contribution. A zero-cost page fetch returned `empty_content`; the PayPal checkout page and merchant-side active status could not be verified. No checkout was submitted and no payment was made.

The read-only source documentation also records that merchant-side active status, amount setup, and successful live settlement have not been verified through the PayPal business dashboard or a completed payment. The link must not be treated as a verified live donation path yet.

## 4. Supabase evidence

The organization is on the Supabase Free plan. The production project inspected was `ssibsfmtodgximseeqsv`.

Read-only checks returned:
- `ifund_campaigns` contains one row with status `draft`; no active campaigns.
- Anonymous role has column-level SELECT grants for the nine public campaign fields, but `has_table_privilege('anon', 'public.ifund_campaigns', 'SELECT')` is false.
- The live custom-domain homepage still displays `permission denied for table ifund_campaigns`.

Current main source `src/pages/Feed.jsx` already uses an explicit public-column projection rather than `select("*")`. The live error therefore needs deployed-build and API/log correlation before changing database grants. No RLS, grant, schema, or data change was made.

## 5. Comparison against the pre-migration Base44 source

The original Base44 `src/pages/Home.jsx` includes:
- A specific space/planet hero image.
- BrandLogo, QuickActions, and MobileBottomNav.
- The expandable full “Who is Interplanetary Fund?” story.
- A distinct platform-support PayPal button.
- A fail-closed campaign-fundraising notice controlled by the backend `public_campaign_fundraising` flag.

The original campaign page includes campaign media, progress/funding information, updates, sharing, translations, follow controls, campaign-management tools, and a donation dialog. Its checkout path calls Base44 functions including `getPaymentCapabilities`, `createPayPalOrder`, and `capturePayPalOrder`. Those backend contracts must be independently replaced and verified before campaign donations can be enabled.

The fuller independent app in `apps/web` preserves substantially more of the original homepage content and layout than the reduced root app. Its current `Home.jsx` nevertheless hardcodes `isAuthenticated = false` and `user = null`, so signed-in home behavior is not wired through on that page. It also has numerous routes explicitly mapped to “Coming soon”, including giving, communications, mission, AI images, institutions, inbox, notifications, donors, ledger, subscriptions, withdrawals, agents, operations, analytics, and admin routes.

### Confirmed missing visual asset

`apps/web/src/pages/Home.jsx` references `/images/home-hero.png`. A public fetch of that exact path returned the app’s 404 page. `apps/web/README.md` already records that the original Base44 hero image could not be downloaded during the port and must be added to restore the artwork. No substitute image was invented.

## 6. CI and validation

The latest main commit at the audit snapshot is `105a3d922960de0c5992cfa9be5dbc21174c0c9a`.

GitHub Actions run `41340199767` completed successfully on `ubuntu-latest`. Its recorded steps passed:
- `npm ci --no-audit --no-fund`
- `npm test`
- `npm run build`
- `npm --prefix apps/web install --no-audit --no-fund`
- `npm --prefix apps/web test`
- `npm --prefix apps/web run build`

These are source-level tests and build checks. They do not prove route runtime behavior, authentication, live API access, PayPal settlement, deployment identity, or production parity.

## 7. Blockers requiring external access or live verification

1. **Production Pages project/build identity:** the public custom domain and the two Pages hostnames serve different builds. The Cloudflare API connector required interactive user input in this automation run, so the exact project build settings, deployment commit, deployment state, and remaining Free build allowance could not be verified.
2. **Donor payment verification:** the PayPal Payment Link could not be rendered by the free fetch path. An authorized PayPal business-account session is needed to verify the merchant link’s status and configuration. No real payment is authorized.
3. **Campaign checkout migration:** the original campaign checkout depends on Base44 functions. The independent replacement must implement and test order creation, capture, canonical donation/ledger recording, idempotency, reversal handling, and feature-flag enforcement before campaign donations can be enabled.
4. **Public campaign data:** there are no active campaign rows to test a real donor-to-campaign journey. Do not promote the lone draft or alter source data as a test.
5. **Authenticated parity audit:** no browser profile is recorded as signed in to `interplanetaryfund.com`. Available profiles only record Google/Facebook and/or GitHub sign-in, not an IFund site session. Protected pages, owner journeys, and admin pages were therefore not explored.
6. **Visual parity:** the independent app’s hero artwork is missing, and many original routes remain Coming Soon or unported.
7. **Public support routes:** the custom domain currently returns 404 for About, Contact, Help, Terms, and Privacy, despite those routes existing in current main source.

## 8. Zero-cost and safety record

- Used public page fetches, public GitHub reads, and read-only Supabase queries.
- Confirmed the GitHub repository is public; standard `ubuntu-latest` GitHub-hosted runners are free for public repositories. The cited CI run had already completed; no additional CI job was triggered.
- Cloudflare’s published Free Pages limit is 500 builds/month, but the account’s remaining build allowance could not be checked. No Pages build or deployment was triggered.
- TinyFish browser automation is metered; it was not used.
- No real payment, PayPal capture, subscription, withdrawal, or other financial transaction was performed.
- No DNS, domain routing, payment configuration, production database data, schema, RLS, or unrelated production setting was changed.

## Recommended next safe sequence

1. Obtain a read-only Cloudflare project/deployment inspection and verify remaining Free Pages capacity.
2. Reconcile the existing production Pages project’s build output with the intended fuller `apps/web` app without changing domain routing.
3. Restore the exact original hero asset from an authorized, accessible source.
4. Diagnose the live `ifund_campaigns` permission error using request logs and the deployed commit; do not broaden grants as a shortcut.
5. Verify the platform-support PayPal link in an authorized business-account session without making a payment.
6. Keep campaign donations disabled until the independent checkout and ledger path is fully implemented and tested.
7. Resume the complete 58-route authenticated comparison when an IFund-authorized browser session is available.
