# Feature #10 — Platform Event Bridge Deployment Contract

## Purpose

The Base44 application records authenticated platform events through a server-to-server Convex HTTP action. The public Convex mutation remains authentication-protected; the bridge uses a deployment secret and invokes an internal mutation only after that secret is verified.

## Required production configuration

Set the same high-entropy secret value in both environments:

- Convex: `PLATFORM_BRIDGE_SECRET`
- Base44 function environment: `CONVEX_PLATFORM_BRIDGE_SECRET`

The Base44 function also requires an environment-specific `CONVEX_PLATFORM_EVENT_URL` pointing to that environment's `/platformEvent` route. Do not hardcode a production endpoint into application source or reuse a production URL in preview/development.

Do not commit any secret, place it in client-side code, or expose it in logs.

## Endpoint

Base44 calls:

`POST ${CONVEX_PLATFORM_EVENT_URL}`

The configured URL must use HTTPS and terminate at the intended Convex deployment's `/platformEvent` HTTP action.

The request must include:

`x-platform-bridge-secret: <configured secret>`

and the authenticated Base44 function must verify the actor before forwarding the event.

## Security boundary

- Direct calls to the public `platformFoundation:recordPlatformEvent` mutation require Convex authentication.
- Server-to-server bridge calls do not bypass the public mutation's authentication boundary; they use the dedicated HTTP route and internal mutation after shared-secret verification.
- The bridge secret authenticates the trusted application service, while the Base44 function binds the event actor to the authenticated Base44 user before forwarding.
- Unknown or missing bridge secrets fail closed with HTTP 401/503.
- Preview/development environments must use their own bridge URL and secret; production credentials must never be reused there.

## Reproducible runtime verification

From the backend repository, set these environment variables only for the intended verification environment:

- `PLATFORM_VERIFY_URL` (or `CONVEX_PLATFORM_EVENT_URL`) — the environment-specific `/platformEvent` URL
- `PLATFORM_BRIDGE_SECRET` — matching Convex bridge secret
- `PLATFORM_VERIFY_ACTOR_ID` — the actor identity accepted by the verification environment

Then run:

`npm run verify:platform-runtime`

The verifier sends two concurrent requests with the same idempotency key and fails unless exactly one request records the event and the other is reported as a duplicate. It creates a clearly labeled verification event and does not embed or print the secret.

## Verification before publication

1. Confirm both production secrets are configured and identical.
2. Confirm `CONVEX_PLATFORM_EVENT_URL` points to the intended environment's `/platformEvent` route and uses HTTPS.
3. Confirm an authenticated Base44 user can record one valid event.
4. Confirm an unauthenticated Base44 request is rejected.
5. Confirm a request with an incorrect bridge secret is rejected.
6. Confirm an invalid event name/version/payload is rejected by the authoritative Convex mutation.
7. Run `npm run verify:platform-runtime` against the intended environment and confirm concurrent duplicate requests collapse to one authoritative record.
8. Confirm CI/build/code generation pass for both repositories.
