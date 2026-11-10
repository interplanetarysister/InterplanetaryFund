# PayPal AI Hackathon — 2:45 live-product video capture plan

**Status:** production storyboard, NOT evidence of a completed video. Record only after the hosted demo is tested. Deadline: November 12, 2026 noon Pacific. Public YouTube video must be **under 3 minutes**.

## Preflight: stop if any gate fails

- Record the exact Cloudflare preview URL, deployment ID and Git commit. Confirm `/hackathon` renders the actual application (not a blank page or SPA fallback) and the sandbox status API returns its own JSON.
- Confirm the real AI provider responds with generated text, not hardcoded examples or mock responses; verify a draft can be saved where authorized.
- Confirm PayPal **sandbox** Orders v2 returns a provider order, sandbox buyer approval, a provider-confirmed capture, and a verified webhook. Check one receipt in `ifund_paypal_sandbox_orders` and deduplicated event in `ifund_paypal_sandbox_events`; real `ifund_donations` and campaign totals must not change.
- Use a clearly labeled DEMO / NO REAL FUNDRAISING campaign. Never depict a sandbox checkout as a real donation. Never use the owner's super-admin login.
- Remove browser autofill, credentials, payment account emails, secrets, tokens, and private identifiers from screen recording. Do not expose a terminal with environment variables. Do not spend paid credits.
- If any gate fails, record the truthful partial feature demo instead, and **do not claim hackathon PayPal compliance**.

## Timed shot list (target 2:45)

| Time | On-screen action | Narration cue |
| --- | --- | --- |
| 0:00–0:15 | Actual IFund homepage and mobile campaign discovery | “Interplanetary Fund helps organizers create and share campaigns with AI assistance.” |
| 0:15–0:55 | Open campaign creation; enter a fictional clearly labeled demo cause; invoke real AI, show generated title/description/story | “The campaign assistant produces editable writing from organizer input.” Only mention choices actually working. |
| 0:55–1:15 | Save authorized draft and show the result; keep DEMO / NO REAL FUNDRAISING label visible | “This is a demonstration campaign, not an appeal for real donations.” |
| 1:15–1:30 | Open actual `/hackathon` page; show the sandbox environment indicator | “PayPal REST Orders v2 is used in a separate sandbox test flow.” |
| 1:30–2:10 | Provider-hosted sandbox buyer approval and real capture, masking buyer information | “This transaction is a PayPal sandbox test; no real money changes hands.” |
| 2:10–2:30 | Show redacted PayPal confirmation and isolated receipt plus webhook verification; no production financial totals changed | “Server-side verification and isolated receipts keep test payments separate from fundraising.” |
| 2:30–2:45 | Repository, license and short closing screen with working demo URL | “The deployable app runs on Cloudflare and Supabase. Source and judge instructions are linked in the submission.” |

If the flow runs long, shorten transitions; do not accelerate away the provider approval or pretend a capture succeeded. Keep the final public video below 180 seconds.

## Publishing evidence

Record the final video duration, public YouTube watch URL, successful incognito playback, and publication time. Record the Devpost project URL, final submission receipt/status, and timestamp. Add only verified links to `PAYPAL_2026_COMPLIANCE.md` and `JUDGE_TESTING.md`. A drafted video, private/unlisted upload, or incomplete Devpost form is **not** submission evidence.

## Showcase operations register

Until authorization and labeling are checked, count all four existing Supabase campaigns as **unclassified**, not as showcase successes. Maintain for each authorized showcase item: internal campaign ID, owner authorization, category, DEMO label, publication status, validated public URL, and timestamp. Do not manufacture activity or post to external networks without explicit authorization.
