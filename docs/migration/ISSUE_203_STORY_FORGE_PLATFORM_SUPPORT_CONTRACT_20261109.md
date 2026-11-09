# Issue #203 — Story Forge and platform-support implementation handoff (2026-11-09)

## Canonical source refresh
Latest observed `interplanetarysister/interplanetary-fund2/main` commit: `0e5acefa43f17642394f71f0be9726b60d93677e` (2026-11-09 05:55:49 UTC). Resolve main again immediately before build; do not use stale hard-coded source revisions. Preserve original Base44 SDK/auth/data/functions until the owner authorizes each replacement unit.

## Story Forge — frontend owner and AI service owner
- AI-generated **full campaign story** (not title, short description, individual section, or human-written content): at least **1,000 JavaScript string characters**, counting spaces, punctuation, digits, and newline characters, and at least **two non-empty paragraphs** separated by a blank line. Use `story.length >= 1000` and `story.trim().split(/\n\s*\n/).filter(p => p.trim()).length >= 2`. Do not strip whitespace before measuring character length. Normalize line endings consistently before validation.
- Validate on AI response before presenting a completed generation; if too short, request an extension only through an already-authorized, no-credit route or report that generation is incomplete. Never fabricate filler or automatically spend Base44 builder credits.
- **Human-authored stories have no minimum**. No minLength on shared story editor, save draft, publish, database schema, or API. AI-origin validation must not be applied to manual edits or user-supplied stories. Regenerated individual sections may be shorter; validate the assembled full AI story if it is represented as complete.
- Preserve five title options, two short-description options, one full story at a time, per-section regeneration, original mobile layout, guest composition, and return-to-draft after auth.
- Add tests for 999/1000 characters, one/two paragraphs, whitespace and punctuation counting, manual one-character and empty drafts, and section regeneration.

## Campaign page — platform support while campaign payments paused
- On every campaign detail page, keep campaign donation checkout disabled while campaign payments are paused. Add a distinct optional `Support Interplanetary Fund` action, clearly described as funding **platform moderation, maintenance and development**, not the displayed campaign or beneficiary.
- Reuse the existing **verified** platform PayPal support destination only; do not invent a URL, enable a new payment integration, or repurpose campaign checkout. If no verified destination is available, show an honest unavailable state instead of a live payment button.
- Never credit platform support to campaign totals, supporter counts, campaign donor receipts, or the 7% campaign withdrawal ledger. Keep a separate platform-support classification and disclose the recipient before leaving the page. Do not imply tax deductibility.
- Mobile-first placement next to the campaign donations-paused notice; ensure accessible label, clear external destination and no confusion with campaign donation.
- Add tests confirming every campaign detail route offers support while campaign checkout remains disabled, and no campaign financial record is created by the support action.

## Ownership and safety
Lead architect edits documentation and integration contracts only on `agent/lead-architecture`; frontend owner implements UI, AI/backend owner implements generation validation as needed, QA independently tests. Do not overwrite their files. No credit-consuming builder, no Base44 runtime removal, no production promotion. Validate preview before user-approved production.
