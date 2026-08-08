# Interplanetary Fund — Requirements
**Version:** 1.0.0

## Functional Requirements
1. Users can register and login with email (passwordless)
2. Users can create campaigns via AI wizard or manual editor
3. Campaigns support donations via PayPal, Stripe, and CashApp
4. Campaigns must comply with Protocol P-1 through P-8
5. Admin panel for platform management
6. External platform sync (11 platforms)
7. Facebook group outreach (63 groups)
8. AI content generation (FAQ, social, press, SEO, donor thank-yous)
9. Treasury management with holding accounts and payouts
10. Agent automation (7 agents, per-agent toggles)
11. Notifications system
12. Community features (groups, discussions, volunteer)
13. Help center with support tickets
14. Mobile app (Android, iOS via Capacitor)
15. 3D globe visualization

## Non-Functional Requirements
1. Credit-free recurring operations (no Base44 credits for automation)
2. Real-time updates (Convex WebSocket)
3. Type safety (TypeScript, 0 errors)
4. Mobile responsive
5. SPA with fallback routing
6. SEO optimization on campaign pages

## Security Requirements
1. Campaign ownership enforcement
2. Admin role-based access control
3. Admin PIN for sensitive operations
4. Fraud detection and campaign freeze
5. Anti-spam for outreach
6. Financial audit trail

## Financial Requirements
1. Gross/net balance tracking
2. Fee configuration
3. Fund consolidation every 6 hours
4. Campaign ledger
5. Payout request system
6. Provider transaction tracking

## AI Requirements
1. AI campaign generation (6-step wizard)
2. Free image generation (Pollinations.ai)
3. Auto post generation
4. Outreach strategy improvement
5. Agent research sprints

## Agent Requirements
1. 7 specialized agents with per-agent toggles
2. Agent onboarding and briefings
3. Agent memory (working + long-term)
4. Agent activity logging
5. Per-agent automation schedules
6. Credit-free agent operations

## Scalability Requirements
1. Convex auto-scaling backend
2. Vercel auto-deploy frontend
3. GitHub Actions CI/CD
4. Per-agent automation isolation
