# Member consent and followed campaigns migration — 2026-11-01

## Source of truth
- Production Supabase project: `ssibsfmtodgximseeqsv`; preserve all existing source-stage and financial records.
- Base44 source `interplanetary-fund2/main`: `base44/entities/FollowedCampaign.jsonc` blob `bf2f93902b087d6bce4fb0f4f03a541cb704ffbf`, FollowedCampaigns JSX blob `af5b631ab0d92580da9575d46cde92d8aba63a29`, and toggleCampaignFollow function blob `ca749e11e7fbb20e648867ffd37784437c5c5029`.
- Existing app reconciliation file: `supabase/migrations/pending/20261029_ifund_follow_notifications.sql` from branch `migration/build-completeness-gates-20261029`; adapted to the **already live** table and policy permissions.
- Terms and Privacy are source-aligned, version `2026-10-13-v3`.

## Implemented
- New table `public.ifund_follows` keyed by independent authenticated UUID and published independent campaign UUID; unique owner/campaign pair.
- Explicit RLS on all read/write operations, checking active account and consent. Insert requires an active campaign.
- Column-scoped update privileges, strict JSONB preference schema, immutable owner/campaign after insertion, no browser service key.
- Minimal missing legal-acceptance insert columns only; acceptance time/method/paths remain server-side.
- Independent following page and campaign heart, including duplicate-safe follow, verification, pin, archive and notification preferences.
- Member route gate checks active account lifecycle, versioned affirmative consent, and verifies insert before unlocking routes.

## Hold points
- No historical follows imported until old user ID and campaign ID match exact canonical owner and campaign mappings.
- This migration does **not** start sending follower notifications, email, outreach or payments.
- Account acceptance depends on the existing auth trigger correctly creating a usable profile and on the current legal version remaining approved.
- Database anonymous and cross-account deny scenarios must be executed before release. UI tests do not replace RLS.
- Once this migration is applied, record the exact returned Supabase migration version here and do not re-run the DDL blindly.
