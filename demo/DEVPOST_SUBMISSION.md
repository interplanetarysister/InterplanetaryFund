# Devpost submission package — Interplanetary Fund

## Short description

Interplanetary Fund is a fictional fundraising sandbox demo where an AI assistant helps organizers turn an idea into a campaign and PayPal Orders v2 makes the contribution experience verifiable. The demo links generated campaign messaging to published fictional campaigns, isolated test checkout, provider-confirmed captures, signed webhook reconciliation, receipts, and role-scoped financial views.

## PayPal usage

The application uses PayPal's free sandbox OAuth and REST Orders v2 create/capture flow, along with webhook signature verification and order reconciliation. A sandbox checkout is not recognized as complete until its PayPal capture is verified and persisted. Signed event IDs are deduplicated. A double-entry test ledger and receipt are written only for confirmed sandbox captures. No real payments are made through this demo.

## AI usage

Cloudflare Workers AI uses the Llama 3.3 70B Instruct model for campaign drafting: five candidate titles, two descriptions, a long-form story, and individually regenerated story sections. Organizers edit and review results rather than publishing unreviewed synthetic claims. The demonstration clearly labels fictional content.

## Judge links

- **New guided walkthrough:** https://ifund-hackathon-demo.interplanetary-fund.workers.dev/api/judge-guide — seven steps, no guide popup covering highlighted controls; existing sandbox React app remains interactive.
- Demo: https://ifund-hackathon-demo.interplanetary-fund.workers.dev/
- Alternate entry point: https://ifund-demo-ai-check.interplanetary-fund.workers.dev/
- Source: https://github.com/interplanetarysister/InterplanetaryFund/tree/main/demo
- Official rules: https://paypalaihackathon.devpost.com/rules

## Video — proposed recording structure (< 3 minutes)

0:00–0:20 — Identify the challenge and show the actual demo homepage on a smartphone/browser.
0:20–0:55 — Create a fictional campaign using live AI-generated title, descriptions, story and section regeneration.
0:55–1:20 — Publish the fictional campaign and browse its public page.
1:20–2:05 — On a sandbox personal buyer, approve a PayPal sandbox contribution. Show actual PayPal approval, the return to IFund, reconciliation and receipt.
2:05–2:35 — Show the donor/organizer financial view and admin evidence: receipt, ledger, webhook replay protection.
2:35–2:50 — Highlight no-live-money isolation and impact of faster, better-controlled campaign setup.

**Do not generate fake screen footage or claim that a transaction completed unless the recorded demo actually shows the provider-confirmed result.** Upload the video publicly to YouTube and add the real link to Devpost. Keep access open through the judging window.

## Submission readiness

Text, tool identification, public code and licensing are documented here. Actual functional browser testing, YouTube URL and Devpost submission receipt remain outstanding until independently verified.
