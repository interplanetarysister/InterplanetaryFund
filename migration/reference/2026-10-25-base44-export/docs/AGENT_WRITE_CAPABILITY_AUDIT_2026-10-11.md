# IFund Agent Write Capability Audit — 2026-10-11

## Verified existing processes
- Campaign edits: 'saveCampaign' and 'updateCampaignSettings' implement owner-checked writes.
- IFund social posts: 'createSocialPost' writes visible SocialPost records.
- Campaign updates: 'postCampaignUpdate' writes CampaignUpdate, then optionally distributes and notifies followers.
- External posts: 'createDistributedPost' stages a destination-scoped draft; 'publishPost' requires ownership and actual provider support.
- Blogs: 'manageBlog' supports create, draft, publish, delete, owner checks and subscriptions.
- Discussions and replies: 'createDiscussionPost' and 'postDiscussionReply'; profiles: 'managePublicProfile'.
- Admin requests: 'executeAdminAgentRequest' and 'verifyAdminGateway' already enforce admin role plus verified owner allowlist, but only initiate agent conversations.

## Gaps and changes made
1. Most agent configs lacked write functions and account context. Added 'getAgentAccountContext' to nine existing agents, and 'manageAgentContentDraft' to six appropriate content roles.
2. No general owner-reviewed agent content workflow. Added 'AgentContentDraft' entity, draft management function, separately human-confirmed 'applyAgentContentDraft' backend and review panel under /agents. The apply route calls existing guarded functions and explicitly disables cross-posting of campaign updates. Failed/uncertain mutations must be reconciled before retry.
3. Normal agent configs included a legacy 'adminagent' skill name. Removed it from all user-facing agents. Added 'admin_builder_agent' whose only tool is server-super-admin-gated 'manageAdminBuilderWork'; exposed only in the administrator chat tab and authorized native backend gateway. This is a task queue, NOT a source code editor or deployment capability.
4. Existing incomplete workflows remain: browser connection function returns a deferred execution error; Cloudflare gateway has no Browser Run binding; provider posting adapters are narrower than catalog; direct builder code execution and verified publication receipts remain future work.
5. Added private 'PostInterest' entity and 'managePostInterest' function for owner-scoped Like/Save preferences, with server-authoritative count updates instead of unauthorized direct editing of other members' SocialPost records. Social feed buttons now save preferences and the agent account context surfaces limited recent interest history. Pre-existing/untracked likes cannot be attributed retroactively.
6. AI review panel now supports editing draft fields before owner approval; revised content cannot silently change destination identifiers. Existing 'postCampaignUpdate' creates an update before follow-up notification/distribution; a later error can produce an uncertain partial result. The AI apply tool marks such requests failed for human reconciliation, never blindly retries.

## Guardrails
- Agent proposals never auto-publish, and agent configs never expose 'applyAgentContentDraft'.
- Only the content owner's separate review-panel confirmation calls the apply function.
- Existing backend functions recheck campaign/connection/owner/subscription/provider rules.
- Admin builder has zero raw entity access, browser, shell, deployment or connected account secrets.
- Source test: 'node scripts/verify-agent-write-capabilities.mjs'.
- Files in Base44 source and the checked-in SKILL.md references do not by themselves prove that the live published app exposes the tools. Verify via a real authenticated owner + super-admin + non-admin test after publish/sync.
