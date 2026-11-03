# Base44 UI and navigation parity — authoritative implementation contract

Source of truth: `interplanetarysister/interplanetary-fund2` at `src/App.jsx`, `src/components/Layout.jsx`, `src/components/MobileBottomNav.jsx`, and the original pages and components. Destination: this repository's React/Vite frontend, deployed to Cloudflare Pages with Supabase/Cloudflare services. Do not import the Base44 runtime or resurrect Convex/Vercel.

## Route reconciliation
Audit and implement all original routes, not just top-level navigation. Original routes observed:
Public: /, /login, /register, /forgot-password, /reset-password, /globe, /embed/campaign/:id, /oauth/consent, /activate, /about, /founding-members, /terms, /privacy, /contact, /discover, /campaign/:id, /community, /community/:id, /u/:id, /social, /blogs, /blogs/:id, /publications/:id, /help, /help/:slug.
Authenticated: /onboarding, /dashboard, /create, /giving, /communications, /mission, /ai-images, /institutions, /institutions/:id, /profile, /my-blog, /devices, /connections, /inbox, /following, /notifications, /donors, /ledger, /subscriptions, /withdrawals, /agents.
Admin: /ops, /platform, /analytics, /connect, /admin/external-accounts, /admin/integrations, /admin/audit, /admin/agent-api, /admin/sustainability, /admin/help, /admin/founding-members, /admin/organization-mail.

## Navigation and design
Recreate original public and authenticated navigation sections (Explore, Campaigns & Giving, Community, AI Tools, Account & Help, Administration), original labels, mobile bottom navigation, sidebar/drawer, page titles, safe areas, swipe/back navigation, scrolling, light/dark preferences, loading and error states, and responsive layouts. Preserve protected routes, admin authorization, owner-only financial views, and subscription gating; do not make inaccessible routes appear functional through placeholders.

## Page-by-page implementation
For each original route compare component structure, layout, text, links, states, forms, media, actions, responsive behavior, accessibility, API dependencies, and loading/error paths against destination. Implement missing UI and adapt backend calls to Supabase/Cloudflare. Record each route as parity complete, partial, blocked (with concrete dependency), or not started. Never claim a page complete because it merely renders.

## Acceptance
Use the original APK as visual/behavioral reference, plus the original repository. Verify build, navigation on mobile and desktop, authentication, admin restrictions, campaigns, AI tools, inbox, giving, ledger, integrations, and all links. No real payments, account connection writes, or production publishing during tests without appropriate authorization. Keep Base44 operational until replacement passes. Work through draft PRs and reviews before production deployment.

This document is an implementation contract and checklist seed, NOT evidence of completed parity.
