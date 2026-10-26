# IFund Buffer integration — credential handoff and staged activation (2026-10-13)

## Credential placement
The owner has created a Buffer personal API key, an IFund Buffer OAuth client ID and client secret. **No credentials are committed, pasted into frontend assets, or stored in entities.** The owner must save the values in IFund's Base44 protected Secrets panel under exactly these names:

- `BUFFER_API_KEY` — Buffer personal API key for authorized IFund-owned Buffer publishing accounts.
- `BUFFER_CLIENT_ID` — confidential Buffer OAuth app client identifier.
- `BUFFER_CLIENT_SECRET` — confidential Buffer OAuth app secret. Never send to the browser.
- OAuth redirect URI — still to be selected from the actual deployed callback endpoint, registered exactly in Buffer and verified before enabling personal-account connects. Do not guess a redirect URI.

## Access scopes (least privilege)
- In Buffer's app client UI: `accountRead`, `postsRead`, `postsWrite`.
- Runtime authorization equivalents: `account:read posts:read posts:write offline_access` (subject to the provider's current accepted scope names and registered app permissions).
- Keep `accountWrite`, `ideasWrite`, and unrelated permissions off until user-approved features actually need them.
- OAuth Authorization Code **with PKCE**, random state, exact registered HTTPS callback, and backend-only token exchange are mandatory.
- Buffer refresh tokens rotate and are single-use; if building custom OAuth, token replacement must be atomic, owner-scoped, encrypted, and resilient to concurrent refresh. Prefer the existing Base44 app-user connector if it can support Buffer's exact OAuth and refresh contract; do not build a separate token-vault provider without verifying that boundary.
- The personal key can reach all organizations/channels in its Buffer account; scope its allowed channel IDs in the IFund application, and never grant it to individual IFund users.

## Backend probe created
`base44/functions/getBufferReadiness/entry.ts` is a **POST, admin-only**, read-only readiness function. It checks secret **presence**, then uses a minimal GraphQL `account { organizations { id } }` request to prove the personal API key reaches Buffer. It returns only boolean readiness and organization count; not keys, tokens, email, organization IDs, or account details. It does not post, update authorization, or create a platform connection.

The probe can only verify live access after the owner saves the secrets and invokes it in a deployed, authenticated Base44 environment. Presence of an OAuth client ID/secret does not verify OAuth authorization, callbacks, refresh, users' connected accounts or publishing capability.

## Later rollout gates
1. Owner saves three secrets in Base44.
2. Admin executes `getBufferReadiness` using authenticated Base44 function invocation and confirms `personal_account_verified: true`.
3. Register and verify provider-approved HTTPS callback URI for the IFund application, and ensure the proper owner-specific OAuth connector is available; preserve IFund's existing per-user connection/AI authorization flow.
4. Confirm external provider granted scopes; test access, refresh rotation, denial, disconnect, revoke and reconnect. Only then mark a Buffer `PlatformConnection` verified.
5. Allow specific authorized posting destinations with a test draft, then explicitly approved publication; use `DistributedPost` without duplicate state.
6. Buffer is a publishing/queue provider, **not** a verified direct-message or comment inbox source; IFund's unified inbox requires separate approved social provider APIs.
7. Do not create paid infrastructure, subscriptions, or recurring external-fund synchronization.

References: https://developers.buffer.com/guides/authentication.html and https://developers.buffer.com/guides/getting-started.html
