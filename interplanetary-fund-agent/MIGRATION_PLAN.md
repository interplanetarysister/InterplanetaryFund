# Interplanetary Fund — Migration Plan (Away from Base44)
**Version:** 1.0.0
**Date:** 2026-08-07

## Scenario: Moving the Interplanetary Fund Agent to a New Runtime

### Step 1: Export Knowledge Base
- Commit interplanetary-fund-agent/ directory to GitHub repo
- Export conversation index to conversation-index/CONVERSATION_INDEX.md
- Export saved memories (excluding secrets) to source-references/
- Export decision ledger, task registry, audit registry

### Step 2: Set Up New Runtime
- Deploy Convex backend (already on Convex Cloud, independent of Base44)
- Deploy frontend to Vercel (already auto-deploys from GitHub)
- Set up GitHub Actions workflows (already configured)
- Configure OAuth connections on new platform (if needed)

### Step 3: Initialize New Agent
- Import portable context package (handoffs/PORTABLE_CONTEXT_PACKAGE.md)
- Validate agent identity against package version
- Load relevant context based on new agent's role
- Verify against current codebase
- Flag any conflicts between package state and actual state
- Begin execution

### Step 4: Verify Continuity
- Run TypeScript compilation check (npx tsc --noEmit)
- Verify Convex deployment status
- Verify Vercel deployment status
- Run E2E tests (Playwright)
- Check protocol compliance (daily auto-fix cron)
- Verify agent automation cycles
- Check treasury consolidation

### Step 5: Establish New Communication
- Set up messaging channel on new platform (if applicable)
- Re-establish OAuth connections (Gmail, etc.)
- Configure email delivery (Resend API key)
- Verify notification system

## What Stays the Same (Base44-independent)
- GitHub repository (interplanetarysister/InterplanetaryFund)
- Convex Cloud backend (rosy-butterfly-2)
- Vercel frontend hosting
- All source code
- All documentation
- Database schema and data
- CI/CD workflows
- Cron jobs (run on Convex, not Base44)

## What Changes
- Agent runtime (Base44 → new platform)
- Messaging channel (Base44 WhatsApp → alternative)
- OAuth connector system (Base44 → direct API)
- Browser automation (Base44 Browserbase → direct Playwright)
- Workflow engine (Base44 workflows → GitHub Actions)
- Session/conversation management (Base44 → new platform)

## Timeline Estimate
- Knowledge base export: 1 session (this session — IN PROGRESS)
- New runtime setup: 1-2 sessions
- Verification: 1 session
- Total: 3-4 sessions

## Dependencies
- GitHub account access (interplanetarysister)
- Convex deployment access (rosy-butterfly-2)
- Vercel project access
- New platform account (if migrating runtime)
