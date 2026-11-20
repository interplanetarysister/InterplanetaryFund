---
name: ifund-builder-browser
description: Use in OpenCode for local read-only desktop/mobile Playwright QA of Interplanetary Fund pages, frontend debugging and release smoke testing; never for website member-agent actions.
---
# IFund Builder Browser — OpenCode

**Audience:** the local builder/QA agent using the developer's repository checkout. This is not a runtime skill for user-facing iFund specialists.

## Preconditions

Run from the root of `interplanetarysister/InterplanetaryFund`. Inspect `git status --short` first; preserve any uncommitted work. Node.js 22+ and npm are required. The root `package.json` pins Playwright to `1.56.1`; `npm ci --no-audit --no-fund` installs it from the lockfile. Do not install duplicate global packages or change the lockfile to run audits.

## Execution

```powershell
npm ci --no-audit --no-fund
npm run test:browser:policy
npm run audit:browser:mobile
npm run audit:browser:desktop
```

The two audit scripts invoke `playwright install chromium` to provision local Chromium as needed. This is a free local download, separate from the application build. `npm run setup:browser` pre-installs Chromium. Reports are `browser-mobile.local` and `browser-desktop.local`; `*.local` is gitignored. To inspect one allowed page, use `node scripts/agent-browser-audit.mjs --url https://interplanetaryfund.com/discover --mobile`.

## Interpret evidence

Report observed status, page title, headings, visible content, console/page errors, blocked network requests and overflow. An HTTP 200 or successful build is not end-to-end acceptance. This harness is **unauthenticated and read-only**: it blocks non-read HTTP methods, disallowed origins and service workers. No login credentials, account administration, financial operations or publishing through this skill. Do not add query tokens to URLs.

If a check fails, inspect the source and logs, make scoped fixes in the existing branch and rerun the checks. Preserve provider receipts, verified user data and production release controls. Never call this skill a verified customer-agent browser capability.

For the **separate website-agent research contract**, see `docs/agents/skills/browser-access/SKILL.md`. That contract needs protected backend implementation and runtime authorization before it can be offered to members; do not substitute this developer's local browser for their sessions.
