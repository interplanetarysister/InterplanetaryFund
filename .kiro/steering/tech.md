---
inclusion: always
---
# IFund technology and environments

## Chosen replacement stack
- Frontend: React 18, Vite 6, React Router 6, Tailwind CSS 3 (confirm versions against `package.json` on the working branch).
- Primary backend: Supabase Postgres, Auth, Storage, Edge Functions; strict Postgres RLS and server-side privileged operations.
- Delivery: Cloudflare Pages for app frontend, Workers for gateway/API, and Cloudflare DNS only after separately approved cutover.
- Wix remains the existing marketing/domain arrangement until authorized DNS transition, with working MX/SPF/DKIM/DMARC preserved.
- Base44/Convex are being retired as runtime dependencies. Base44 source remains read-only; don't import Base44 SDK or Vite plugin into replacement.
- Existing Supabase project contains `ifund_ops` and applied migrations. Inspect actual migrations first; never recreate, wipe, or mutate established tables just because scaffolding exists.

## AWS scope for PayPal AI Hackathon
AWS is part of the owner's chosen hackathon implementation. Use it only for a concrete, documented task that integrates cleanly with the chosen IFund stack (for example, an AWS-hosted component if actually required). Do not move the main web app, database, or DNS to AWS without explicit owner decision. AWS is NOT identified as a mandatory technology in PayPal's official rules; PayPal developer integration and AI are mandatory.
- Before new AWS infrastructure, document architecture, exact AWS service/region, least-privilege IAM, expected cost, logging, teardown, and how it is demonstrated.
- Use a no-cost read-only or offline route before metered services. No spend, paid tier change, chargeable deployment or credits/minutes consumption without explicit owner approval.
- Keep the separate Ring Guardian AWS project and its spending limit separate from IFund; never silently reuse its budget, credentials, or resources.

## Payments and AI
- PayPal Sandbox first; verify real Orders/Checkout/subscription flow as appropriate, server-side order validation, provider event signatures, replay resistance, idempotency, auditable state changes and reconciliation. Never equate a button render with a working PayPal transaction.
- Financial operations and callbacks are server-authoritative; keep service role tokens off the client. Do not activate production webhooks or live payments without explicit owner authorization.
- AI must be central and demonstrable for the hackathon. Preserve privacy and cost controls for LLM/generation integrations.
- Keep all sensitive configuration in provider secret stores; `.env.example` only contains placeholders. Never place credentials in git, steering files, logs, issues, or PR bodies.
