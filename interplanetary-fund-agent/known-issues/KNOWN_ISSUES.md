# Interplanetary Fund — Known Issues
**Version:** 1.0.0

## Critical
1. *Email delivery not functional* — Resend API key required for outbound donor emails
2. *React state management issue* — Registration form requires direct JS injection to work (bypassed in testing)

## Moderate
3. *Stripe webhook full flow* — Webhook verified but complete donation → treasury flow needs end-to-end testing
4. *Campaign comparison edge cases* — Basic comparison works but untested with edge cases
5. *Notification delivery* — System exists but delivery pipeline untested
6. *Mobile APK not published* — APK builds via GitHub Actions but not published to Play Store

## Low
7. *Gmail monitoring workflow* — Backend function written but not deployed as workflow
8. *Session-based browser testing* — Browserbase sessions time out; need persistent sessions for long flows
9. *GitHub Pages SPA routing* — 404.html fallback added but may not cover all edge cases

## Resolved
10. *5848 TypeScript errors* — FIXED (2026-08-07, reduced to 0)
11. *Auto-Continue workflow consuming credits* — ARCHIVED (2026-08-07)
12. *iFUND_admin enterprise access* — RESOLVED (migrated to interplanetarysister personal account)
13. *Missing GitHub Actions workflow files* — RESOLVED (PAT upgraded with workflow scope)
14. *SPA routing on GitHub Pages* — RESOLVED (404.html fallback added)
15. *Missing fundforge hooks* — RESOLVED (useComparison, useCountUp, useDebounce, useSavedCampaigns ported)

## Limitations
- Convex free tier limits (may need upgrade for scale)
- Browserbase session time limits
- No paid services used (all free tier)
- GitHub PAT has workflow scope but may need renewal
