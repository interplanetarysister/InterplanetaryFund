# Frontend non-UI components 171–187
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/platform/StandardsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/StandardsPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/platform/StripeIntegrationPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/StripeIntegrationPanel.jsx) — 2 matches
- L17: `const { data } = await base44.functions.invoke("getStripeIntegrationAudit", {});`
- L28: `const { data } = await base44.functions.invoke("repairStripeWebhookEvents", {});`

## [src/components/platform/TimelinePanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/TimelinePanel.jsx) — 1 matches
- L29: `base44.entities.PlatformEvent.list("-created_date", 100).then(setEvents);`

## [src/components/platform/UserManagementPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/UserManagementPanel.jsx) — 3 matches
- L28: `base44.auth.me(),`
- L29: `base44.entities.User.list("-created_date", 200),`
- L47: `const { data } = await base44.functions.invoke("adminUpdateUserRole", { user_id: u.id, role: newRole });`

## [src/components/platform/blueprint.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/blueprint.js) — 0 matches
- No direct match detected.

## [src/components/platform/constitution.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/constitution.js) — 0 matches
- No direct match detected.

## [src/components/platform/logPlatformEvent.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/logPlatformEvent.js) — 1 matches
- L4: `const { data } = await base44.functions.invoke("logPlatformEvent", { action, category, affected_resource, outcome, details });`

## [src/components/platform/operations.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/operations.js) — 0 matches
- No direct match detected.

## [src/components/platform/standards.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/standards.js) — 0 matches
- No direct match detected.

## [src/components/prelaunch/PrelaunchNotice.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/prelaunch/PrelaunchNotice.jsx) — 0 matches
- No direct match detected.

## [src/components/profile/FriendsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/profile/FriendsPanel.jsx) — 6 matches
- L21: `const { data } = await base44.functions.invoke("manageFriends", { action: "list" });`
- L31: `const { data } = await base44.functions.invoke("manageFriends", { action: "lookup", query });`
- L33: `await base44.functions.invoke("manageFriends", { action: "invite", email: query.trim() });`
- L44: `await base44.functions.invoke("manageFriends", { action: "request", addressee_user_id: userId });`
- L49: `const respond = async (id, action) => { await base44.functions.invoke("manageFriends", { action, friendship_id: id }); load(); };`
- L50: `const remove = async (id) => { await base44.functions.invoke("manageFriends", { action: "remove", friendship_id: id }); load(); };`

## [src/components/profile/PublicProfileEditor.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/profile/PublicProfileEditor.jsx) — 5 matches
- L16: `base44.functions.invoke("managePublicProfile",{mode:"read",user_id:user.id}),`
- L17: `base44.entities.Campaign.filter({created_by_id:user.id}).catch(()=>[]),`
- L18: `base44.entities.FollowedCampaign.filter({user_id:user.id}).catch(()=>[]),`
- L22: `const followedActive=await Promise.all((followed||[]).filter(f=>!f.archived).slice(0,100).map(f=>base44.entities.Campaign.get(f.campaign_id).catch(()=>null)));`
- L39: `try{const r=await base44.functions.invoke("managePublicProfile",{mode:"save",...data});`

## [src/components/social/AdminContentPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/AdminContentPanel.jsx) — 3 matches
- L31: `const res = await base44.functions.invoke("generateSocialContent", {`
- L39: `const me = await base44.auth.me();`
- L41: `const post = await base44.entities.SocialPost.create({`

## [src/components/social/OfficialPublications.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/OfficialPublications.jsx) — 4 matches
- L40: `base44.functions.invoke("manageBlog", { mode: "feed" }),`
- L41: `base44.functions.invoke("manageOfficialPublications", { mode: "feed" }),`
- L87: `const upload = await base44.integrations.Core.UploadPublicFile({ file: pdf });`
- L91: `const result = await base44.functions.invoke("manageOfficialPublications", {`

## [src/components/social/PostCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/PostCard.jsx) — 0 matches
- No direct match detected.

## [src/components/social/PostComposer.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/PostComposer.jsx) — 6 matches
- L35: `const res = await base44.integrations.Core.InvokeLLM({`
- L76: `const result = await base44.functions.invoke("generateCampaignCover", { prompt });`
- L105: `const { data } = await base44.functions.invoke("createSocialPost", {`
- L129: `const { data: distributed } = await base44.functions.invoke("createDistributedPost", {`
- L137: `const result = await base44.functions.invoke("publishPost", {`
- L156: `displayedPost = await base44.entities.SocialPost.update(post.id, {`

## [src/components/social/ProfileBanner.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/ProfileBanner.jsx) — 0 matches
- No direct match detected.
