# Interplanetary Fund

Credit-free fundraising platform with AI agent coordination, protocol enforcement, and treasury management.

## Quick Start

```bash
npm install
cp .env.example .env.local  # Set VITE_CONVEX_URL
npm run dev                  # Start frontend + Convex
```

## Architecture

- **Frontend**: React + Vite + Tailwind (mobile-first, Galaxy A16 optimized)
- **Backend**: Convex (serverless, real-time WebSocket, credit-free)
- **Mobile**: Capacitor wrapper for Android APK & iOS
- **Hosting**: Vercel (web), Base44 (APK production)
- **Source**: This GitHub repository is the single source of truth

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system diagram.

## Connections

| Service | Purpose | Connected Via |
|---------|---------|---------------|
| GitHub | Source code + Copilot | This repo |
| Vercel | Web hosting | Auto-deploy from GitHub main branch |
| Convex | Backend + database | `VITE_CONVEX_URL` env var |
| Base44 | APK production | Backend function syncs Convex → Base44 entities |
| Copilot | AI code assistant | `.github/copilot-instructions.md` |

## Build Commands

```bash
# Web development
npm run dev          # Local dev server + Convex
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Convex backend
npx convex dev       # Run backend locally
npx convex deploy    # Deploy backend to cloud

# Mobile app
npm run cap:sync     # Build web + sync to native
npm run cap:android  # Open Android Studio
npm run cap:ios      # Open Xcode (macOS)
npm run mobile:build:apk  # Build debug APK from command line
```

See [MOBILE_BUILD.md](./MOBILE_BUILD.md) for full mobile build instructions.

## Environment Variables

```bash
# .env.local (development)
VITE_CONVEX_URL=https://rosy-butterfly-2.convex.cloud

# Vercel (production) — set in dashboard or CLI
VITE_CONVEX_URL=https://rosy-butterfly-2.convex.cloud

# GitHub Actions (CI/CD) — set as repository secrets
VITE_CONVEX_URL=<your-convex-url>
CONVEX_DEPLOY_KEY=<your-convex-deploy-key>
```

## Convex Backend

8 tables, 7 agents, protocol enforcement (P-1 through P-8), treasury management, and scheduled crons.

| File | Description |
|------|-------------|
| `convex/schema.ts` | Database schema (8 tables) |
| `convex/agents.ts` | Agent CRUD, stats, training |
| `convex/campaigns.ts` | Campaign sync, platforms |
| `convex/treasury.ts` | Fees, payouts, balances |
| `convex/protocol.ts` | P-1 through P-8 enforcement |
| `convex/crons.ts` | Daily audit + weekly training |
| `convex/seed.ts` | Initial data seeding |

## Base44 Sync

`base44-sync/syncConvexData.ts` — Backend function deployed on Base44 that syncs Convex data into Base44 entities. This allows the Base44-built APK to display live Convex data.

Actions:
- `sync_agents` — Sync 7 agents to Base44 Agent entity
- `sync_campaigns` — Sync campaigns to Base44 MonitoredCampaign entity
- `sync_treasury` — Fetch treasury balances and agent stats
- `full_sync` — Sync everything at once

## License

MIT
