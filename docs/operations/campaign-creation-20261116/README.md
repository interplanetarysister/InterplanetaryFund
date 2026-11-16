# Campaign creation and agent feature repairs — November 16, 2026

The canonical creator now offers the current member agreement before a confirmed member's first account save while preserving guest drafting. A working title permits saving the first stage. Existing account drafts remain editable when browser storage is unavailable. Confirmed campaign receipts preserve pending setup across reload after a setup-write failure; recovery is owner/campaign scoped and does not authorize publishing. Private draft receipts open the owner editor rather than the active-only public campaign page. Editorial field actions reveal the relevant wizard stage before focusing it.

All nine product agent roles have real feature launchers. Agent-board deep links select the requested role, and supported destinations consume campaign IDs only after owner-scoped campaign records load. STORY, ECHO, PULSE and saved specialist panels receive appropriate context; aggregate finance/growth reports remain aggregate. DISCOVER's research feature is accessible while its deliberate LINK consolidation is preserved. Navigation does not activate unverified chat, provider grants, financial actions or external messaging.

## Applied database repair

The deployed campaign INSERT/UPDATE grants omitted four Atlas columns sent by every real campaign payload, including opt-out payloads. The CLI-created migration `20261116115043_ifund_campaign_atlas_write_grants.sql` was independently reviewed and applied to canonical project `ssibsfmtodgximseeqsv` as `ifund_campaign_atlas_write_grants`. It grants authenticated INSERT/UPDATE only on `map_opt_in`, `public_location_label`, `map_latitude`, `map_longitude`.

Live verification: all four permissions changed from false to true; anonymous INSERT remains false, owner_id UPDATE remains false, and id INSERT/UPDATE remain false. RLS remains enabled. Before/after policy hash remains `fe8b25d83e7bacd5896d3df3802f288b`; constraint hash remains `d48ee076b499dcaebdb83b400d291c4b`. No campaign/user records, financial data or provider configuration were changed. No unrelated pending migration was applied.

## Verification

- Full root/security suite: **899 passed, 0 failed**.
- Full web suite: **855 passed, 0 failed**; canonical production build passed.
- The new database regression reconstructs hosted restricted column grants and executes actual client payloads plus publication SQL: **11 passed**, including before-repair permission denial, owner insert/update/publish, cross-owner/anonymous/inactive/current-terms denials and unchanged constraints.
- Recovery/agent/wizard integration checks: **23 passed** after the final storage-getter safeguards.
- Actual browser creation flow at desktop and mobile: explicit current agreement, first-stage private save, four-stage progression, saved setup and explicit publication of the same campaign, with one INSERT and no page errors/overflow. The desktop test also injected a setup-write failure, reloaded the creator, recovered setup and retried without a duplicate campaign. Browser transport/auth was synthetic; this does not claim live user publication or provider acceptance.
- Existing connections/team-context/function-security checks: **13 passed**. A later live catalog recheck confirmed LINK and team-history tables/RPCs already exist, correcting an earlier audit inference. No redundant schema was applied.

## Release boundary

Production authorization is conditional on completed release QA. The global source manifest has 117 acceptance omissions after the concurrent Planetary Impact route addition; these are not 116 demonstrated product bugs. No ComingSoon or missing-navigation failures were found. Protected-role/provider runtime acceptance remains separate from anonymous route rendering and synthetic browser transport. The admin private-document review RPC remains absent and private document storage requires canonical R2 reconciliation; do not enable its legacy Storage adapter. GitHub-hosted jobs remain blocked by account billing. No preview/production deployment, actual publication, charge, payout, provider grant or message was performed by this repair. Automatic deployment controls remain disabled pending controlled release acceptance.

Final compiled artifact verification passed the desktop/mobile save/recovery/publish flow. Artifact index SHA-256: `1b873779d508c2ac047279a0c9a96691101e80bff8848d20b25ceb34b8c01fd2`. Combined web suite after concurrent main integration remained **855 passed, 0 failed**, and the build passed. No production promotion was performed while the release gate failed.
