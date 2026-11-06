# IFund unified agents: implementation and midnight delivery plan

Owner direction: 2026-11-05, America/Los_Angeles. Deadline: **midnight at the end of November 5** (2026-11-06 00:00 PST / 08:00 UTC). Planning began at approximately 18:31 PST, leaving about five and a half hours. This document is an implementation plan, not evidence that its features exist.

## Outcome and priorities

Finish the remaining agents first, with actual skills, tested tools and working specialist handoffs included in each release. Build one simple chat workspace with designated specialist icons. Execute permitted actions when a member explicitly commands them. Preserve all seven outstanding workstreams: remaining agents; earlier-agent parity; images; workflows; authentication; real acceptance; release evidence.

The previous arrangement of separate agent chat windows is superseded. Existing campaign, communications and connection pages remain useful task workspaces. They must not require separate conversations or repeated briefing.

**Feasibility:** the repository currently has five bounded/scoped cores, five absent specialist implementations, no working unified conversation/tool/handoff executor, and all seventeen workflow entries marked pending. Full source parity plus unconfigured third-party integrations and real-member acceptance cannot be credibly guaranteed in five and a half hours. The schedule below is an aggressive execution order with checkpoints. A missed gate keeps its agent active and moves later work; it never becomes a fabricated completion. The deadline does not authorize paid services, skipping privacy checks, financial activation or production promotion.

### Fresh launch-state observation

Independent Auditor read the canonical Supabase project `ssibsfmtodgximseeqsv` at **2026-11-06 02:37:42.507 UTC / November 5 18:37:42 PST**. The read-only result recorded:

- Shared workforce preview execution **false** and production execution **false**. A historical enabled Cloudflare flag is not current backend execution permission.
- Maximum workforce requests per day **2**, daily unit limit **8,000**, critical reserve **1,000**, with free-plan attestation expiring `2026-11-11T05:56:47.391613+00:00`.
- Only `cloudflare_story_llama33_v1` registered as available/tested, assigned solely to Story and tested for `story.draft.v1` / `story.section.v1`; zero successful member runs and zero assignments.
- Zero canonical connection rows, zero writing-research rows marked `verified_sources`, and zero Supabase Storage buckets.

Therefore the foundation must reconcile and test a genuinely usable multi-role quota/activation policy within the verified free budget, register/evaluate the other implementations, install owner-scoped image storage, and obtain actual connection/source evidence. Never raise limits or bypass a disabled gate just to claim progress. If the verified free capacity is insufficient, queue work and report the capacity limitation. This observation does not imply that the separate manual Managed request-tracking preview is disabled.

## One conversation, specialist icons

Canonical destination: `/agents`. One transcript and composer for the selected account/campaign scope. The default coordinator can involve specialists automatically. A member can also select a named icon to work on a particular topic, without opening a new window or losing the current brief.

| Service | Designated Lucide icon | Short label | Work |
| --- | --- | --- | --- |
| Chief of Staff | `Compass` | Coordinate | Plan work and combine actual specialist results |
| Story | `Feather` | Story | Campaign wording, narrative and campaign images |
| Strategy | `Map` | Plan | Mission brief, priorities and recommendations |
| Growth | `TrendingUp` | Grow | Evidence-based analysis and experiments |
| Communications | `MessagesSquare` | Messages | Supporter messages, notifications and permitted mail |
| Managed Connections | `PlugZap` | Connect | Authorize, verify, repair and revoke integrations |
| Discovery | `Radar` | Find | Sourced opportunities and integration capabilities |
| Outreach | `Megaphone` | Outreach | Distribution, posts, applications and submissions |
| Finance | `Wallet` | Finance | Verified financial explanations and owner-only reports |
| Admin Builder | `Wrench` | Admin | Private incident/build coordination; verified administrators only |

Icons have visible labels, keyboard focus, accessible names, selected state and mobile touch targets. Admin is absent from an ordinary member's catalog. Admin transcript, memory and tool context remain in a separate verified-admin scope even when an administrator also has a member conversation. Selecting an icon changes focus within the conversation. Handoffs appear as small inline task cards with the assigned specialist, current status and actual result. Use plain statuses: Planning, Working, Needs your input, Done, Failed or Cancelled. No credentials, implementation logs or provider secrets appear in chat.

Account/campaign switching invalidates delayed reads and executions and loads only the new scope. Do not share another campaign's private facts or memory by default. Remembered preferences remain inspectable, correctable and erasable. An old preference cannot authorize a future post.

## Acting on a member's behalf

The source already distinguishes owner commands from model tools (`base44/functions/ownerAgentChatActions/entry.ts`). Implement that distinction in the canonical platform instead of making models approve their own work.

| Member instruction | Required behavior |
| --- | --- |
| "Let's plan an update" | Discuss, research and prepare; no publication |
| "Improve this draft" | Improve the draft; no publication |
| "Improve this and post it to my campaign" | Improve and post once to that owned campaign when the command is unambiguous and current platform rules permit it; no extra routine approval |
| "Post all my pending drafts" | Capture the eligible drafts, exact revisions and destinations at command time; post that bounded snapshot; later drafts do not join |
| "Submit this entry by email using my connected Gmail" | Verify the connection, send scope, destination, attachments and task authorization; submit through a supported transport and return the actual provider receipt |
| "Find opportunities" | Return sourced opportunities and eligibility/deadline uncertainty; searching does not authorize applications |

Add a protected owner-message endpoint and execution authorizations containing the authenticated actor, original owner-message reference/hash, conversation/campaign, action, destination, selected IDs/revisions or bounded composition instruction, limits, expiry and idempotency key. The backend derives identity and permissions; request fields and model output cannot supply authority.

For an existing draft, bind the exact saved content and revision. For an explicitly requested "write/improve and publish" task, bind the composition objective, campaign/destination, permitted content kinds and count; freeze the resulting final payload before writing. Execute exactly once and retain its actual result receipt. Discussion and delegated specialist text never become owner-originating commands.

Keep owner-only apply/approval operations outside model-callable tools. The trusted command executor can call canonical write helpers after verifying a protected command record. Recheck current identity, account state, legal acceptance, entitlement, ownership, destination membership, audience preferences and content state immediately before writing. All selections remain bounded, atomic where required and protected against stale state and duplicate execution.

A scoped unattended server executor is also required for scheduled work. Do not store member JWTs for later use or accept an arbitrary owner ID as execution authority; background tasks must recheck a durable owner/destination grant and its expiry.

The member's command should satisfy ordinary in-platform publication authorization. Request another input only for an ambiguous consequential scope or a genuinely missing requirement: provider permission, login/MFA, terms/attestation, unavailable transport or fee. Preserve resumable work and explain the specific missing step. Financial transfers, privileged administration and production deployment retain their existing separate rules.

Gmail authorization must belong to the IFund member connection and include the required scopes. Google sign-in, a provider logo, a saved connection row or the assistant's engineering Gmail connector is not equivalent. Gmail access does not authorize another website account or form submission. Protect OAuth state/PKCE, encrypted refresh tokens, refresh/revoke lifecycle, recipient/domain/attachment scope and uncertain-send reconciliation. Tokens and challenge answers never enter model context. External submission is complete only with a genuine provider/API/form result; required legal attestations remain owner steps.

## Shared implementation foundation

Reuse the existing Cloudflare service gateway, source role/skill manifest, tool registry, provider adapter interface and canonical Supabase workforce queue. The current workforce execution path is Story-specific; generalize its reservation/lease/completion contract for each supported service before claiming cross-specialist execution.

Cloudflare owns model/tool execution, streaming and orchestration. Supabase owns canonical conversations, scoped messages/memory, user commands, authorizations, delegations, leases and receipts. Add only reconciled private operational schema. Do not create a competing campaign, identity or financial store, or an independent second queue. Evaluate SDK transport against this contract; package installation alone is not an agent implementation.

Every handoff has a real child run, parent command/run reference, owner/campaign scope, target role, bounded objective/context, permitted tools, budget and cancellation/continuation state. Revalidate the destination's entitlement and permissions. Propagate only relevant verified facts and provenance; credentials and private unrelated campaign data stay out. Return actual child results and receipts to the same chat. A queue row or a specialist label is not proof that work ran.

Each role loads versioned skill instructions and tested native tool bindings. Skills include role guidance, platform rules, source-quality checks, tool-selection rules, action authority, error recovery, handoff protocol and result verification. Preserve unresolved legacy references separately. Install reviewed canonical replacements only where the native capability is actually implemented and tested; never label opaque IDs as installed skills.

Use one current free-capacity budget across roles, real reservation accounting and hard stops. No silent paid or trial fallback. A Codex Pro subscription is not provider API credit. Confirm live model/image/SDK availability before activation. The owner has confirmed free Cloudflare/Supabase plans; current specific limits still need verification when choosing runtime resources. The attempted Cloudflare documentation retrieval during planning did not succeed, so this plan asserts no new quota or price.

## Work windows through midnight

These are prioritized work windows, not guaranteed completion estimates. Builder implements one current agent at a time. Reviewer and Auditor inspect that same increment while independent environment/read-only checks proceed. The next specialist starts only after the current specialist's acceptance gate passes, or a specific external dependency is recorded and the owner changes the sequencing instruction.

| Pacific time, November 5 | Work | Exit evidence |
| --- | --- | --- |
| 18:45–19:35 | Shared chat, icons, owner-command authorization, scoped conversation/memory, general tool bindings and real handoff foundation | One owner command reaches a real specialist and completes a permitted canonical draft/post; discussion makes no write; cross-owner/replay tests pass |
| 19:35–21:45 | Complete remaining specialists sequentially: Managed Connections → Discovery → Outreach → Finance → Chief of Staff → private Admin Builder | Each has loaded skills, executable tools, real handoff results, negative tests and reviewed preview behavior; no form-only or manifest-only completion |
| 21:45–22:20 | Earlier-agent gaps and Story image pipeline | Existing four roles use shared runtime; IFund-style image generated from current campaign details, stored and returned for owner use/review under the command's scope |
| 22:20–23:10 | Seventeen workflow implementations and trigger/handler integration | Per-workflow trigger, eligibility, executor, retries, cancellation and receipt evidence; unsupported/provider-blocked paths remain explicit |
| 23:10–23:40 | Real signup/confirmation/recovery, two-owner/member acceptance and controlled provider round trips | Actual receipts with two consenting test identities and authorized test destinations; no invented identity/consent/provider state |
| 23:40–00:00 | Focused regressions, mobile/expiry/retry checks, preview deployments and final evidence | Exact commits, migrations, preview URLs, PASS/FAIL/NOT TESTED/BLOCKED ledger and rollback; production hold preserved |

Preflight external dependencies from the start rather than waiting until 23:10: OAuth app/redirects/scopes; free inference/image capacity; member Gmail connection; protected credential configuration; two authorized test identities and owner-submitted legal acceptance; source skill/history availability; provider policies and receipts. Fix independent code while an external step is pending. Never use an expiring approval or billing limit as proof of runtime success.

## Remaining-agent acceptance, one at a time

| Agent | Required implementation and skills | Completion evidence |
| --- | --- | --- |
| Managed Connections | Protected authorization/credential lifecycle, verified provider methods/capabilities, resumable owner steps; native connection/account/research tools; actual dispatch | Permission → provider-supported connect/repair → verified capability; revoke/expiry/cross-owner denial and resumed return; unavailable providers say setup is required |
| Discovery | Official-source research, integration/opportunity discovery, eligibility/deadline provenance, recipe validation, safe handoffs | Sourced result with current evidence/uncertainty; a real handoff to a permitted specialist; no claim that research grants account permission |
| Outreach | Per-destination posting modes, content improvement, scheduling, submissions and connected Gmail/provider adapters | A specific authorized task writes once to an allowed destination and returns a genuine result; no send on discussion; duplicate and revoked-scope checks |
| Finance | Canonical captured-ledger/clearing/withdrawal read models, currency-safe calculations and 7% fee-at-withdrawal policy; owner-only privacy | Verified source reconciliation and other-owner denial; no simulated capture, payout or unrestricted money tool |
| Chief of Staff | Shared brief, actual specialist dispatch, bounded plans/budgets, durable checkpoints and returned outcomes | Multi-specialist task with actual child results and resumable/cancelled states in the same chat |
| Admin Builder | Verified-admin-only incident/build tools, scoped runtime GitHub/CI integration, actual plan/code/test/preview evidence and protected release rules | Ordinary member cannot see/invoke it; authorized incident produces actual build/check results; production hold is enforced |

Earlier roles must also use this foundation: Story gets real image generation and canonical content tools; Strategy gets living brief/recommendation execution and sourced opportunities; Growth gets genuine time-window/outcome analysis without invented metrics; Communications gets owner-command delivery, recurring data when verified, and actual configured mail receipts.

## Workflow implementation matrix

For every row: implement a real trigger and handler, current eligibility/consent, a deduplication key, durable state, bounded retries/backoff, cancellation, traceable receipt and negative tests. A contract file or scheduled empty handler is not implementation. A delayed task is tested with controlled time plus verified durable scheduling; it is not falsely reported as having waited three real days.

Extend the existing Cloudflare workflow dispatcher against canonical `ifund_ops.workflow_jobs`. Register each source trigger exactly once and preserve unrelated existing handlers. If a native Cloudflare Workflow is selected for durable execution, bind its instance to the same canonical job/receipt; it does not become a second business queue. Verify its current Free-plan availability and limits before provisioning.

All schedule calculations use IANA source timezones, UTC due instants and durable event keys. Test DST gaps/folds, retries and scheduler overlap; do not silently replace a named weekly process's actual daily source trigger. Preserve full source conditions from the sequential ledger.

| Source workflow | Trigger / source timezone | Source handler | Runtime acceptance |
| --- | --- | --- | --- |
| AI Outreach Agent | `0 */6 * * *` / UTC | `runOutreachAgent` | Only eligible authorized destinations; real or explicit blocked result |
| Admin Action Conversation Router | `*/15 * * * *` / America/Los_Angeles | `processAdminActionInbox` | Answer pending request_more_information in the existing approval/action thread; verify privileged scope; do not create build tasks by default |
| Campaign Protocol | Campaign create,update; watched fields per canonical source definition | `enforceCampaignProtocol` | Current rules applied idempotently on the source watched fields; no unauthorized mutation |
| Campaign Sync on Create | Campaign create | `syncConnections` | One canonical campaign-create event → permitted scoped sync |
| Campaign Sync on Update | CampaignUpdate create | `syncConnections` | CampaignUpdate creation → scoped sync; deduplicate and prevent feed loops |
| Connection Sync Engine | `0 * * * *` / America/Los_Angeles | `syncConnections` | Current verified capability and consent; revoked connection stops work |
| External Feed Mirroring | `0 * * * *` / UTC | `mirrorExternalPosts` | Authorized source read, deduplication, attribution and canonical destination |
| Feature Discovery on Completion | Campaign update; status transition only | `discoverFeatures` | Only non-completed → completed transition; evidence-based capability research |
| Grant Application Review | GrantApplication create; status=submitted | `analyzeGrantApplication` | Internal submitted application → Strategy recommendation, under_review and institution-owner notice; no automatic award; distinct from external submissions |
| IFund Official Social Editor | `0 */4 * * *` / America/Los_Angeles | `runOfficialSocialPromotion` | Verified platform-account authority, permitted destination and real receipt |
| IFund Reporter Daily Diary | `30 17 * * *` / America/Los_Angeles | `runReporterDiary` | Designated official blog; verified factual content; at most one edition per date |
| Integration Health Check | `30 */6 * * *` / America/Los_Angeles | `validateIntegrationHealth` | Non-destructive real capability checks with expiry and safe errors |
| PayPal Holding Settlement Reconciliation | `0 * * * *` / America/Los_Angeles | `discoverPayPalHoldingSettlements` | Verified provider identity, unique matching and canonical idempotent ledger; financial activation gate retained |
| Platform Account Steward | `30 15 * * *` / America/Los_Angeles | `maintainPlatformOwnedAccounts` | Verified platform authority; protected setup/change approval where required |
| Social Media Autopilot | `0 14 * * *` / UTC | `runSocialAutopilot` | Per-destination auto/ask/draft/manual rules, rate limits and real result |
| Volunteer Welcome Follow-up | VolunteerSignup create | `welcomeVolunteer`, `wait:P3D`, `volunteerFollowUp` | Consent-aware welcome, durable three-day continuation, opt-out/cancellation and deduplication; no claim of three actual days tonight |
| Weekly Writing Psychology & Social Trends Training | `0 16 * * *` / UTC | `refreshWritingResearch` | Preserve daily trigger and week-level deduplication; real citations, review/provenance and no authority expansion |

## Authentication, images and final gates

Authentication: run real regular-user signup, confirmation, sign-in, sign-out, recovery and safe return paths; separately verify configured OAuth providers. Preserve UID-keyed cleanup and two-owner RLS. Use only the previously authorized test address; no personal test address or existing password belongs in public repository artifacts. Real terms and provider attestations must come from the person, not synthetic records.

Images: Story owns a versioned IFund visual brief, grounded in actual brand assets and the owner's current campaign facts. Preserve user-specific title, need, beneficiary context and factual limits. Use a verified free model, reserve its budget, generate an actual asset, store it with owner/campaign access controls, return provenance and retry-safe receipts, and apply it only under owner review or an explicit bounded generation-and-use command. An image prompt is not a generated image.

Before completion: direct post commands work without redundant approval; planning performs no writes; stale/foreign scopes and revoked grants fail; "all" excludes later arrivals; retries do not duplicate; uncertain provider results reconcile; handoffs return actual results; memory can be corrected/erased; account/campaign switches do not leak; mobile and login flows pass. External capabilities additionally require genuine configured-provider acceptance.

At midnight report each item as implemented, locally verified, preview verified, provider verified, blocked or not tested. Mark complete only when its required gates pass. Include exact GitHub refs, applied migration identifiers, preview URLs and remaining external steps. Production promotion remains held until all agent/asset/skill/tool and acceptance requirements are satisfied. Financial activation, DNS/mail cutover and legacy retirement retain their separate requirements.

## Canonical file ownership and references

- Shared execution: `worker/services/`, `worker/workforce/`, `worker/agents/`; one canonical command authorizer and handoff executor.
- Unified member workspace: `apps/web/src/pages/` and `apps/web/functions/api/services/`; existing task workspaces become deep links from the conversation.
- Database/memory/receipts: additive reviewed Supabase contracts, reconciled against the live catalog before DDL. Existing applied migrations are immutable.
- Provider credentials and capability adapters: protected backend runtime only; no service key, refresh token or raw credential in the browser bundle/model context.
- Source references: `worker/services/position-contracts.json`, `worker/services/skills/manifest.json`, `docs/agents/ASSETS_TOOLS_AND_COMPLETION.md`, the sequential ledger and `docs/architecture/IFUND_BUILD_CONTRACT_2026-11-03.md`.
- Independent plan review: Reviewer confirmed source-compatible direct-command authorization; Auditor confirmed the missing runtime/workflow scope and the midnight feasibility limit. This review does not substitute for implementation acceptance.
