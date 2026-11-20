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
# If needed (without writing a lockfile): npm install --no-save --package-lock=false playwright
# If Chromium is missing: npx playwright install chromium
node --test tests/agent-browser-policy.test.mjs
node scripts/agent-browser-audit.mjs --url https://interplanetaryfund.com --mobile --json browser-mobile.local
node scripts/agent-browser-audit.mjs --url https://interplanetaryfund.com --json browser-desktop.local
```

Your preinstalled Playwright may already satisfy the dependency. If it is installed elsewhere, point `IFUND_PLAYWRIGHT_MODULE` to its installed module path. Files ending in `.local` are ignored by Git.

## Boundaries

- Canonical iFund HTTPS origins and local loopback development servers only. All network requests are intercepted, and only read methods on the audited origin or public canonical Supabase host are allowed.
- No credentials, logins, forms, account creation, messages, payments, withdrawals, publishing, or external site browsing. No persistent browser sessions or screenshots containing private account data.
- Report HTTP status, page title, visible text, main headings, mobile horizontal overflow, JavaScript page errors, blocked requests, and clear PASS/FAIL.
- Mark authentication, owner/RLS, provider connections, payments and actual campaign publishing **NOT TESTED** unless independently accepted via proper protected sandbox workflows.
- Cloudflare Browser Run is an optional remote fallback with account-wide limits; never trigger metered overages or make it a mandatory dependency.
- Use the existing central backend authorization, cost controls, version checks and audit contract before ever registering a user-facing tool. Documentation alone does not enable a live capability.

Run the browser audit separately from unit tests. GitHub Actions must not be enabled merely to run this skill.
