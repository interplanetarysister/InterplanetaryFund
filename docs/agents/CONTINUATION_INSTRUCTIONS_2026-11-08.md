# IFund agent build continuation — 2026-11-08

## Owner direction

Continue the existing sequential agent build end to end. Preserve prior work and repair existing open PRs before creating new PRs. Do not restart or replace the implementation. This handoff is the continuation authority for the remaining work on PR #223 and the next sequential agents.

The canonical product is Interplanetary Fund. The Base44 repository is a read-only behavioral/source reference, not a runtime dependency. Keep the implementation on the existing Supabase + Cloudflare architecture and the existing preview branch/PR stack.

## Current verified state

- PR #211 Strategy, #213 Growth, #220 Communications, and #223 Managed Connections are open draft PRs in a stacked branch chain. Do not merge out of order or silently retarget/rebase away prior work.
- Story has a production drafting path. Strategy, Growth, Communications and Managed Connections have preview implementations of differing completeness.
- Managed Connections currently provides provider catalog/method guidance and explicit, scoped owner-permission/request tracking. It does **not** yet provide a complete conversational specialist, verified provider adapters, OAuth/token lifecycle, browser execution, or provider-backed account actions.
- The shared workforce control was last observed with preview enabled, production disabled, 8,000 daily units, 1,000-unit critical reserve, two requests/day, and a free-plan verification expiry of 2026-11-11. Re-read the live control and current registration before every inference. Never assume those values remain current.
- At the last live audit only Story had a tested/registered workforce implementation. Managed Connections was not registered as an executable specialist.
- Do not use the legacy `ifund_stage` capability table as the canonical provider registry. It was empty in the last audit.
- The last observed Managed Connections Worker had no AI binding and no workforce executor-key binding.
- The production workforce switch was disabled. Preserve that hard stop.

## Required implementation sequence

### A. Finish the shared execution contract before adding more agents

1. Read the current workforce migrations, runtime, worker bindings, deployment configuration, and tests from the actual branch head. Reconcile against the latest merged main and all stacked PR parents before editing.
2. Generalize the existing Story reservation/lease/receipt lifecycle into a role-scoped contract without creating a second queue, bypassing the existing quota, or weakening Story behavior.
3. Every reservation must be bound to: authenticated member, role/position, environment, registered implementation revision, exact capability contract, bounded input/output, idempotency key, quota reservation, and immutable result/receipt.
4. Revalidate owner scope, service eligibility, consent, capability, implementation revision, and current quota in the database at reservation and completion. Reject stale leases, replayed/mutated inputs, foreign owners, wrong environment, and unregistered roles.
5. Maintain one shared budget and its critical reserve. Do not make test/smoke calls until the free plan and remaining budget are freshly verified. Do not make paid fallback calls.
6. Keep production disabled. No code path, admin UI, workflow, or model output may enable production procurement.

### B. Complete Managed Connections as a real specialist

1. Add a supervised conversation endpoint using the shared workforce reservation/lease/receipt contract. It must authenticate the member, verify current plan/role eligibility, load only that member's scoped connection/campaign context, and return clear, user-facing messages.
2. Add only tools declared by the Managed Connections source manifest and registered in the tested tool registry. Every tool must have strict input schema, effect classification, role allowlist, current authorization check, bounded output, redaction, and verified receipt for writes.
3. The model may propose a provider step or ask the member to complete one. It must never grant its own permission, mint approvals, invent provider status, claim a connection succeeded, read credentials, or trigger a provider mutation without a fresh member-scoped grant and the exact protected approval required for that action.
4. Keep provider actions disabled until the specific provider registration, OAuth/client configuration, capability, callback validation, token vault, refresh/revocation lifecycle, and provider-side receipt are verified. A catalog entry or public URL is not an adapter.
5. Credential handling: secrets remain server-side in approved secret storage; never expose tokens to the model, browser, logs, receipts, or client payloads. No secrets in GitHub. Use state/nonce/PKCE and strict redirect allowlists where OAuth is supported. Reject unverified callbacks and replay.
6. Implement resumable owner steps with explicit pending/complete/failed states, expiry, retry limits, and immutable receipts. A saved request or timestamp must never be represented as live provider access.
7. Preserve existing permission policy: owner-consented, provider- and campaign-scoped, time-limited, revocable, and least privilege. Financial authority and publishing remain separate and disabled.
8. Add a canonical provider registration/capability store only after reviewing existing schema and RLS. Do not reuse staging tables. Require RLS, least-privilege grants, authenticated invoker APIs, migration tests, and no direct private-table browser grants.

### C. Provider adapters and verification

For each provider, implement and test one capability at a time. A provider is unavailable until a real registration and capability receipt pass. Tests must cover successful consent, denied consent, callback forgery, state/nonce mismatch, expired/revoked grant, token rotation/revocation, wrong account, wrong campaign, duplicate request, retry, provider outage, rate limit, and truthful UI status. No synthetic result may be reported as a real provider connection.

### D. Advance the remaining agents in the existing ledger order

Only after Managed Connections passes its own complete acceptance gates, advance the sequential ledger to:
1. Connection Discovery
2. Outreach
3. Finance
4. Chief of Staff
5. Admin Builder

For each role, migrate source behavior and declared tools, scoped memory/skills, member conversation, UI, workflow triggers/timezones, persistence, receipts, and handoffs. Implement real functionality, not agent-name placeholders or documentation-only status. Finance must be read-only until independently approved; Admin Builder must remain behind verified admin authorization and protected owner review.

### E. Shared experience and Story parity

After the role implementations, finish the shared member conversation with clear specialist identity/icons and transparent handoffs. Restore historical scoped memory/skills with provenance and deletion controls. Finish Story campaign-cover generation/storage using verified campaign facts, IFund visual style and owner review; do not claim generation succeeded unless the asset is stored and retrievable. Preserve the existing campaign creation and publishing authorization boundaries.

## Mandatory completion gates

- Run the full existing test suite plus new unit, integration, SQL/RLS, Worker, browser, and end-to-end tests. Report exact commands, test counts, and failures.
- Build the web application and validate mobile layouts/routes.
- Test preview deployments with real consenting test members only; never use disposable accounts for permanent agent access. The permanent IFund agent-access identity is `interplanetaryfund@gmail.com`, with least-privilege service access; do not share a human password among agents.
- Verify all expected worker bindings, health endpoints, authenticated routes, database RPC permissions, RLS, quota enforcement, error redaction, and idempotency.
- Validate that no unsupported/paid inference provider, paid API, new subscription, or credit-consuming resource was introduced. The $0 / free-plan constraint is binding unless the owner explicitly approves a cost.
- Update `docs/agents/sequential-build-ledger.json` with evidence-backed status only. Include commit SHA, migration version, preview URL, tested capabilities, test evidence, and remaining gates. Never mark an agent complete because its docs or Worker exists.
- Preserve open PR work and repair the current stack before opening another PR. Keep PRs draft until acceptance is genuinely complete.
- Production promotion, payments/financial execution, provider writes, DNS/mail changes, and live member delivery remain separate gated operations. Do not enable them as part of preview implementation.

## Work reporting and handoff

Work continuously across multiple related tasks; do not stop after each small success. Commit implementation and tests to the existing appropriate branch. Before handing off, leave a concise evidence-based summary: changed files, commit SHA, tests/build results, preview deployment and URL, live checks performed, and blockers. If a task cannot be safely implemented with the available runtime, state the exact missing prerequisite rather than claiming completion.

## Immediate next task

Start with A: inspect and generalize the current shared Story workforce reservation/lease/receipt contract, including its SQL/RLS and Worker tests. Then implement B on the existing Managed Connections PR branch. Do not advance the ledger to Discovery until Managed Connections has passed all gates above.

---

## Continuation checkpoint — 2026-11-08 (latest reviewed branch head)

Current branch head at checkpoint: 66971459b9c12c9ff72e2f267f1653eb60bfff8c (PR #223 remains draft, stacked on PR #220).

### Additional code repairs committed

- Campaign editor: preserve the database row revision when loading and saving an existing draft; pass the expected revision on updates; refresh the revision after successful publish/pause transitions. This prevents an old tab from silently overwriting a newer edit and avoids the editor rejecting its own next save after a status transition.
- Story section regeneration: align the browser, Worker input, model output schema and workforce SQL contract at 4,000 characters. Earlier 6,000-character frontend/Worker bounds were incompatible with the SQL reservation function's 4,000-character check. Oversized sections now show a clear limit and cannot be regenerated until shortened.
- Account/profile writes: live ifund_profiles grants are column-scoped. Authenticated users may update handle and display_name, but may not update id. The previous browser upserts and Worker upsert included id in the conflict update, which can fail against the actual grants. Onboarding, Profile and the Worker account route now issue owner-filtered updates containing only editable columns and verify the returned owner row.
- Profile display-name UI now uses the same 80-character limit as the Worker account API.
- Authentication fixtures for account, community, campaign, reads and studio Worker tests now model confirmed email accounts, matching the production guard.
- Added regression/source-contract tests for draft revision handling, profile column-scoped writes, and Story size parity.

### Existing preview build evidence and repair

The Pages deployment for commit ad7fbd30f0ba721be0239285ea509f93865a900e ran npm ci --no-audit --no-fund && npm test && npm run build. Its test run reported one failure: draft links reopen and update the owned draft in apps/web/tests/draft-editing.test.js, because the source assertion still expected the old one-line saveOwnerCampaign call after the editor had been changed to a multi-line revision-aware request. The test was updated to assert the new status and revision contract. The log stream was truncated before a final test/build summary, so do not claim a full pass from that deployment.

### Still not complete / must not be represented as complete

1. The shared workforce SQL reservation path is still Story-specific. It must be generalized through a properly generated/reviewed migration; do not patch the live schema ad hoc or bypass the Supabase migration workflow.
2. Managed Connections remains an owner-consented request-tracking preview. No verified conversational AI implementation, tested workforce registration, provider OAuth adapters, credential vault lifecycle or provider-backed account actions have been completed.
3. Campaign draft suggestions currently come from the active Supabase Edge Function's deterministic grounded_offline_fallback response (ai_inference: false). Do not describe those suggestions as AI-generated. Real inference must use the approved shared workforce path and freshly verified free quota; no metered fallback.
4. Campaign image output is still a prompt only; image_rendered is false. Actual image generation, storage, IFund watermark and owner review remain incomplete.
5. The canonical member My Blog flow, public profile visitor/privacy experience, searchable community directory and community detail route still require schema- and RLS-correct implementation. Preserve the separate official Reporter publication.
6. Onboarding/profile setup must continue to be verified against the live profile row, owner-scoped RLS and column grants. Do not reintroduce profile upserts that attempt to update protected columns.
7. No test/build pass for the latest head is recorded in this checkpoint. Check the newest Pages deployment and resolve every failure before calling this slice accepted.

### Next actions

- Continue the source-level bug audit before intentionally starting another test cycle. Inspect all remaining direct Supabase writes against live table/column grants and RLS; compare every browser/Worker field bound to live schema constraints.
- Retrieve the newest Pages deployment logs for the current branch head, fix any failures, then run the full suite/build through the existing preview pipeline.
- Reconcile PR #223's branch ancestry and required PR #165 checkpoint without dropping any existing implementation.
- Generalize workforce runtime and SQL only through a CLI-generated migration with RLS/grant review, then register Managed Connections under the same shared quota.
- After Managed Connections passes its gates, advance the ledger to Discovery. Continue with Outreach, Finance, Chief of Staff and protected Admin Builder in the prescribed order.
- Keep production procurement disabled and do not merge/promote this draft stack.
