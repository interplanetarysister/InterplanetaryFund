# Frontend non-UI components 86–102
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/community/CreateCommunityDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/CreateCommunityDialog.jsx) — 1 matches
- L27: `const { data } = await base44.functions.invoke("createCommunity", { name, description, type, location });`

## [src/components/community/DiscussionsTab.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/DiscussionsTab.jsx) — 2 matches
- L27: `base44.entities.DiscussionPost.filter({ community_id: communityId }, "-created_date", 50).then(setPosts);`
- L32: `const { data } = await base44.functions.invoke("createDiscussionPost", { community_id: communityId, title, content, category });`

## [src/components/community/MembersTab.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/MembersTab.jsx) — 0 matches
- No direct match detected.

## [src/components/community/PostCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/PostCard.jsx) — 2 matches
- L27: `setReplies(await base44.entities.DiscussionReply.filter({ post_id: post.id }, "created_date"));`
- L34: `const { data } = await base44.functions.invoke("postDiscussionReply", {`

## [src/components/community/VolunteerTab.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/VolunteerTab.jsx) — 5 matches
- L21: `const me = await base44.auth.me();`
- L24: `base44.entities.VolunteerOpportunity.filter({ community_id: community.id }, "-created_date"),`
- L25: `base44.entities.VolunteerSignup.filter({ community_id: community.id, user_id: me.id }),`
- L34: `const { data } = await base44.functions.invoke("createVolunteerOpportunity", { ...form, community_id: community.id });`
- L45: `const { data } = await base44.functions.invoke("volunteerSignup", { opportunity_id: opp.id });`

## [src/components/community/communityTypes.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/communityTypes.js) — 0 matches
- No direct match detected.

## [src/components/connections/AIConsentCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/AIConsentCard.jsx) — 1 matches
- L17: `const result = await base44.functions.invoke("setUnifiedOboConsent", { granted });`

## [src/components/connections/AccountAiScope.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/AccountAiScope.jsx) — 0 matches
- No direct match detected.

## [src/components/connections/AdminOAuthProviderReadiness.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/AdminOAuthProviderReadiness.jsx) — 1 matches
- L18: `const { data } = await base44.functions.invoke("adminOAuthProviderReadiness", {});`

## [src/components/connections/AgentWorkPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/AgentWorkPanel.jsx) — 5 matches
- L35: `base44.functions.invoke("manageAgentWork", { mode: "list", view: allAgents ? "all" : "managed" }),`
- L36: `allAgents ? base44.functions.invoke("trackAgentConversation", { mode: "list" }) : Promise.resolve(null),`
- L67: `base44.functions.invoke("manageAgentWork", { mode: "advance", delegation_id: item.id })`
- L88: `await base44.functions.invoke("trackAgentConversation", { mode: "sync", run_id: pending.id }).catch(() => {});`
- L102: `const response = await base44.functions.invoke("manageAgentWork", {`

## [src/components/connections/ConnectDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/ConnectDialog.jsx) — 8 matches
- L59: `base44.auth.me()`
- L60: `.then((me) => base44.entities.Campaign.filter({ created_by_id: me.id }))`
- L70: `base44.functions.invoke("getAppUserConnector", { platform: platform.id })`
- L127: `const { data } = await base44.functions.invoke("getAppUserConnector", { platform: platform.id });`
- L138: `const me = await base44.auth.me();`
- L155: `const redirectUrl = await base44.connectors.connectAppUser(data.connector_id);`
- L232: `const { data } = await base44.functions.invoke("setConnectionAiToggle", {`
- L252: `const res = await base44.functions.invoke("saveConnectionCredentials", {`

## [src/components/connections/ConnectionCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/ConnectionCard.jsx) — 3 matches
- L47: `await base44.functions.invoke("disconnectPlatformConnection", {`
- L62: `const { data }=await base44.functions.invoke("setConnectionAiToggle",{`
- L88: `const { data } = await base44.functions.invoke("verifyPlatformConnection", {`

## [src/components/connections/CredentialFields.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/CredentialFields.jsx) — 0 matches
- No direct match detected.

## [src/components/connections/FetchCredentialsDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/FetchCredentialsDialog.jsx) — 0 matches
- No direct match detected.

## [src/components/connections/OAuthPermissionStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/OAuthPermissionStep.jsx) — 0 matches
- No direct match detected.

## [src/components/connections/PasswordVaultPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/PasswordVaultPanel.jsx) — 6 matches
- L38: `base44.auth.me()`
- L39: `.then(me => base44.entities.UserCredentialVault.filter({ user_id: me.id, platform: platform.id }))`
- L51: `const me = await base44.auth.me();`
- L54: `? await base44.entities.UserCredentialVault.update(saved.id, data)`
- L55: `: await base44.entities.UserCredentialVault.create({ ...data, created_at: data.updated_at });`
- L75: `try { await base44.entities.UserCredentialVault.delete(saved.id); setSaved(null); lock(); setNotice("Vault entry deleted."); }`

## [src/components/connections/PlatformLogo.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/PlatformLogo.jsx) — 0 matches
- No direct match detected.
