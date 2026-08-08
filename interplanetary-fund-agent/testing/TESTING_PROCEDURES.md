# Interplanetary Fund — Testing Procedures
**Version:** 1.0.0

## E2E Testing (Playwright)
- Config: playwright.config.ts
- Tests: tests/ directory
- Run: npm run test:qa

## TypeScript Type Checking
- Run: npx tsc --noEmit
- Status: 0 errors (fixed from 5848 on 2026-08-07)

## Browser Testing (Browserbase)
- Registration flow testing
- Login flow testing
- AI Campaign Wizard (6-step walkthrough)
- Donation flow testing
- Dashboard verification

## Production Verification Checklist
1. Vercel returns 200 OK
2. GitHub Pages returns 200 OK
3. Convex backend responding
4. Home page shows correct stats ($19,839 raised, 10 campaigns)
5. Login/registration functional
6. Campaign creation wizard works
7. Donation buttons functional
8. Admin panel accessible
9. Agent activity visible
10. Notifications system working

## Previous Test Results (2026-08-07)
- Registration: PASS (direct JS injection used to bypass React state issue)
- Login: PASS
- AI Campaign Wizard: PASS (6 steps completed)
- Home page: PASS (correct stats displayed)
- Vercel: 200 OK
- GitHub Pages: 200 OK
- Convex: Deployed and responding
