# Interplanetary Fund — Decision Ledger
**Version:** 1.0.0

## Approved Decisions

### D-001: Repository Migration
- Date: 2026-08-07
- Decision: Migrate all files from iFUND_admin enterprise account to interplanetarysister personal account
- Rationale: Enterprise account requires separate auth; personal account has full access
- Status: COMPLETED — 161 files migrated
- Source: Michelle Rogers instruction

### D-002: Convex as Backend Platform
- Date: 2026-08-07
- Decision: Use Convex (rosy-butterfly-2) as the backend platform
- Rationale: Real-time WebSocket, schema validation, cron jobs, credit-free
- Status: ACTIVE

### D-003: Vercel as Primary Frontend Host
- Date: 2026-08-07
- Decision: Vercel primary, GitHub Pages fallback
- Rationale: Auto-deploy, SPA support
- Status: ACTIVE

### D-004: Credit-Free Architecture
- Date: 2026-08-07
- Decision: All recurring operations as backend functions, no invoke_superagent_step
- Rationale: Michelle's directive to never use credits for automation
- Status: ACTIVE — Auto-Continue workflow archived

### D-005: Pollinations.ai for Images
- Date: 2026-08-07
- Decision: Use Pollinations.ai instead of Base44 generate_image
- Rationale: Free, no credits needed
- Status: ACTIVE
- Source: Michelle called hero image credit "wasted"

### D-006: Passwordless Email Auth
- Date: 2026-08-07
- Decision: Passwordless email-based authentication
- Status: ACTIVE

### D-007: Fundforge Integration
- Date: 2026-08-07
- Decision: Integrate fundforge-ai as reference architecture under fundforge/ directory
- Status: COMPLETED — All 21 pages, 18 components ported

### D-008: Lyra to Solene Transition
- Date: 2026-08-07
- Decision: Solene replaces Lyra as Chief of Staff
- Status: COMPLETED — SOLENE_TRANSITION.md created

### D-009: 7-Agent Architecture
- Date: 2026-08-07
- Decision: 7 specialized agents with per-agent automation toggles
- Status: ACTIVE — All 7 agents onboarded

### D-010: Campaign Protocol P-1 through P-8
- Date: 2026-08-01 (established by Lyra)
- Decision: 8 protocol standards enforced on all campaigns
- Status: ACTIVE — Daily auto-fix at 6am PT

### D-011: TypeScript Error Elimination
- Date: 2026-08-07
- Decision: Fix all 5848 TypeScript errors to 0
- Status: COMPLETED — 0 errors as of 2026-08-07

### D-012: Portable Agent Identity
- Date: 2026-08-07
- Decision: Build portable agent knowledge base for cross-platform continuity
- Status: IN PROGRESS — This document

## Rejected Decisions
- Using Base44 credits for hero image generation (Michelle called it "wasted")
- Using Auto-Continue workflow (archived — consumed credits)
- Paying for any service or upgrading to paid tiers (Michelle: never pay)

## Changed Decisions
- Lyra → Solene transition (Lyra retired 2026-08-07)
- iFUND_admin → interplanetarysister (enterprise → personal account)
