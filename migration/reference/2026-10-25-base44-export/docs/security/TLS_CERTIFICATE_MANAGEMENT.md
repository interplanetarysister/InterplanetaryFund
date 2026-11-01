# Interplanetary Fund User-Facing TLS / SSL Certificate Management

## Purpose

This document records the TLS/SSL requirements for the canonical user-facing application layer.

## Certificate storage

Do NOT commit production `.pem`, `.crt`, `.cer`, `.key`, or private certificate-chain files to GitHub. Certificates/private keys belong in the hosting/domain provider, not the application repository.

## Production placement

`interplanetarysister/interplanetary-fund2` is the canonical user-facing application layer. Its actual production hostname must be attached to the production hosting provider and must receive a provider-managed TLS certificate.

The repository currently contains Base44 build configuration, but the checked-in configuration does not itself identify a production custom hostname. Therefore Agent 3 must not invent a domain or claim that a certificate is live until the hosting project/domain is verified.

## Required properties

- HTTPS for every production application URL.
- Provider-managed certificate for every production hostname.
- Automatic renewal where supported.
- No private key in source control.
- HTTPS-only OAuth/MCP callback and redirect URLs.
- HTTPS-only Stripe/PayPal webhook and payment endpoints.
- No financial or authenticated traffic over HTTP.
- Exact production hostname documented once confirmed.

## Integration

If this application is deployed behind Vercel, certificate issuance should be handled by Vercel's domain/TLS infrastructure rather than by generating a certificate inside the repository. If the production application remains on another host, that host becomes the certificate termination point and must provide equivalent managed TLS.

## Verification checklist

- [ ] Identify the actual production hostname.
- [ ] Confirm the hostname is attached to the intended production deployment.
- [ ] Confirm HTTPS certificate validity and hostname coverage.
- [ ] Confirm renewal is managed by the hosting provider.
- [ ] Confirm HTTP behavior is intentional and does not expose application traffic.
- [ ] Confirm OAuth/MCP/payment callbacks use HTTPS.
- [ ] Confirm no certificate private material exists in repository history.

## Evidence rule

This file documents the required solution; it is not evidence that a certificate is currently live. Agent 3 must verify the deployed hostname and certificate before certifying production TLS.
