# Interplanetary Fund — Source References
**Version:** 1.0.0

## Source Types and Provenance

### Code Sources
- Repository: https://github.com/interplanetarysister/InterplanetaryFund
- Convex schema: convex/schema.ts (47 tables, 808 lines)
- Convex functions: 64 files in convex/
- Frontend pages: 30+ files in src/pages/
- Frontend components: 26 files in src/components/
- Fundforge reference: fundforge/ directory

### Documentation Sources
- ARCHITECTURE.md — System architecture diagram
- ACTION_PLAN.md — Feature implementation plan
- AUDIT_REPORT.md — Schematic proof audit
- docs/CAMPAIGN_PROTOCOL.md — Protocol P-1 through P-8
- docs/AGENT_ROSTER.md — Agent registry
- docs/CREDIT_FREE_AGENT_PROTOCOL.md — Credit-free architecture
- docs/SOLENE_TRANSITION.md — Lyra to Solene transition
- docs/ACTION_PLANS.md — Action plans #001-#004
- docs/AGENT_DISCOVERY.md — Agent discovery notes
- docs/BROWSERBASE_TOOLS.md — Browserbase tools guide
- docs/FINANCIAL_CONSOLIDATION_AUDIT.md — Financial audit
- BRANDING_SHEET.md — Brand guidelines
- MOBILE_ROADMAP.md — Mobile development roadmap
- MOBILE_BUILD.md — Mobile build instructions

### Conversation Sources
- 30+ Base44 sessions (2026-08-07)
- Accessible via read_session_log
- Indexed in conversation-index/CONVERSATION_INDEX.md

### Configuration Sources
- package.json — Dependencies and scripts
- tsconfig.json — TypeScript configuration
- vite.config.ts — Vite build config
- capacitor.config.ts — Mobile config
- vercel.json — Vercel deployment config
- .github/workflows/ — 4 GitHub Actions workflows
- playwright.config.ts — Test configuration

### External API Sources
- Convex Cloud API (rosy-butterfly-2.convex.cloud)
- Stripe API (payment processing)
- PayPal API (payment processing)
- Resend API (email delivery — needs key)
- Browserbase API (browser automation)
- Pollinations.ai API (image generation)
- globe.gl (3D visualization)

### Database Sources
- Convex tables: 47 tables (see database/DATABASE_SCHEMA.md)
- Production data: 10 campaigns, 17 donors, $19,839 raised, 7 agents

## Provenance Tracking
Each knowledge item should include:
- source_type: code | documentation | conversation | configuration | external_api | database
- source_reference: file path, URL, session ID, or table name
- source_timestamp: when the source was last verified
- confidence: verified | inferred | legacy
- status: current | historical | deprecated | unknown
