# iFund PayPal AI Hackathon — judge testing guide (verification pending)

This guide is intentionally **not** a certification of a functioning payment demo. See [PAYPAL_2026_COMPLIANCE.md](PAYPAL_2026_COMPLIANCE.md) for the current evidence ledger and release gates.

## Architecture and source
- Deployable source: https://github.com/interplanetarysister/InterplanetaryFund (AGPL-3.0).
- Original Base44 application is a **visual/functional reference only**; it is not a backend fallback.
- Runtime: Cloudflare Pages/Workers + Supabase. The PayPal sandbox must use its own sandbox REST app credentials, webhook ID, and isolated database tables.
- Never use live PayPal credentials or a live buyer for this demonstration.

## Reproducible setup (maintainer)
1. Clone the deployable repository at a recorded commit SHA. Follow the root README for its current package manager, install and build commands; verify the commands on a clean checkout before claiming reproducibility.
2. Provision an authorized Cloudflare **preview** deployment, not production. Configure server-only encrypted bindings for matching sandbox PayPal client ID/secret, sandbox webhook ID, Supabase URL and server secret. Do not place these in Vite public variables or source control.
3. Review and apply `supabase/migrations/20261109_ifund_paypal_hackathon_sandbox_isolation.sql` in the intended Supabase environment; verify anonymous/authenticated clients cannot read sandbox order/event tables.
4. Register the exact deployed preview webhook URL `https://<actual-preview-host>/api/paypal/sandbox/webhook` with the PayPal **sandbox** app. Save the provider-assigned webhook ID as a secret binding.
5. Only after the above, enable `IFUND_PAYPAL_SANDBOX_ENABLED=enabled` on preview. Check `/api/paypal/sandbox/status`; if unavailable, disabled, or unhealthy, stop and report the demo as blocked.

## Judge walkthrough (only after hosted verification)
1. Open the **verified** preview `/hackathon` route; confirm the app loads on desktop and mobile.
2. Demonstrate a real AI campaign-drafting action. Record input, generated output, and an actual saved draft where permitted. Clearly distinguish implemented AI from static samples.
3. Choose a clearly labeled **DEMO / NO REAL FUNDRAISING** campaign. In the PayPal sandbox flow, approve using a controlled sandbox buyer, then capture/verify. Do not enter live financial details.
4. Show a PayPal-confirmed order/capture, exactly one corresponding isolated Supabase receipt, a verified webhook event, and a repeat capture that does **not** duplicate receipts.
5. Confirm real campaign totals and financial ledgers remain unchanged. Confirm invalid/unsigned webhooks and provider failures do not show success.
6. If any step fails, document the error and do **not** describe PayPal integration as complete.

## Access and evidence handling
- Supply judge test credentials **privately through the submission's permitted secure channel**, never in this repository, public video, issue comments, or screenshots. Prefer disposable least-privilege test users. Never share an owner/super-admin account.
- Capture timestamped evidence: deployed URL and commit, PayPal sandbox order/capture identifiers (redacted as appropriate), webhook verification result, isolated receipt count, RLS checks, and AI input/output.
- Publish a public YouTube video **under three minutes** showing real software, not a mockup; check public visibility and runtime before adding the verified link.
- Submit a truthful English description and verify a final Devpost submission receipt before November 12, 2026 at noon Pacific. Do not claim acceptance without evidence.
- No unsolicited external posts, paid AI credits, live charges, or unverified demo donations.

## Evidence register
| Gate | Evidence URL / identifier | Result |
| --- | --- | --- |
| Hosted preview and build SHA | Pending live verification | Unverified |
| Real sandbox order and capture | Pending | Unverified |
| Signed webhook and deduplication | Pending | Unverified |
| Isolated Supabase receipt / RLS | Pending | Unverified |
| Hosted AI drafting | Pending | Unverified |
| Public YouTube video (<3 minutes) | Pending | Unverified |
| Devpost submission receipt | Pending | Unverified |

Update the compliance ledger and this register only with provider-backed or directly observed evidence.
