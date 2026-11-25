# iFund Agent Connections — Observed Runtime and Release Acceptance (2026-11-25)

This is a point-in-time read-only infrastructure inventory and a source repair record, **not** a claim that every member interaction has passed live acceptance.

## Host and identities
- Canonical GitHub source: `interplanetarysister/InterplanetaryFund`; this feature work is on `fix/agent-connections-shared-history-20261125`, not production.
- Cloudflare iFund account: `c95db4f2c901f32776471b85f1eda15d`. Pages project: `interplanetaryfund-migration`.
- Supabase project: `ssibsfmtodgximseeqsv`.
- All nine authorized specialist IDs are `nexus`, `story`, `orbit`, `polaris`, `forge`, `echo`, `pulse`, `link`, `discover`.

## Connection surface

| Function | Observed runtime | Source location / repaired routing | Acceptance needed |
|---|---|---|---|
| Nine-agent direct chat | Pages `IFUND_AGENT_SERVICE` bound to `ifund-agent-question`; that Worker has `AI` and `IFUND_TEAM_QUESTIONS_ENABLED=enabled` | `worker/index.js` forwards status/question to isolated Worker; existing `worker/agents/teamQuestion.js` enforces member, consent and quota | Real member JWT, model inference, quota reserve/complete; no measured live successful conversation yet |
| Saved team chat/history | `IFUND_TEAM_CONTEXT_ENABLED=disabled` on isolated worker; no executor secret there; team writer control disabled | Applied `20261125211000_ifund_team_question_user_writer.sql` to Supabase; alternate scoped worker credential accepted by `ifund_team_record_user`, retaining owner checks | Dedicated secret and matching hash must be provisioned by an authorized secret channel, then acceptance for one owner, other-owner exclusion and deletion. **Do not toggle the flag before a matching credential exists.** |
| Specialist strategy and growth | Existing Pages bindings `IFUND_STRATEGY_AGENT`, `IFUND_GROWTH_AGENT` to isolated Workers with AI enabled | `worker/index.js` direct routes corrected to prefer bound services; permanent `/api/services` adapters already present | Authenticated workspace, new AI brief, receipt and permission tests |
| Communications and connections | Existing Pages bindings `IFUND_COMMUNICATIONS_AGENT`, `IFUND_CONNECTIONS_AGENT` | `worker/index.js` communications forwarding existed; connections forwarding repaired. `worker/services/gateway.js` has stable adapters | Provider consent and verified permission / actual send sandbox; never infer external action completion |
| Story | Production Pages `IFUND_STORY_AGENT` to dedicated `ifund-story-agent` with AI and protected executor secret | `worker/services/gateway.js` permanent service routes | Signed-in owner-backed draft/create/revise verification, idempotency and payment limits |
| AI image and studio generations | `IFUND_IMAGE_STUDIO` and `IFUND_STUDIO_AI_SERVICE` bound; dedicated Workers have enabled AI flags | `worker/index.js` forwards image and admin studio inference | Member/admin permission, measured generation receipt, quota, R2 persistence, nonpublication |
| Research / practical skills | Existing `worker/agents/teamPracticeTask.mjs` supports authenticated practice and admin-only allowlisted research. Research feature flag is **not configured** on isolated question Worker. | `worker/index.js` forwards practice/research; new `agentSpecialistSkills.mjs` and both AgentSidePanel and AgentsTeam wire **user-triggered, owner-confirmed advisory practice** | Practice authenticated browser acceptance; research remain 503 until deliberately enabled and outbound allowlist and admin acceptance verified |
| Supervised model tool registry | `worker/services/tool-registry.js` is a guarded source registry with role scopes; no claim all manifest declarations have verified live bindings | No new privilege or externally acting adapter inferred from manifest | Register and acceptance-test each actual tool adapter separately. Read, write, approval and provider scopes must be independently verified |
| Internal operations room autonomy | `ifund-agent-ops-autonomy` deployed but `IFUND_OPS_AUTONOMY_ENABLED=disabled`, no schedule/secret observed | `worker/agents/opsAutonomy.js`; member-facing `opsRoom.js` uses a separate agent service binding | Authenticated administrator, scoped bot secret, controlled schedule, source receipt, daily limits and QA before enabling |
| Weekly training and shared skill promotion | Supabase training Edge Function ACTIVE v21; hourly and Sunday Supabase cron jobs active; Cloudflare research Worker Sunday 10-12 UTC; 9 optimized research agents queued for Sunday 2026-11-29 | Repository Edge function synchronized from ACTIVE v21 to avoid older-source redeploy | Next scheduled run's receipts, independent review, collective review, next plans, owner approval. 4 candidates pending review and 14 quarantined. `ifund_training_approved_skills` currently 0 published skills |
| ChatGPT five scheduled engineering assistants | Five hourly external ChatGPT automations enabled and recorded recent runs; not the same runtime as the nine member-facing iFund agents | Kept separate from iFund Workers and Supabase by architecture | Confirm specific work artifact, commit and deployment per run; a scheduled task alone is not a deployment |

## Live DB migration result
- `public.ifund_team_record_user(uuid,text,text,uuid)` now accepts the existing, scoped team question writer verifier **in addition to** the existing production workforce channel; the authenticated member, owned campaign, event-key and consent safeguards remain.
- Verified `authenticated` has EXECUTE, `anon` does not, and the function references `team_question_writer_verified`. No data was backfilled, no user conversations generated.
- Secure secret provisioning attempt was blocked. The database's team writer control is still disabled, and chat history has not been enabled.

## Required release gate
Do not merge or deploy while any source/test/tooling acceptance is unverified. Run root integration tests, web regression tests, full production compilation, branch preview API checks and authenticated real-member acceptance; validate service routing by status and actual model outputs, not merely Cloudflare binding presence. Preserve separate owner-review gates for payments, publishing, grant applications, private data and administrative changes.

Never store API tokens, service-role keys, worker secrets or bearer JWTs in this file, test fixtures or client bundles.
