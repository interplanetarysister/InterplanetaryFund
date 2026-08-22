# Feature #10 — Platform Event Bridge Deployment Contract

## Purpose

The Base44 application records authenticated platform events through a server-to-server Convex HTTP action. The public Convex mutation remains authentication-protected; the bridge uses a deployment secret and invokes an internal mutation only after that secret is verified.

## Required production configuration

Set the same high-entropy secret value in both environments:

- Convex: `PLATFORM_BRIDGE_SECRET`
- Base44 function environment: `CONVEX_PLATFORM_BRIDGE_SECRET`

Do not commit the secret, place it in client-side code, or expose it in logs.

## Endpoint

Base44 calls the Convex HTTP action:

`POST https://rosy-butterfly-2.convex.site/platformEvent`

The request must include:

`x-platform-bridge-secret: <configured secret>`

and the authenticated Base44 function must verify the actor before forwarding the event.

## Security boundary

- Direct calls to the public `platformFoundation:recordPlatformEvent` mutation require Convex authentication.
- Server-to-server bridge calls do not bypass the public mutation's authentication boundary; they use the dedicated HTTP route and internal mutation after shared-secret verification.
- The bridge secret authenticates the trusted application service, while the Base44 function binds the event actor to the authenticated Base44 user before forwarding.
- Unknown or missing bridge secrets fail closed with HTTP 401/503.

## Verification before publication

1. Confirm both production secrets are configured and identical.
2. Confirm an authenticated Base44 user can record one valid event.
3. Confirm an unauthenticated Base44 request is rejected.
4. Confirm a request with an incorrect bridge secret is rejected.
5. Confirm an invalid event name/version/payload is rejected by the authoritative Convex mutation.
6. Submit the same idempotency key twice and confirm only one authoritative audit event is written.
7. Confirm CI/build/code generation pass for both repositories.
