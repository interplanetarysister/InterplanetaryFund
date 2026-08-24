# Interplanetary Fund TLS / SSL Certificate Management

## Purpose

This document is the canonical TLS/SSL deployment record for the Interplanetary Fund backend and agent-runtime services.

## Certificate ownership

TLS certificates and private keys MUST NOT be committed to GitHub. The production hosting/edge provider is responsible for issuing, installing, rotating, and protecting the private key.

The current canonical backend configuration points the application at Convex production infrastructure (`https://rosy-butterfly-2.convex.cloud`). Convex/Vercel-hosted HTTPS endpoints are expected to use provider-managed TLS rather than repository-stored certificates.

## Production placement

- User-facing application: `interplanetarysister/interplanetary-fund2` is the canonical Base44 application layer. Its hosting provider must terminate HTTPS and provide the certificate for every production domain.
- Authoritative backend/agent runtime: `interplanetarysister/InterplanetaryFund`. The Convex deployment endpoint must remain HTTPS.
- Legacy backend: `interplanetarysister/interplanetary-fund-backend` is reference-only and must not become a second production TLS endpoint without an explicit architecture decision.

## Required production properties

1. Every public production endpoint uses HTTPS/TLS.
2. No production authentication, payment, OAuth, MCP, webhook, or financial callback URL uses plain HTTP.
3. Provider-managed certificates are enabled for every production domain.
4. Certificate renewal is automatic where supported.
5. Private certificate keys are stored only by the hosting/provider secret-management system.
6. GitHub contains policy/configuration and verification tooling, never live private keys.
7. Custom domains must be verified by the hosting provider before being advertised as production endpoints.
8. Any HTTP endpoint that is intentionally exposed for certificate/DNS validation must not carry application data or authenticated traffic.

## Integration rule

The repository does not generate self-signed production certificates. Vercel states that it automatically generates SSL certificates for domains added to a project; certificate issuance depends on successful domain validation. Therefore the correct integration point is the production hosting/domain configuration, not a checked-in `.pem`/`.key` pair.

## Verification checklist

- [ ] Production domain is attached to the correct hosting project.
- [ ] HTTPS certificate is issued and valid for the exact hostname.
- [ ] HTTP requests are redirected/rejected according to the hosting policy.
- [ ] TLS endpoint does not expose certificate/private-key material through the application.
- [ ] OAuth/MCP redirect and callback URLs are HTTPS.
- [ ] Stripe/PayPal webhook endpoints are HTTPS.
- [ ] Payment and withdrawal flows do not accept HTTP callback origins.
- [ ] Certificate expiration/renewal monitoring exists at the hosting layer.
- [ ] Production and preview domains are not accidentally treated as interchangeable trust boundaries.

## Evidence policy

A certificate is not considered "live" merely because this document exists. Agent 3 must verify the actual deployed hostname and certificate chain before marking the production TLS control verified.

## Related architecture

See `AGENTS.md` and the canonical repository architecture documents for repository ownership and source-of-truth boundaries.
