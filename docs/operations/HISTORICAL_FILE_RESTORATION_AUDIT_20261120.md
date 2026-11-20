# Historical file-preservation audit and targeted restorations — 2026-11-20

## Scope and method

Source: canonical `interplanetarysister/InterplanetaryFund`, GitHub first-parent/merged ancestry, current `main` tree, historical snapshots from Aug 29, Oct 29, Nov 1, Nov 5 and Nov 13, 2026, sampled cleanup/retirement commits and active imports/routes. Compare historical Git blob paths to current tree and check the separate consumer before restoring. **A missing historical path is a lead, not proof of an accidental deletion.** Current release/runtime status must not be inferred from a restored historical document.

Results: the Nov 13 snapshot contained 577 blobs, all still found on the then-current main tree. The older Nov 5 snapshot exposed 20 absent paths, primarily original agent pages, browser tests, consent code and release evidence. Older Oct/Nov snapshots also exposed unique migration parity records and retired architectures.

## Original paths restored

1. **Nine migration evidence artifacts:** `docs/migration/BACKEND_REPAIR_AUDIT_2026-10-29.md`, `docs/migration/BUILD_PREPARATION_2026-10-29.md`, all six `docs/migration/contracts/*.json` plus `docs/migration/role-platform-evidence.json`. Recovered immutable historical inventory: 184 original functions, 95 entities, 17 workflows and 59 route evidence records. These are dated **historical records**, not today's runtime certification.
2. **Six original agent references:** `docs/agents/ASSETS_TOOLS_AND_COMPLETION.md`, `COMMUNICATIONS_PREVIEW.md`, `GROWTH_PREVIEW.md`, `PRODUCTION_RELEASE.md`, `STRATEGY_PREVIEW.md` and `docs/BASE44_UI_PARITY_IMPLEMENTATION.md`. Historical provider/release statements are archival evidence and may be superseded by current production.
3. **Six browser QA files:** `tests/browser/{communications-preview,growth-preview,strategy-preview,run-communications-preview,run-growth-preview,run-strategy-preview}.py`. Their unique historic sandbox flows are preserved at their original locations; do not claim they exercise current providers without revalidation.
4. **Three strategically located builder contracts:** `.github/copilot-instructions.md`, `BUILD_AGENT_RULES.md` and `PRODUCT_SYSTEM_CONTRACT.md`, restored at original discovery paths with **current Cloudflare/Supabase architecture**, not stale Convex/Vercel endpoints.
5. **Three supporter-update preference source files:** `apps/web/src/components/CommunicationPreferences.jsx`, `apps/web/src/lib/communicationPreferences.js`, and `apps/web/tests/communication-preferences.test.js`. Unlike optional marketing, the distinct `comm_prefs` owner opt-out is still covered by the migration `20261103192435_ifund_communications_preferences_20261103.sql`. The restored UI is linked from `ManagePermissions.jsx` as a separate tab.

These are **27 restored files** plus the new permissions-page wiring and audit/regression documentation. The targeted additive database repair `20261120123320_ifund_restore_owner_communication_preference_update_grant_20261120.sql` was **applied to Supabase production `ssibsfmtodgximseeqsv`** after checking restrictive verified-email, owner and active-account RLS guards. Read-back confirmed authenticated column UPDATE = true, anonymous UPDATE = false, broad table UPDATE = false. No existing user preference values were changed; no provider payment or external publication occurred. A legitimate signed-in owner's browser save and cross-account denial remain **NOT TESTED**.

## Removed paths not blindly restored

- The former `apps/web/src/pages/{CommunicationsAgent,GrowthAgent,StrategyAgent}.jsx` and three `apps/web/functions/api/agents/.../[[path]].js` represent older direct worker surfaces. Current source uses `CommunicationsWorkspace`, `SpecialistServiceWorkspace`, `worker/agents/*` and canonical routing. Restoring the old routes could create parallel agent interfaces or service binding bypasses. Preserve their historical Git blobs until independently reconciled; do not activate two competing implementations.
- The five removed historical `src/pages` root UI routes and `src/navigation.css` belong to the older parallel frontend. Current `src/App.jsx` does not import these removed modules; `apps/web` owns the canonical routing. Reintroduction is **not authorized by name similarity**.
- October legacy `worker/automation*`, `d1/`, retired migration SQL and `wrangler.automations.jsonc` require separate semantic comparison with the current Cloudflare/Supabase workflow system before any return to active code.
- August `convex/`, Vercel deploy files, historical Base44 `.agents/platform-docs` and old `interplanetary-fund-backend` specifications refer to intentionally retired infrastructure. Never restore them as active runtime dependencies. Important distinct historical records can be preserved with a separate verified archive decision.
- The removed event migration `20261118190000_ifund_fundraising_events_and_external_activity.sql` had an explicitly applied-version replacement; restore only after verifying divergent schema evidence, not because a filename disappeared.

## Verification limits and follow-up classification

The snapshots and selected removals above do **not** prove every historical commit and file was exhaustively classified. Missing paths in the old retired stack are retained in Git history, not individually declared safe to activate. This audit restores the files with **verified distinct documentation, test, builder-discovery or preference purposes**, and explicitly isolates historical-only code needing further review. Database metadata, column grants and RLS restriction are now verified; a successful build or SQL grant still does not prove a signed-in owner's browser can persist opt-outs. Verify authorized owner, unauthenticated and cross-owner acceptance before calling that end-user flow complete.

The retention policy in `AGENTS.md` is binding: never delete a perceived duplicate until its unique consumers, dependencies, placement and safety are verified. See `docs/operations/IFUND_STANDING_OWNER_RULES_20261120.md` for the owner-wide numbered prompt.
