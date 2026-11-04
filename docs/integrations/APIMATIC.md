# APIMatic integration plan — Interplanetary Fund

## Purpose
Use APIMatic as an optional **development-time** tool to generate and validate typed API clients and publish developer documentation from OpenAPI contracts. It is not a runtime gateway, OAuth provider, payment processor, or social publishing service.

## Integration boundaries
- Keep the existing Cloudflare Workers and Supabase architecture. Do not introduce new hosting or backend services.
- Begin with an OpenAPI 3.x description of existing, verified, non-secret API routes. Do not invent endpoints.
- Generate a TypeScript client through APIMatic only after validating its free-plan eligibility and license. Pin generator version and review generated diffs.
- Preserve existing PayPal SDK/payment verification, webhook signature validation, idempotency and the 7% withdrawal fee. Never let a generated client bypass server-side checks.
- User social account linking requires each provider's OAuth consent, permissions and approved APIs; generated SDKs do not provide authorization.
- Keep generated clients server-side where they use secrets. Do not commit tokens, credentials, or generated clients containing secrets.
- No required APIMatic runtime dependency; the app must build and operate without an APIMatic subscription.

## Implementation checklist
1. Inventory existing Worker routes and existing API contracts in this repository.
2. Add or update an OpenAPI contract reflecting *implemented* routes, including authentication, schemas, errors and rate limits.
3. Validate the contract locally and test against existing handlers.
4. Trial APIMatic TypeScript SDK generation using the contract, without submitting production secrets.
5. Add a repeatable generation script and contract checks in CI only if the tool's free tier permits unattended generation; otherwise commit a documented manual workflow.
6. Exercise sandbox-only PayPal flows and approved social API test connections with negative cases.
7. Deploy changes to Cloudflare preview first; require explicit approval before production changes.

## Devpost evidence
Only claim APIMatic as a used sponsor tool after an actual documented APIMatic SDK-generation or documentation-generation run, with its generated artifact and verification results. This document alone is not evidence of usage.
