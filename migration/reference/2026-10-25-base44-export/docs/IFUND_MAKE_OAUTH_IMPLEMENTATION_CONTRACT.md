# IFund administrator OAuth 2.0 connection — implementation contract

## Current status
The `/admin/agent-api` page supports generating revocable hashed Bearer API keys through `manageExternalAgentKeys`; its OAuth tab is informational only. **OAuth authorization-code credentials do not exist yet.** Never provide guessed authorization/token URIs or claim client registration is complete.

## Make callback
`https://www.integromat.com/oauth/cb/oauth2`

## Production acceptance requirements
1. Implement a real HTTPS OAuth 2.0 authorization server with authorization-code + PKCE S256, state round-trip, strict registered redirect matching and short-lived one-use codes. Ensure the hosted login and consent flow checks a fresh authenticated IFund identity, active account, authorized campaign scope, and displays application identity.
2. Create admin-only client registration UI/server service: label, exact registered callback(s), allowed scopes, client ID, cryptographically random secret displayed once, server-side secret hashing, rotation, disabling/revocation, and audit events. **Do not reuse external agent Bearer keys as client secrets.**
3. Implement token endpoint with confidential client authentication, PKCE validation, safe error handling, short-lived scoped access tokens, refresh-token rotation with reuse detection, token revocation, and expiry. Keep token records non-readable to ordinary users. Apply rate limits and strict no-store responses.
4. Resource endpoints must validate OAuth tokens and enforce creator consent and field-level scopes themselves. Existing Bearer key authentication must continue functioning unchanged. Do not let read scope grant financial records, messages or publishing access.
5. Publish RFC-compliant metadata and exact live OAuth authorization/token URLs once routes exist; do not display candidate paths as functional endpoints.
6. Wire gateway paths to deployed backend routes, configure protected environment secrets and verify exact routing on both Worker and public domain.
7. Automated negative tests: mismatched callback, unknown client, invalid state/PKCE, replayed code, expired/revoked tokens, insufficient scope, disabled client, missing campaign creator consent, unauthenticated administrator, untrusted redirect, broken downstream service.
8. End-to-end Make integration: exchange code on the registered callback, refresh token successfully, request authorized resources, revoke and confirm denial. Record verified deployment URL and test date.

## Existing alternative
Use Make HTTP module with `Authorization: Bearer <ifund_ag_...>` and `GET /api/v1/agent/campaigns`. Content write requires `campaigns:read,content:write` plus campaign owner authorization.

## Rollout safety
Feature flag OAuth unavailable until production steps and tests pass. API keys must not be interrupted during rollout. Never store OAuth secrets in frontend bundles or GitHub.
