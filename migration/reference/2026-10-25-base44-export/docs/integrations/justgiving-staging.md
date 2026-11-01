# IFund → JustGiving: staging integration and release gate

Last verified: 2026-10-11. Scope: Interplanetary Fund's existing Base44 application. This file contains no credentials.

## Official provider references

- Developer portal: https://developer.justgiving.com/login
- Unclaimed-page API: https://api.justgiving.com/docs/resources/v1/UnclaimedPages/RegisterFundraisingPage
- Developer help: https://justgiving-developer.zendesk.com/hc/en-us
- OAuth documentation: https://developer.justgiving.com/apidocs/oauth
- Developer contact: developer@justgiving.com (confirmed on JustGiving's own developer help pages)
- 2026 claim-flow update: https://justgiving-developer.zendesk.com/hc/en-us/articles/46810103583121-Updated-UI-against-Unclaimed-Pages-Scheduled-Release-20th-May

## Authentication and prerequisites

1. Reuse the existing registered JustGiving developer account. Verify the developer confirmation email through the original JustGiving message, log in at the official developer portal, and open **Applications** for the case-sensitive AppID. Do **not** create duplicate accounts as a workaround.
2. Configure a server-side Base44 environment secret called `JUSTGIVING_APP_ID`. Never commit it, place it in a public entity, or include it in the mobile app bundle. Do not store portal passwords in docs or campaign data.
3. The separate server-only switch `JUSTGIVING_STAGING_WRITE_ENABLED=true` is required before staging test page creation can be attempted. Keep it off if not actively performing an authorized pilot.
4. Select a **JustGiving charity ID** that exists and is eligible **in staging**. Staging accounts/charities may differ from production; use no real donor data. Independently enter and confirm a staging goal and its currency: IFund does not currently have a universal campaign currency field, and copying its numeric goal into GBP without conversion is unsafe.
5. Authorize the specific IFund staging campaign and JustGiving test charity in the admin-only campaign distribution panel. No new page is created by the Preview action.
6. The creator must complete JustGiving's unclaimed-page claim flow using the returned one-time link. IFund does not persist the claim token.
7. Verify the new page and its owner with JustGiving before changing the status of any external fundraising publishing capability to verified.

## Staging API request

- Endpoint: `PUT https://api.staging.justgiving.com/v1/fundraising/unclaimedpages`
- Authentication: `x-api-key` header holding the AppID. Do not also put the AppID in the URL.
- Content-Type/Accept: `application/json`
- Body: `charityId`, `pageShortName`, `pageTitle`, `pageStory`, `targetAmount` (explicitly confirmed for the selected currency), `currency`, `activityType`, `charityOptIn`, `charityFunded`, `consistentErrorResponses` and `reference`. The non-event activity type is required when no event ID is included.
- Reserve a `request_pending` record before the external PUT. If history lookup or reservation fails, DO NOT send the request. If a request returns an ambiguous result or times out, retain `needs_attention` and reconcile the provider page before any retry.
- A provider-confirmed `201` with `pageId`, `next.uri` and `signOnUrl` is the only case recorded as `staging_created`. For staging, require the public page and claim URL to be on the staging JustGiving host, and never persist or expose a claim token as a public page URL. JustGiving's documentation samples use generic production-looking URLs; treat an unexpected actual staging response as `needs_attention` pending provider confirmation.
- `409` is not success: it may represent a short-name clash or ineligible charity/event. Do not retry using another name without checking the previous provider outcome.
- Never treat the unclaimed page as a completed owner-claimed, production-ready fundraiser. JustGiving's May 2026 updated claim flow is documented at https://justgiving-developer.zendesk.com/hc/en-us/articles/46810103583121-Updated-UI-against-Unclaimed-Pages-Scheduled-Release-20th-May .
- Staging does not imply permission to create GoFundMe, Kickstarter, or other unrelated providers' campaigns.
- Provider donation funds are not IFund funds and cannot be withdrawn through IFund.

## Supported capability boundaries

- JustGiving staging unclaimed-page write: adapter and admin controls implemented, pending AppID/configuration and a provider-confirmed test.
- JustGiving production page creation: not implemented or verified.
- JustGiving authenticated **user-owned** page creation/update: OAuth client secret and owner-granted `fundraise` scope needed. Ask the official developer contact for setup details; do not repurpose shared admin credentials as user consent.
- Ordinary fundraising pages on other platforms: link/import or manual handoff only until a provider-authorized writer is independently verified.

## Release and regression tests

Run from the Base44 project root under **Node 22**:

```bash
node scripts/verify-justgiving-staging-pilot.mjs
node scripts/test-justgiving-staging-handler.mjs
node scripts/verify-external-distribution-routing.mjs
npm run build
npm run typecheck
npm run lint
IFUND_VALIDATE_ONLY=1 bash scripts/publish-ifund-safe.sh
```

The publishing CLI is a separate authorization step. A passing local release gate does **not** establish that https://interplanetaryfund.com has been updated. Publishing requires a valid Base44 CLI session or authorized builder publish operation and a successful production smoke test.

## Contact tracking

A developer request was sent by the user from the IFund business Gmail account on October 11, 2026 to `developer@justgiving.com`. Do not send duplicate outreach unless a follow-up is warranted.
