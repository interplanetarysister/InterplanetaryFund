# Frontend pages 16–30
Static callsite scan; no secrets copied. Each hit records file and line, not proof of runtime activity.

## [src/pages/Connections.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Connections.jsx) (18 direct matching lines)
- L111: `const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user", request_id: crypto.randomUUID() });`
- L115: `const r = await base44.functions.invoke("listConnections", { scope: "mine" });`
- L138: `base44.functions.invoke("resolveConnectionStatus", { platform: c.platform, connection_id: c.id })`
- L152: `base44.functions.invoke("syncWixCampaigns", {}),`
- L153: `base44.functions.invoke("syncWixContent", {}),`
- L154: `base44.functions.invoke("syncWixBusinessData", {}),`
- L155: `base44.functions.invoke("syncWixAnalytics", {}),`
- L174: `const me = await base44.auth.me();`
- L185: `const { data } = await base44.functions.invoke("finalizeAppUserOAuthConnection", {`
- L195: `const verified = await base44.functions.invoke("verifyPlatformConnection", { connection_id: connectionId });`
- L214: `const connRes = await base44.functions.invoke("listConnections", { scope: "mine" });`
- L222: `base44.functions.invoke("getSharedConnectorStatus", {})`
- L280: `const { data } = await base44.functions.invoke("requestManagedConnectionAction", {`
- L430: `base44.functions.invoke("resolveConnectionStatus", { platform: updated.platform, connection_id: updated.id })`
- L439: `base44.functions.invoke("resolveConnectionStatus", { platform: updated.platform, connection_id: updated.id })`
- L532: `const verified = await base44.functions.invoke("verifyPlatformConnection", { connection_id: saved.id });`
- L546: `const resolved = await base44.functions.invoke("resolveConnectionStatus", {`
- L552: `base44.functions.invoke("resolveConnectionStatus", { platform: saved.platform, connection_id: saved.id })`

## [src/pages/Contact.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Contact.jsx) (1 direct matching lines)
- L29: `const { data } = await base44.functions.invoke("sendPublicContactMessage", form);`

## [src/pages/CreateCampaign.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/CreateCampaign.jsx) (7 direct matching lines)
- L61: `const { data } = await base44.functions.invoke("getCampaignDraft", { campaign_id: draftId });`
- L90: `const { data } = await base44.functions.invoke("importExternalCampaign", { connection_id: importConnectionId, campaign: { goal_amount: goal }, request_id: requestId });`
- L102: `const res = await base44.functions.invoke("geocodeCity", { city: form.location });`
- L120: `: await base44.functions.invoke("generateCampaignCover", { prompt });`
- L153: `const { data } = await base44.functions.invoke("saveCampaign", {`
- L214: `const { data } = await base44.functions.invoke("saveCampaign", { campaign_id: draftId || undefined, campaign: payload });`
- L217: `if (data.created === true) base44.functions.invoke("recordCampaignCreated", { campaign_id: campaign.id }).catch(() => {});`

## [src/pages/Dashboard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Dashboard.jsx) (2 direct matching lines)
- L31: `const me = await base44.auth.me();`
- L33: `const mine = await base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date");`

## [src/pages/DeviceActivation.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/DeviceActivation.jsx) (3 direct matching lines)
- L27: `base44.auth.me().then(user => {`
- L39: `const response = await base44.functions.invoke("deviceAuthorization",{mode:"inspect",user_code:userCode});`
- L52: `const response = await base44.functions.invoke("deviceAuthorization",{`

## [src/pages/Discover.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Discover.jsx) (1 direct matching lines)
- L29: `base44.entities.Campaign.filter({ status: "active" }, "-created_date", 100)`

## [src/pages/Donors.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Donors.jsx) (1 direct matching lines)
- L19: `const { data } = await base44.functions.invoke("getOwnerDonorDirectory", {});`

## [src/pages/EmbedCampaign.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/EmbedCampaign.jsx) (1 direct matching lines)
- L21: `base44.entities.Campaign.get(id)`

## [src/pages/ExternalAccounts.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/ExternalAccounts.jsx) (5 direct matching lines)
- L26: `const me = await base44.auth.me();`
- L30: `base44.functions.invoke("listConnections", { scope: "all" }).then((r) => r.data.connections),`
- L31: `base44.entities.DistributedPost.list("-created_date", 300),`
- L32: `base44.entities.Agent.list().catch(() => []),`
- L33: `base44.entities.Campaign.list("-created_date", 200),`

## [src/pages/FinancialLedger.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/FinancialLedger.jsx) (1 direct matching lines)
- L30: `const { data } = await base44.functions.invoke("getOwnerFinancialLedger", {});`

## [src/pages/FollowedCampaigns.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/FollowedCampaigns.jsx) (7 direct matching lines)
- L39: `const me = await base44.auth.me();`
- L40: `const list = await base44.entities.FollowedCampaign.filter({ user_id: me.id }, "-created_date");`
- L42: `const fresh = await Promise.all(list.map((f) => base44.entities.Campaign.get(f.campaign_id).catch(() => null)));`
- L93: `await base44.entities.FollowedCampaign.update(f.id, { pinned: !f.pinned });`
- L97: `await base44.entities.FollowedCampaign.update(f.id, { archived: !f.archived });`
- L100: `await base44.entities.FollowedCampaign.delete(f.id);`
- L103: `const markViewed = (f) => { base44.entities.FollowedCampaign.update(f.id, { last_viewed: new Date().toISOString() }); };`

## [src/pages/ForgotPassword.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/ForgotPassword.jsx) (1 direct matching lines)
- L19: `await base44.auth.resetPasswordRequest(email);`

## [src/pages/FoundingMembers.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/FoundingMembers.jsx) (1 direct matching lines)
- L21: `const response=await base44.functions.invoke('joinFoundingWaitlist',{`

## [src/pages/GlobalGlobe.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/GlobalGlobe.jsx) (1 direct matching lines)
- L34: `const result = await base44.entities.Campaign.filter({ status: "active" }, "-raised_amount", MAX_CAMPAIGNS);`

## [src/pages/Help.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Help.jsx) (3 direct matching lines)
- L29: `base44.entities.HelpArticle.list("-created_date", 500)`
- L33: `base44.auth.me().then((me) => { if (active) setUser(me); }).catch(() => {});`
- L59: `const { data } = await base44.functions.invoke("createSupportTicket", {`
