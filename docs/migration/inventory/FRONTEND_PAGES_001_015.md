# Frontend pages 1–15
Static scan of Base44 usages, src/pages. Only clear base44.* sites shown; callsites through aliases or wrappers may be omitted.

## [src/pages/AIImageStudio.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/AIImageStudio.jsx) (1 direct matching lines)
- L29: `const response = await base44.functions.invoke("generateCampaignCover", { prompt });`

## [src/pages/About.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/About.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/AdminAgentApi.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/AdminAgentApi.jsx) (2 direct matching lines)
- L13: `const oauthCall=useCallback(async(body)=>{const response=await base44.functions.invoke('manageOAuthClients',body);if(response?.data?.error)throw Error(response.data.error);if(!response?.data`
- L21: `const call=useCallback(async(body)=>{const result=await base44.functions.invoke('manageExternalAgentKeys',body);if(result?.data?.error)throw Error(result.data.error);if(!result?.data||typeof`

## [src/pages/AdminFoundingWaitlist.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/AdminFoundingWaitlist.jsx) (2 direct matching lines)
- L7: `try {const data=await base44.entities.FoundingWaitlist.list('-created_date',500);setRows(Array.isArray(data)?data:[]);}`
- L17: `try{await base44.entities.FoundingWaitlist.update(row.id,{status});setRows(v=>v.map(x=>x.id===row.id?{...x,status}:x));}`

## [src/pages/Agents.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Agents.jsx) (1 direct matching lines)
- L27: `base44.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoadingUser(false));`

## [src/pages/Analytics.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Analytics.jsx) (9 direct matching lines)
- L43: `const me = await base44.auth.me();`
- L48: `base44.entities.Campaign.filter({ created_by_id: me.id }),`
- L49: `base44.entities.Community.list("-created_date", 200),`
- L50: `base44.entities.Institution.list("-created_date", 200),`
- L51: `base44.entities.VolunteerOpportunity.list("-created_date", 200),`
- L52: `base44.entities.GrantApplication.filter({ applicant_user_id: me.id }),`
- L53: `base44.entities.InstitutionOpportunity.list("-created_date", 200),`
- L61: `campaigns.map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))`
- L67: `volunteerOpps.map((o) => base44.entities.VolunteerSignup.filter({ opportunity_id: o.id }))`

## [src/pages/AuditLogAdmin.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/AuditLogAdmin.jsx) (1 direct matching lines)
- L17: `const data = await base44.entities.AuditLog.list("-created_date", 500);`

## [src/pages/BlogArticle.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/BlogArticle.jsx) (1 direct matching lines)
- L11: `base44.functions.invoke("manageBlog",{mode:"article",entry_id:id}).then(r=>{if(!r.data?.ok)throw new Error(r.data?.error||"Article unavailable");if(active)setData(r.data);})`

## [src/pages/Blogs.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Blogs.jsx) (1 direct matching lines)
- L11: `base44.functions.invoke("manageBlog",{mode:"feed"}).then(r=>{`

## [src/pages/CampaignDetail.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/CampaignDetail.jsx) (5 direct matching lines)
- L51: `base44.entities.Campaign.filter({ id }),`
- L52: `base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date"),`
- L53: `base44.functions.invoke("getCampaignDonations", { campaign_id: id }),`
- L60: `const rel = await base44.entities.Campaign.filter({ category: c[0].category, status: "active" }, "-raised_amount", 6).catch(() => []);`
- L69: `base44.auth.me().then(setUser).catch(() => {});`

## [src/pages/Communications.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Communications.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/Community.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Community.jsx) (4 direct matching lines)
- L33: `const me = await base44.auth.me();`
- L36: `base44.entities.Community.list("-created_date", 100),`
- L37: `base44.entities.CommunityMember.filter({ user_id: me.id }),`
- L44: `const all = await base44.entities.Community.list("-created_date", 100);`

## [src/pages/CommunityDetail.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/CommunityDetail.jsx) (6 direct matching lines)
- L27: `base44.auth.me().catch(() => null),`
- L28: `base44.entities.Community.get(id),`
- L29: `base44.entities.CommunityMember.filter({ community_id: id }),`
- L56: `if (!me) { base44.auth.redirectToLogin(window.location.pathname); return; }`
- L59: `const { data } = await base44.functions.invoke("communityMembership", { action: "join", community_id: id });`
- L72: `const { data } = await base44.functions.invoke("communityMembership", { action: "leave", community_id: id });`

## [src/pages/Connect.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Connect.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/ConnectedDevices.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/ConnectedDevices.jsx) (2 direct matching lines)
- L23: `const result=await base44.functions.invoke("deviceAuthorization",{mode:"list"});`
- L37: `const result=await base44.functions.invoke("deviceAuthorization",{mode:"revoke",authorization_id:id});`
