# IFund provider authorization: routing repair and Nango evaluation

Status: **UI redirect guard applied. Production OAuth across every provider is not yet verified. No added operating cost permitted.**
Owner-facing behavior: Connecting an external account must open that provider's real authorization/permissions flow, then return to IFund to verify the user's actual grant. A public provider website is not an authorization route.

## Current architecture and findings

- `src/pages/Connections.jsx` deep-links to `/connections?connect=<catalog-id>` and opens the IFund dialog before any external navigation.
- `src/components/connections/ConnectDialog.jsx` invokes `getAppUserConnector`, then `base44.connectors.connectAppUser(connector_id)`. The backend tracks connector IDs with `OAUTH_ENV` in `base44/shared/connectionVerification.ts`.
- `finalizeAppUserOAuthConnection` pairs a grant to the authenticated IFund user only after an actual app-user connector token appears. `verifyPlatformConnection` must perform a provider read before declaring the connection working.
- Base44's app-level shared connectors are distinct from members' personal OAuth grants. Never substitute the IFund business/admin connection for an end-user connection.
- Crowdfunding sites marked `setupKind: "link"` support a public campaign URL, not end-user account authorization or publishing. Do not call this a connected publishing account or redirect to a homepage as if it were OAuth.
- Frontend now rejects a bare provider homepage returned as the OAuth authorization URL. Failure is shown in IFund without creating a false connection.
- Opening Connections no longer automatically runs repeated live OAuth health probes against up to six provider accounts. Members instead use **Check connection** (or **Check page** for public URL trackers); immediately after a new OAuth authorization, IFund still verifies that provider. The saved lifecycle and its last-verified timestamp remain visible.
- Manual checks re-resolve the displayed lifecycle without changing hosting, adding browser automation, or initiating external fund synchronization.
- Existing account records, user permissions, hosting, and provider tokens are unchanged.

## No-added-cost decision (2026-10-11)

**Keep existing Base44 per-app-user OAuth. Do not add Nango or any other extra hosted integration service to production.** The current official Nango Free plan is $0 but hard capped at **10 active connections**, **10 hours execution per month**, and **10 GB transfer per month** (https://nango.dev/pricing, verified 2026-10-11). Even without charges at the cap, this would stop working as IFund grows and is unsuitable as the default multi-user auth layer. Pay-as-you-go starts at $50/month. Free self-hosting would require hosting Postgres/processes and operational maintenance, so cannot be called zero-cost on this architecture.

A future optional Nango pilot requires a new explicit assessment of its limits and spend and must remain disabled unless it can be proven to add **zero** incremental hosting, traffic, metered API, provider, seat, or operational fees. **No account, subscription, integration credentials, infrastructure, or paid plan should be created as a side effect of this repair.** Existing Base44 features can still consume the app's current plan usage/credits; $0 incremental spend does not mean unlimited provider calls.

For current work, prioritize registering provider-owned OAuth applications in Base44 Workspace Settings and validating each existing app-user connector ID, redirect URL, and scopes. Connecting users requires genuine provider consent and permissions, not IFund's already-connected shared/business account. Do not alter the current hosting or account credentials.

**Future optional adapter pilot only (not authorized for production):**

1. Select one provider with supported, approved OAuth authorization and a read-only verification API. Compare its requirements with the existing Base44 app-user connector and choose Nango only if it fixes a real gap.
2. Create the provider's OAuth developer app under the IFund business account. Set the exact callback supplied by Nango. Use provider-approved permissions for the specific requested capability; do not ask for nonexistent or excessive scopes.
3. Configure a Nango integration and Nango server secret **only in Base44 runtime secrets**. Never put the secret or access tokens in `src`, the public repo, localStorage, URLs, or browser console.
4. An authenticated Base44 backend creates a short-lived Nango Connect Session with `allowed_integrations` restricted to the one selected provider and a tag linking the authorized IFund user.
5. Open Nango Connect UI or the provider's resulting consent route from the IFund Connect button. Authenticate with the provider and ask for its permissions. A provider homepage is never a fallback.
6. Accept success **only after server-side confirmation from Nango's authenticated webhook/API**. Match the user and approved integration to the initiating session, then store only the Nango connection ID + provider ID in an owner-scoped record. Browser callback alone is not proof of authorization. Provider tokens remain server-side.
7. Verify the provider's actual read/write grants independently, without making test posts or fund transfers. Confirm that disabled/revoked grants show Reconnect/Needs attention and no agent action occurs without IFund's separate OBO consent.
8. Test on Android/mobile, desktop, expired sessions, rejection, MFA, callback mismatch, provider outage, multiple users, and repeat authorizations. Roll out provider-by-provider. No hosting, login-system or subscription changes.

## Validation

- `npm run verify:platform-oauth` checks code contracts, homepage rejection tests, on-demand member verification and no added Nango dependency.
- Passing code tests is **not** evidence that a live provider has completed consent. A successful provider OAuth user journey and server-side capability check are the required production gate.
- Keep the Base44 main app checkpoint before any further provider migration.
