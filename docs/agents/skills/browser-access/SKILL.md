---
name: ifund-browser-access
description: Read-only, free local Playwright inspection of authorized Interplanetary Fund pages.
---
# Shared iFund browser skill

This is a **development/QA skill**, not a member-facing agent tool grant. All nine specialists may request reports through an authorized runner. Do not expose the runner to arbitrary user URLs, bypass the protected `worker/services/tool-registry.js`, or infer external account permission from this file.

## Local Windows PowerShell usage

From your authenticated clone of `interplanetarysister/InterplanetaryFund`:

```powershell
node --version
# Root package-lock.json includes Playwright
npm ci --no-audit --no-fund
# One-time explicit Chromium download
npm run setup:browser
npm run test:browser:policy
npm run audit:browser:mobile
npm run audit:browser:desktop
```

Playwright is a pinned root development dependency, so no `IFUND_PLAYWRIGHT_MODULE` override is needed after `npm ci`. Audit reports ending in `.local` are ignored by Git.

## Boundaries

- Canonical iFund HTTPS origins and local loopback development servers only. All network requests are intercepted, and only read methods on the audited origin or public canonical Supabase host are allowed.
- No credentials, logins, forms, account creation, messages, payments, withdrawals, publishing, or external site browsing. No persistent browser sessions or screenshots containing private account data.
- Report HTTP status, page title, visible text, main headings, mobile horizontal overflow, JavaScript page errors, blocked requests, and clear PASS/FAIL.
- Mark authentication, owner/RLS, provider connections, payments and actual campaign publishing **NOT TESTED** unless independently accepted via proper protected sandbox workflows.
- Cloudflare Browser Run is an optional remote fallback with account-wide limits; never trigger metered overages or make it a mandatory dependency.
- Use the existing central backend authorization, cost controls, version checks and audit contract before ever registering a user-facing tool. Documentation alone does not enable a live capability.

Run the browser audit separately from unit tests. GitHub Actions must not be enabled merely to run this skill.
