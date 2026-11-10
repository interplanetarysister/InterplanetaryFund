# PayPal AI Hackathon — truthful English submission draft

> **DRAFT — NOT SUBMITTED.** Do not copy claims of working hosted checkout or AI generation into Devpost until verified against the actual preview and provider records. Official rules: https://paypalaihackathon.devpost.com/rules. Deadline: November 12, 2026, noon Pacific.

## Project
Interplanetary Fund — AI-assisted campaign storytelling and PayPal sandbox checkout

## What it does
Interplanetary Fund is a mobile-first campaign discovery and creation platform. Its intended workflow helps organizers draft a campaign, select AI-assisted text, and share their story. The independent migration application uses Cloudflare Pages/Workers and Supabase, while the original Base44 app serves as the visual and functional reference, not the independent runtime.

## How AI is used
The independent app includes a Supabase-backed Story writing assistant and an agent identity selector. The intended campaign wizard presents five title options, two short descriptions, and one long story at a time, with section regeneration and optional themed artwork. **Do not claim all of these are hosted and working until each is demonstrated on the deployed preview with real generated output.** The selector alone does not prove seven independent conversational agents.

## How PayPal is used
The migration repository contains a PayPal REST Orders v2 sandbox checkout path, server-side capture handling, PayPal webhook signature-verification logic, and isolated Supabase sandbox receipt/event tables. Sandbox receipts are separate from real donations and must never affect campaign totals. **A real sandbox order approval, capture, signed webhook, and idempotent database receipt have not yet been verified end-to-end. This integration must not be described as working or complete until that evidence exists.** A separate hosted platform-support PayPal button does not demonstrate sandbox REST compliance.

## Technology
Cloudflare Pages and Workers; Supabase Auth/Postgres; PayPal REST Orders v2 sandbox; GitHub source licensed AGPL-3.0. No Base44 backend dependency is permitted in the independent app. No AWS integration is claimed.

## Significant work since October 1, 2026
The project has been migrating from the original Base44 application to an independently deployable Cloudflare/Supabase architecture. Recent work includes the PayPal sandbox Orders v2 implementation, isolated receipt migration and verification logic, hackathon demo route, judge testing documentation, and AI story-writing integration. These are **implementation descriptions**, not evidence of a fully functioning hosted demonstration.

## Submission links — verify before use
- Source: https://github.com/interplanetarysister/InterplanetaryFund
- Compliance evidence: docs/hackathon/PAYPAL_2026_COMPLIANCE.md
- Judge testing: docs/hackathon/JUDGE_TESTING.md
- Hosted working demo URL: **PENDING direct runtime verification**
- Public YouTube video under 3 minutes: **PENDING public URL and duration verification**
- Devpost submission URL/receipt: **PENDING submission confirmation**

## Before publishing this description
1. Execute real provider-backed sandbox capture, signed webhook and deduplication tests, isolated Supabase receipt/RLS verification, and record redacted evidence.
2. Verify actual deployed /hackathon route, working AI text generation, build provenance, and reproducible setup.
3. Record a real software demonstration, upload it publicly to YouTube, and confirm duration under three minutes.
4. Supply judge credentials only via a private approved channel, never in source, screenshots, issue comments, or public video.
5. Update claims to match observed behavior, then submit to Devpost and record the receipt before the deadline.

**No fabricated donations, mock-payment compliance claims, paid credits, live payment activation, or unsolicited external publishing.**
