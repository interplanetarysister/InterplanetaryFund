# iFund creator partial-save recovery and agent backend release checkpoint

Recorded: November 16, 2026. Canonical repository `interplanetarysister/InterplanetaryFund`; work source branch `feature/route-completion-20261113`. Base44 source and APK are unchanged.

## Implemented on the existing feature branch

- `apps/web/src/lib/campaignCreationRecovery.mjs`: exact verified-owner UUID-scoped, browser-session recovery pointer for a saved campaign whose private wizard state did not persist. Normalizes to the existing `campaignSetupPayload` schema. Rejects foreign, ambiguous, tampered, corrupt or unrecognized recovery, and refuses to overwrite a different unfinished campaign.
- `apps/web/src/pages/CreateCampaign.jsx`: writes the pending recovery record **after** confirmed owner campaign insert/update and **before** the separate `saveCampaignSetup` request; reopens `/create?draft=ID` rather than inserting another row after interruption. Clearing recovery happens after the server setup receipt; local cleanup is attempted independently for each scoped browser slot. A stale recovery for a campaign no longer in draft status is discarded. Private saved draft links do not lead to the active-only public campaign route.
- `AgentFeatureLauncher.jsx` routes a confirmed saved campaign to the verified `/agents`, `/strategy`, `/communications`, `/permissions` tools, without making unverified AI/autopost/payment claims. Story, ECHO and Strategy preselect supplied campaign context only after owner-campaign verification. ECHO clears the old draft on query/account changes.
- Editorial review field links in `PrepublicationGate.jsx` and `CampaignReadinessScore.jsx` now request the relevant wizard step through the parent editor before focusing title, goal, category, cover URL, summary or story. The cover area is keyboard focusable.
- `apps/web/tests/campaign-creation-recovery.test.mjs` covers scoped recovery, failed browser storage, tampering, partial-save ordering, private links, agent route existence and owner-scoped query selection. **11/11 adapted JavaScript tests passed** against code fetched from the current branch after fixing an initially malformed UUID pattern. These are synthetic source tests; not proof of full browser acceptance. The existing web test runner discovers this test; the manual no-deployment document QA workflow also includes it.

## Production Supabase changes actually applied

1. `supabase/migrations/20261113080000_ifund_member_connections_hub.sql` applied under migration name `ifund_member_connections_hub_20261113` after a successful transaction-rollback dry run. Verified presence of owner-controlled public-link, per-platform choice and connection assistance tables and RPCs required by LINK's saved Connections UI.
2. `supabase/migrations/20261115094500_ifund_shared_agent_team_events.sql` applied under migration name `ifund_shared_agent_team_events_20261115` after a successful rollback dry run. Verified the owner-only team-event table and read/write/correct/erase RPCs exist, RLS is enabled, and anonymous roles cannot execute the read RPC.
3. Verified restricted grants: anonymous has no raw link-table read or team history RPC execution; authenticated member can use owner-verifying RPCs only; untrusted browser messages cannot forge trusted agent replies without the existing workforce worker requirement.

**Important runtime limitation:** Applying the shared event schema does not prove deployed Worker conversation-capture logic. Cloudflare story worker settings showed Story and workforce enabled, but no `IFUND_TEAM_CONTEXT_ENABLED` binding, and live worker source was not verifiable. No flag was enabled or Worker redeployed; complete automatic team capture is **not yet live-verified**.

## Release gate and pending acceptance

- Latest route readiness manifest was 87 routes, 82 `not_verified` and five `source_ready`. The owner-established full-website source/readiness gate forbids preview and production builds until the blocked routes are resolved and end-to-end checks pass.
- Latest branch comparison showed the feature branch diverged from main (19 ahead, five behind at inspection). Other agents were committing concurrently; avoid wholesale main overwrite, forced push or unapproved Cloudflare production builds.
- GitHub-hosted runner minutes are unavailable for the remainder of November. The manual no-deploy QA workflow includes the recovery test, but a real `npm ci`, browser/Playwright and full suite were not run by this continuation. The uploaded Codex log's 21/21 test result applies only to that earlier local source state and is not a current browser acceptance certificate.
- The Cloudflare frontend has **not** been deployed with the new campaign recovery and field navigation. A production rollout needs current-main reconciliation, real build and browser acceptance, and the established release gates; do not represent source commits alone as a published feature.
