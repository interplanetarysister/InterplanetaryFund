# Interplanetary Fund — System Architecture
**Version:** 1.0.0
**Last Updated:** 2026-08-07

## System Diagram
```
GitHub Repository (interplanetarysister/InterplanetaryFund)
├── Convex Backend (convex/) — 64 functions, 47 tables, 12+ cron jobs
├── React Frontend (src/) — 30+ pages, 26 components
├── Capacitor Mobile (android/ ios/)
├── FundForge Reference (fundforge/)
├── GitHub Actions Workflows (.github/workflows/)
│   ├── Build Android APK
│   ├── Convex Deploy
│   ├── Deploy Pages
│   └── Site Health Check
└── Base44 Sync (base44/)

Deployment:
├── Convex Cloud (rosy-butterfly-2.convex.cloud)
├── Vercel (interplanetary-fund.vercel.app — primary)
└── GitHub Pages (interplanetarysister.github.io/InterplanetaryFund/ — fallback)
```

## Data Flow
1. User opens web app (Vercel primary, GitHub Pages fallback)
2. React frontend connects to Convex via WebSocket (real-time)
3. Convex backend handles auth, CRUD, payments, protocol, agents, treasury
4. Cron jobs run credit-free on Convex infrastructure
5. GitHub Actions handle CI/CD (build, deploy, health checks)

## Systems

### Authentication
- Passwordless email-based (userAuth.ts)
- User profiles with admin access levels
- Admin users with role-based permissions

### Campaign Management
- Monitored campaigns (external sync)
- User campaigns (direct creation)
- AI Campaign Wizard (6-step generation)
- Campaign editor, updates, following, saving

### Payment Processing
- PayPal checkout + webhook
- Stripe checkout + webhook
- CashApp integration
- Treasury: holding accounts, payout requests, fee config
- Fund consolidation (auto every 6 hours)

### Protocol Enforcement
- P-1 through P-8 standards
- Daily auto-fix at 6am PT (credit-free cron)
- Weekly training on Saturday 2am PT
- Protocol reports stored persistently

### Agent System
- 7 agents with per-agent automation toggles
- Agent onboarding, memory updates, automation cycles
- Agent activity logging
- Browser-based research (Browserbase integration)

### Treasury & Finance
- Holding accounts with gross/net balance
- Payout requests with withdrawal methods
- Fee configuration
- Financial audit log
- Consolidation runs
- Campaign ledger

### External Platforms
- 11 external platforms connected
- Facebook groups (63 groups, anti-spam guardrails)
- Platform dashboard for monitoring
- Fund migration from external platforms

### AI Systems
- Campaign generation (title, summary, story, FAQ, social captions, press releases, SEO)
- Cover image generation via Pollinations.ai (free)
- Outreach strategy improvement
- Post content auto-generation

## Dependencies
- Convex (backend, real-time, cron jobs)
- React 18 + Vite (frontend)
- Capacitor 6 (mobile: Android, iOS)
- Stripe (payment processing)
- PayPal (payment processing)
- Resend (email delivery — needs API key)
- Browserbase (browser automation for agent research)
- Pollinations.ai (free image generation)
- globe.gl (3D globe visualization)
- three.js (3D graphics)
