---
inclusion: always
---
# Interplanetary Fund — product intent

Interplanetary Fund (IFund) is an AI-assisted crowdfunding platform for creating, discovering, promoting, donating to, and managing campaigns. Public visitors can discover campaigns and donate; registered users can create and manage their own campaigns.

## Product commitments
- Preserve actual Base44-source behavior and contracts while migrating. The source is read-only: `interplanetarysister/interplanetary-fund2`. A listed feature is not evidence that its replacement is implemented.
- Keep campaign draft save and publish distinct and test both against actual authenticated backend persistence; never pretend a successful write when a request failed.
- Preserve community updates and campaign discovery, donation/payment tracking, subscription functionality where present, platform connections, consent-aware outbound promotion, notifications, media handling, and reporting. Verify details in the inventory and source before implementing.
- Present gift amount separately from optional platform support, processor fees, and any withdrawal-side fee. Never silently deduct a fee from public fundraising totals. Verify current source and owner policy before changing amounts or percentages.
- Protect user identity, private donation details, payment state, API credentials, and authorization boundaries.
- End users communicate with the Chief of Staff agent and Support agent; specialist agents operate behind the scenes. Show task status without disclosing private inter-agent messages, credentials, or backend details.
- IFund is entering the **PayPal AI Hackathon (2026)** with AWS in its chosen implementation. For competition-specific requirements see `paypal-aws-hackathon.md`; AWS is not a substitute for the separately approved Supabase/Cloudflare migration stack.
- Remove placeholder features and misleading "connected" states: connected must mean a verified working integration, not just configured-looking UI.

## Authority
GitHub issue #137 and the current branch `AGENTS.md` are authoritative for migration scope, safeguards, and the seven-phase release gate. Existing repository code and verified tests outrank assumptions in this summary. Do not treat this document as a request to deploy or enable payments.
