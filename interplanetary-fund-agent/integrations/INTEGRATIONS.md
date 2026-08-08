# Interplanetary Fund — External Integrations
**Version:** 1.0.0

## Connected Services
1. *Convex* — Backend platform (rosy-butterfly-2.convex.cloud)
2. *Vercel* — Frontend hosting (interplanetary-fund.vercel.app)
3. *GitHub Pages* — Fallback frontend hosting
4. *Stripe* — Payment processing (live, webhook verified)
5. *PayPal* — Payment processing (live)
6. *CashApp* — Peer-to-peer payments (per-campaign $cashtag)
7. *Resend* — Email delivery (configured, needs API key for outbound)
8. *Browserbase* — Browser automation for agent research
9. *Pollinations.ai* — Free AI image generation
10. *Facebook* — Social media outreach (63 groups)
11. *GitHub Actions* — CI/CD (4 workflows: APK build, Convex deploy, Pages deploy, health check)

## OAuth Connections (Base44)
- Gmail — Email monitoring (interplanetarysister@gmail.com, cuddlemeplatonically@gmail.com)
- WhatsApp — Messaging channel (connected)

## External Platforms (11)
- Platform connections stored in externalPlatforms table
- Each records: platform name, campaign URL, sync method, raised/donor counts
- Platform dashboard at src/pages/PlatformDashboard.tsx

## Facebook Groups (63)
- Managed via convex/facebook.ts
- Anti-spam guardrails enforced (convex/antiSpam.ts)
- Posts tracked in facebookGroupPosts table
- Distributed posts tracked in distributedPosts table

## Email System
- convex/emailSystem.ts — Email sending via Resend
- convex/emailCapture.ts — Email subscriber capture
- emailSubscribers table — Subscriber list
- STATUS: Needs Resend API key for outbound email delivery
