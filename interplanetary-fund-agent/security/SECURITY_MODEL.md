# Interplanetary Fund — Security Model
**Version:** 1.0.0

## Authentication
- Passwordless email-based auth (userAuth.ts)
- User profiles with admin access levels
- Admin users with role-based permissions (adminUsers table)
- Admin PIN required for sensitive operations (requestorPin)

## Authorization
- Campaign ownership enforced in all mutations (userId check)
- Admin access levels: super admin, campaigns, finance, platforms, reports, users
- Per-agent permission scopes
- Per-agent restricted actions list

## Fraud Prevention
- Fraud control system (convex/fraudControl.ts)
- Campaign freeze system for unverified ownership
- Spam blocklist (spamBlocklist table)
- Anti-spam guardrails for Facebook outreach (convex/antiSpam.ts)
- Ownership proof system (ownershipProofStatus, frozen, frozenReason fields)

## Financial Security
- Secure withdrawal with admin PIN (secureWithdraw.ts)
- Holding account system with gross/net tracking
- Financial audit log for all financial events
- Campaign ledger for per-campaign financial movements

## Data Protection
- Row-level security: users only see their own campaigns
- Admins see all records regardless of RLS
- Secrets never exported in portable context packages
- Credentials referenced, not stored in knowledge base

## Portable Security Rules
1. Never export passwords, private keys, API secrets, OAuth refresh tokens, payment credentials
2. Each runtime must use its own secure secret storage
3. Require authentication for context retrieval, code modification, deployment, payment operations
4. Different agents receive different amounts of context based on role
5. No external agent permanently acquires authority from a single interaction
6. Support permission revocation, agent deactivation, credential revocation, runtime revocation, emergency shutdown
