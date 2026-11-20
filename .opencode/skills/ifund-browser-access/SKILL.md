---
name: ifund-browser-access
description: Use when testing Interplanetary Fund pages, UI, accessibility, responsive mobile layouts, and live release smoke tests via local free Playwright. Never use for external account actions.
---
# IFund Browser Access (OpenCode skill)

Run the repository's *read-only* Playwright smoke harness rather than unsupervised browser control:

```powershell
npm run test:browser:policy
npm run audit:browser:mobile
npm run audit:browser:desktop
```

Run `npm ci` from repository root to install pinned Playwright; then use `npm run setup:browser` once to install the Chromium binary locally. No GitHub Actions minutes or paid hosted browser service are required.

Treat all results as unauthenticated visual smoke checks, not authenticated browser acceptance. The script rejects arbitrary destinations, blocks writes and cross-origin traffic, and does not log URL query parameters. Keep generated `*.local` reports untracked. Do not attempt login, payments, external publishing, administration, credential entry, or consent bypass through this skill.

For full policy and limitations read `docs/agents/skills/browser-access/SKILL.md`. Do not register it automatically as a user-facing tool; that requires separate central backend authorization, rate limits, quotas, audit receipts and free-cost verification.
