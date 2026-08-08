# Interplanetary Fund — Portability Assessment
**Version:** 1.0.0
**Date:** 2026-08-07

## What Can Move to Another Platform

### Fully Portable
1. *All source code* — React/TypeScript/Vite frontend, Convex backend functions
2. *All documentation* — Markdown files in repo and docs/
3. *Database schema* — Convex schema.ts defines all 47 tables
4. *Architecture knowledge* — ARCHITECTURE.md, this knowledge base
5. *Protocol definitions* — Campaign Protocol P-1 through P-8
6. *Agent definitions* — Agent roster, capabilities, permissions
7. *Decision history* — Decision ledger with provenance
8. *Task history* — Task registry with states
9. *Audit history* — Audit registry with findings
10. *Configuration files* — package.json, tsconfig.json, vite.config.ts
11. *CI/CD workflows* — GitHub Actions YAML files
12. *Testing procedures* — Playwright config, test files
13. *Mobile config* — Capacitor config, build scripts

### Partially Portable (requires adaptation)
1. *Backend runtime* — Convex-specific functions need adapter for other platforms
   - Convex query() → generic read function
   - Convex mutation() → generic write function
   - Convex cronJobs() → platform-specific scheduler
2. *Real-time WebSocket* — Convex-specific, needs alternative (Socket.io, Supabase, etc.)
3. *Frontend hosting* — Vercel-specific config, adaptable to Netlify, Cloudflare Pages, etc.
4. *OAuth connections* — Base44-specific connector system, needs reimplementation
5. *Agent automation* — Convex cron jobs, adaptable to any scheduler

### Base44-Dependent (cannot move directly)
1. *Base44 entity system* — manage_entity_schemas, create_entity_records, read_entities
   - MIGRATION: Use Convex tables directly (already implemented)
2. *Base44 backend functions* — deploy_backend_function, test_backend_function
   - MIGRATION: Use Convex HTTP endpoints or other serverless platform
3. *Base44 workflows* — create_or_update_workflow, manage_workflow
   - MIGRATION: Use GitHub Actions or other workflow engine
4. *Base44 image generation* — generate_image
   - MIGRATION: Already replaced with Pollinations.ai (free)
5. *Base44 session logs* — read_session_log, list_sessions
   - MIGRATION: Export to conversation-index before leaving
6. *Base44 identity/memory* — IDENTITY.md, SOUL.md, USER.md, memory.md
   - MIGRATION: This knowledge base replaces this dependency
7. *Base44 messaging channels* — WhatsApp connection
   - MIGRATION: Use Twilio or other messaging API
8. *Base44 browser automation* — Browserbase tools
   - MIGRATION: Use Playwright directly or other browser automation

## Risk Assessment

### Low Risk (portable as-is)
- Source code, documentation, configuration files
- Architecture and design knowledge
- Protocol and audit history

### Medium Risk (needs adaptation)
- Backend functions (Convex → generic)
- Real-time updates (Convex WebSocket → alternative)
- Agent automation (Convex cron → alternative scheduler)

### High Risk (significant rework needed)
- OAuth connector system
- Workflow engine
- Messaging channel integration
- Session/conversation history (must export before leaving)

## What Would Be Lost If Base44 Disappeared Tomorrow

### Lost (if not exported)
1. Conversation history (30+ sessions) — MUST export before leaving
2. Saved memories (18+ saved facts) — MUST export before leaving
3. Identity files (IDENTITY.md, SOUL.md, USER.md) — MUST export before leaving
4. OAuth connections (Gmail, WhatsApp) — Must re-establish on new platform
5. Base44 entity data (TaskRelay) — Must export to portable format

### Preserved (in GitHub repo)
1. All source code
2. All documentation
3. All configuration files
4. Database schema
5. CI/CD workflows
6. This knowledge base (after commit)

### Mitigation Actions (completed or in progress)
1. ✅ This knowledge base captures identity, instructions, architecture
2. ✅ Conversation index captures session metadata
3. ✅ Decision ledger preserves key decisions
4. ✅ Task registry preserves work history
5. ⬜ Export raw session logs to repo (for full conversation preservation)
6. ⬜ Export saved memories to repo
7. ⬜ Export identity files to repo (template, not personal data)
