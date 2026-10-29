# Frontend pages 31–45
Static callsite scan; no secrets copied. Each hit records file and line, not proof of runtime activity.

## [src/pages/HelpAdmin.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/HelpAdmin.jsx) (7 direct matching lines)
- L29: `base44.entities.HelpDraft.list("-created_date", 200),`
- L30: `base44.entities.HelpArticle.list("-created_date", 200),`
- L59: `? await base44.entities.HelpDraft.update(draftId, payload)`
- L60: `: await base44.entities.HelpDraft.create(payload);`
- L81: `? await base44.entities.HelpArticle.update(articleId, data)`
- L82: `: await base44.entities.HelpArticle.create(data);`
- L86: `await base44.entities.HelpDraft.update(draftId, { ...data, article_id: liveId });`

## [src/pages/HelpArticle.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/HelpArticle.jsx) (5 direct matching lines)
- L27: `base44.entities.HelpArticle.filter({ slug }, "-created_date", 1)`
- L36: `base44.auth.me().then(async (me) => {`
- L39: `const records = await base44.entities.HelpFeedback.filter({ article_id: article.id, user_id: me.id }, "-created_date", 1);`
- L50: `? await base44.entities.HelpFeedback.update(feedback.id, { helpful })`
- L51: `: await base44.entities.HelpFeedback.create({ article_id: article.id, user_id: user.id, helpful });`

## [src/pages/Home.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Home.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/Inbox.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Inbox.jsx) (5 direct matching lines)
- L38: `const me = await base44.auth.me();`
- L41: `base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 100),`
- L42: `base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50),`
- L43: `base44.entities.Campaign.filter({ created_by_id: me.id }),`
- L46: `myCampaigns.map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))`

## [src/pages/InstitutionDetail.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/InstitutionDetail.jsx) (1 direct matching lines)
- L25: `const [me, inst] = await Promise.all([base44.auth.me().catch(() => null), base44.entities.Institution.get(id)]);`

## [src/pages/Institutions.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Institutions.jsx) (1 direct matching lines)
- L27: `base44.entities.Institution.list("-created_date", 100)`

## [src/pages/IntegrationsAdmin.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/IntegrationsAdmin.jsx) (3 direct matching lines)
- L70: `const me = await withTimeout(base44.auth.me());`
- L77: `const list = await withTimeout(base44.entities.PlatformAccessRegistry.list("-platform", 200));`
- L108: `const request = invokeWithLock(healthLock, () => base44.functions.invoke("validateIntegrationHealth", {}));`

## [src/pages/Login.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Login.jsx) (1 direct matching lines)
- L68: `base44.auth.setToken(result.access_token);`

## [src/pages/MissionControlPage.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/MissionControlPage.jsx) (3 direct matching lines)
- L20: `const me = await base44.auth.me();`
- L21: `const briefs = await base44.entities.MissionBrief.filter({ created_by_id: me.id });`
- L32: `const { data } = await base44.functions.invoke("generateIntelligence", { mode: "briefing" });`

## [src/pages/MyBlog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/MyBlog.jsx) (3 direct matching lines)
- L17: `base44.functions.invoke("manageBlog",{mode:"mine"}),`
- L18: `base44.entities.Campaign.filter({status:"active"}, "-created_date",100).catch(()=>[]),`
- L25: `try{const r=await base44.functions.invoke("manageBlog",body);if(!r.data?.ok)throw new Error(r.data?.error||"Could not save.");`

## [src/pages/MyGiving.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/MyGiving.jsx) (1 direct matching lines)
- L19: `const { data } = await base44.functions.invoke("getMyGiving", {});`

## [src/pages/Notifications.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Notifications.jsx) (4 direct matching lines)
- L29: `const me = await base44.auth.me();`
- L31: `const mine = await base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50);`
- L104: `await base44.entities.Notification.updateMany({ user_id: user.id, read: false }, { $set: { read: true } });`
- L115: `await base44.entities.Notification.update(n.id, { read: true }).catch((e) => {`

## [src/pages/OAuthConsent.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/OAuthConsent.jsx) (1 direct matching lines)
- L48: `// Gate on the server's auth result, NOT base44.auth.isAuthenticated():`

## [src/pages/Onboarding.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Onboarding.jsx) (2 direct matching lines)
- L35: `await base44.functions.invoke("setUnifiedOboConsent", { granted: !!data.delegated_operations_enabled });`
- L36: `await base44.auth.updateMe({ ...updates, onboarding: data, onboarding_completed: true });`

## [src/pages/OpsCenter.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/OpsCenter.jsx) (5 direct matching lines)
- L33: `const me = await base44.auth.me();`
- L43: `base44.entities.Agent.list("-trust_score", 50),`
- L44: `base44.entities.MonitoredCampaign.list("-raised_amount", 50),`
- L45: `base44.entities.TreasurySnapshot.list("-created_date", 1),`
- L46: `base44.entities.ProtocolReport.list("-generated_at", 20),`
