# Interplanetary Fund — Capability Registry
**Version:** 1.0.0

## Abstract Capabilities (platform-agnostic)

### CAP-001: Audit Frontend
- Description: Review frontend code for type safety, component coverage, page completeness
- Required: read_code, search_code
- Risk: low
- Approval: not required

### CAP-002: Audit Backend
- Description: Review backend functions, schema, cron jobs, API endpoints
- Required: read_code, read_database_schema
- Risk: low
- Approval: not required

### CAP-003: Audit Database
- Description: Review schema, indexes, data integrity, row-level security
- Required: read_database_schema, read_code
- Risk: low
- Approval: not required

### CAP-004: Build Campaign Functionality
- Description: Implement campaign creation, editing, display, donation flows
- Required: read_code, write_code, deploy_backend, deploy_frontend
- Risk: medium
- Approval: required for production deployment

### CAP-005: Implement Authentication
- Description: User registration, login, profile management, admin access
- Required: read_code, write_code, deploy_backend
- Risk: high
- Approval: required

### CAP-006: Implement Payment Flows
- Description: PayPal, Stripe, CashApp integration and webhook handling
- Required: read_code, write_code, deploy_backend, configure_webhooks
- Risk: high
- Approval: required

### CAP-007: Audit Stripe Integration
- Description: Review Stripe checkout, webhook, payment flow
- Required: read_code, read_logs
- Risk: low
- Approval: not required

### CAP-008: Audit PayPal Integration
- Description: Review PayPal checkout, webhook, payment flow
- Required: read_code, read_logs
- Risk: low
- Approval: not required

### CAP-009: Implement AI Campaign Generation
- Description: AI content generation (FAQ, social, press, SEO, images)
- Required: read_code, write_code, deploy_backend
- Risk: medium
- Approval: required for production

### CAP-010: Design Agent Hierarchies
- Description: Create and manage specialized AI agents
- Required: read_code, write_code, deploy_backend
- Risk: medium
- Approval: required

### CAP-011: Perform Production-Readiness Audits
- Description: Full system audit (frontend, backend, database, security)
- Required: read_code, read_database_schema, read_logs, run_tests
- Risk: low
- Approval: not required

### CAP-012: Analyze Application Architecture
- Description: Review system design, data flow, dependencies
- Required: read_code
- Risk: low
- Approval: not required

### CAP-013: Manage Tasks
- Description: Create, update, track tasks across agents
- Required: write_project_context
- Risk: low
- Approval: not required

### CAP-014: Coordinate External Agents
- Description: Delegate tasks to external agents, provide context
- Required: communicate_with_agent, read_project_context
- Risk: medium
- Approval: required for code changes

### CAP-015: Perform Regression Audits
- Description: Re-run previous audits to check for regressions
- Required: read_code, run_tests, read_logs
- Risk: low
- Approval: not required

### CAP-016: Review Security
- Description: Review auth, authorization, fraud prevention, data protection
- Required: read_code, read_database_schema
- Risk: low
- Approval: not required

### CAP-017: Review Integrations
- Description: Review external platform connections, API integrations
- Required: read_code, read_logs
- Risk: low
- Approval: not required

### CAP-018: Deploy Code
- Description: Deploy to Convex, Vercel, GitHub Pages
- Required: deploy_backend, deploy_frontend
- Risk: high
- Approval: required

### CAP-019: Browser Automation
- Description: Test user flows via Browserbase
- Required: browser_automation
- Risk: low
- Approval: not required

### CAP-020: Manage Treasury
- Description: Holding accounts, payouts, fee config, fund consolidation
- Required: read_code, write_code, deploy_backend
- Risk: high
- Approval: required

## Runtime-Specific Implementations

### Base44 Runtime
- read_code → read_file, grep, bash
- write_code → write_file, bash
- deploy_backend → deploy_backend_function, npx convex deploy
- deploy_frontend → git push (auto-deploy to Vercel)
- read_database_schema → manage_entity_schemas, read_entities
- run_tests → npx tsc --noEmit, playwright
- browser_automation → browserbase_* tools
- communicate_with_agent → (not available in current runtime)

### GitHub Runtime (future)
- read_code → git show, cat
- write_code → git commit
- deploy_backend → GitHub Actions (convex-deploy.yml)
- deploy_frontend → GitHub Actions (deploy-pages.yml)
- run_tests → GitHub Actions CI
- read_database_schema → read convex/schema.ts

## Tool Adapter Architecture
```
Abstract Capability
├── Base44 Adapter (current)
├── GitHub Adapter (future)
├── Cloud Agent Adapter (future)
└── Local Agent Adapter (future)
```

Each adapter implements:
- read_code()
- write_code()
- search_code()
- read_database_schema()
- run_tests()
- deploy()
- read_logs()
- create_task()
- update_task()
- read_project_context()
- write_project_context()
- communicate_with_agent()
- request_approval()
