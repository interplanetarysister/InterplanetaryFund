---
inclusion: auto
name: paypal-aws-hackathon
description: Use for IFund PayPal AI Hackathon preparation, PayPal payments or sandbox integration, AWS integration for the entry, demonstrations, submission and compliance checks.
---
# IFund PayPal AI Hackathon 2026

Owner decision: Interplanetary Fund is entering the PayPal AI Hackathon, using AWS as part of the selected project approach.

Official sources:
- https://paypalaihackathon.devpost.com/rules
- https://paypalaihackathon.devpost.com/
- https://developer.paypal.com/

## Confirmed entry constraints (check current rules before submission)
- Deadline **2026-11-12 at 12:00 PM Pacific**.
- Meaningful PayPal developer integration using the free sandbox and meaningful AI functionality; a working, demonstrable project.
- Existing apps must be significantly updated during the submission period, with that work explained.
- A **public** code repository with a discoverable **open-source license** and reproducible setup instructions.
- Accessible working demo (functional hosted site OR complete local run instructions); mere UI mockup is insufficient.
- A publicly visible YouTube demo showing working software, **under 3 minutes**.
- Submission text with features/functionality; do not claim unavailable features.
- AWS is an owner-selected technology, **not an official PayPal hackathon requirement**; document what specific AWS component does and demonstrate it truthfully.

## IFund demo acceptance targets (proposals, not claims of completion)
- A visitor discovers a campaign, reviews its actual information and initiates a PayPal sandbox donation.
- A server verifies order/payment state, records a single idempotent donation, and shows a consistent campaign/ledger update.
- A user uses an actual AI-powered campaign-drafting or promotion-assist feature with clear user review before posting.
- Show AWS's real functioning contribution if included; avoid fake AWS or PayPal integrations and do not require real money for the demo.
- Explain how these improvements were built during the hackathon period.

## Guardrails
- Sandbox first. Test signatures, webhook retries and failed/cancelled transaction paths; never process live funds during compliance demos.
- Keep credentials in secret stores. Public repo must not contain secrets; use safe sample values and repeatable test instructions.
- A free runner or offline checks before any billable AWS/Cloudflare/Supabase/API call. Explicit owner approval is required for spending or production/provider changes.
- Competition readiness and the production Base44 cutover are **separate gates**: working sandbox demo does not establish migration parity or authorize DNS switch.
- Track missing demonstration evidence and submission assets without calling them complete.
