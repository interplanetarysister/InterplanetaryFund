# Interplanetary Fund — Deployment Guide
**Version:** 1.0.0

## Environments
1. *Convex Cloud* — rosy-butterfly-2.convex.cloud (production)
2. *Vercel* — interplanetary-fund.vercel.app (primary frontend)
3. *GitHub Pages* — interplanetarysister.github.io/InterplanetaryFund/ (fallback)
4. *GitHub Actions* — CI/CD pipelines

## Deployment Flow
```
Push to main branch on GitHub
├── GitHub Action: convex-deploy.yml → Auto-deploys Convex backend
├── GitHub Action: deploy-pages.yml → Auto-deploys to GitHub Pages
├── GitHub Action: build-apk.yml → Builds Android APK (on src/ changes)
└── Vercel auto-deploy → Builds and deploys frontend
```

## Convex Deployment
```bash
npx convex dev --once    # Deploy functions to production
npx convex deploy        # Full production deploy
npx convex dashboard     # Open Convex dashboard
```

## Vercel Deployment
- Auto-deploys on push to main
- URL: https://interplanetary-fund.vercel.app
- VITE_CONVEX_URL environment variable set

## GitHub Pages
- Auto-deploys on push to main
- URL: https://interplanetarysister.github.io/InterplanetaryFund/
- 404.html fallback for SPA routing

## Mobile Build
```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```
- APK built via GitHub Actions on src/ changes
- Capacitor config in capacitor.config.ts

## Playwright Tests
```bash
npm run test:qa       # Run QA tests
npm run test:qa:ui    # Interactive mode
npm run test:qa:report # View report
```

## GitHub Actions Workflows
1. build-apk.yml — Android APK build on src/ changes
2. convex-deploy.yml — Convex auto-deploy on push
3. deploy-pages.yml — GitHub Pages deploy on push
4. (site health check workflow)
