# Frontend non-UI components 103–119
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/connections/PublishFromConnections.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/PublishFromConnections.jsx) — 5 matches
- L42: `const owner = await base44.auth.me();`
- L44: `const rows = await base44.entities.Campaign.filter({ created_by_id: owner.id }, "-created_date", 30);`
- L47: `const { data } = await base44.functions.invoke("listConnections", { scope: "mine" });`
- L101: `const { data: prepared } = await base44.functions.invoke("createDistributedPost", {`
- L118: `const { data: outcome } = await base44.functions.invoke("publishPost", {`

## [src/components/connections/SyncRunHistory.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/SyncRunHistory.jsx) — 1 matches
- L33: `const list = await base44.entities.SyncRun.filter({}, "-started_at", 5);`

## [src/components/connections/platformCatalog.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/platformCatalog.js) — 0 matches
- No direct match detected.

## [src/components/connections/platformLogoAssets.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/connections/platformLogoAssets.js) — 0 matches
- No direct match detected.

## [src/components/dashboard/FollowFeed.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/dashboard/FollowFeed.jsx) — 4 matches
- L16: `const me = await base44.auth.me();`
- L17: `const follows = await base44.entities.FollowedCampaign.filter({ user_id: me.id, archived: false });`
- L20: `const updates = await Promise.all(ids.map((id) => base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date", 3).catch(() => [])));`
- L21: `const campaigns = await Promise.all(ids.map((id) => base44.entities.Campaign.get(id).catch(() => null)));`

## [src/components/dashboard/MissionControl.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/dashboard/MissionControl.jsx) — 4 matches
- L25: `base44.functions.invoke("syncWixCampaigns", {}),`
- L26: `base44.functions.invoke("syncWixContent", {}),`
- L27: `base44.functions.invoke("syncWixBusinessData", {}),`
- L28: `base44.functions.invoke("syncWixAnalytics", {}),`

## [src/components/dashboard/StatCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/dashboard/StatCard.jsx) — 0 matches
- No direct match detected.

## [src/components/dashboard/TreasurySnapshotCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/dashboard/TreasurySnapshotCard.jsx) — 1 matches
- L25: `base44.entities.TreasurySnapshot.list("-created_date", 1)`

## [src/components/devices/DevicePairingSelfTest.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/devices/DevicePairingSelfTest.jsx) — 2 matches
- L117: `const listing = await base44.functions.invoke("deviceAuthorization",{mode:"list"});`
- L122: `const response = await base44.functions.invoke("deviceAuthorization",{`

## [src/components/discover/RecommendedCampaigns.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/discover/RecommendedCampaigns.jsx) — 3 matches
- L19: `try { me = await base44.auth.me(); } catch { me = null; }`
- L28: `base44.entities.Donation.filter({ donor_user_id: me.id }).catch(() => []),`
- L29: `base44.entities.FollowedCampaign.filter({ user_id: me.id }).catch(() => []),`

## [src/components/distribution/DistributedPostCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/distribution/DistributedPostCard.jsx) — 4 matches
- L35: `const { data } = await base44.functions.invoke("manageDistributedPost", { action: "edit", post_id: post.id, content });`
- L46: `const { data } = await base44.functions.invoke("publishPost", { post_id: post.id, user_publish_authorized: true });`
- L68: `const { data } = await base44.functions.invoke("manageDistributedPost", { action: "schedule", post_id: post.id, scheduled_for: new Date(scheduleAt).toISOString() });`
- L77: `const { data } = await base44.functions.invoke("manageDistributedPost", { action: "delete", post_id: post.id });`

## [src/components/distribution/DistributionPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/distribution/DistributionPanel.jsx) — 5 matches
- L45: `useEffect(()=>{(async()=>{try{const [r,p,me,capRes]=await Promise.all([base44.functions.invoke("listConnections",{}),base44.entities.DistributedPost.filter({campaign_id:campaign.id},"-create`
- L58: `const {data}=await base44.functions.invoke("updateCampaignSettings",{campaign_id:campaign.id,patch:{distribution_donation_connection_id:id==="ifund"?"":id}});`
- L76: `const responses=await Promise.allSettled(targets.map(c=>base44.functions.invoke("createDistributedPost",{campaign_id:campaign.id,connection_id:c.id,content,donation_destination_connection_id`
- L85: `const generate=async()=>{if(invalidSavedDestination||savingDestination){setError("Repair or change the saved donation destination before preparing posts.");return;}setGenerating(true);setErr`
- L86: `const broadcast=async()=>{setBroadcasting(true);setError("");try{const {data}=await base44.functions.invoke("broadcastPosts",{campaign_id:campaign.id});if(data?.error)setError("The distribut`

## [src/components/distribution/JustGivingStagingPilot.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/distribution/JustGivingStagingPilot.jsx) — 2 matches
- L25: `base44.functions.invoke("justGivingStagingPilot", { action: "readiness" })`
- L34: `const { data } = await base44.functions.invoke("justGivingStagingPilot", {`

## [src/components/giving/DonationRow.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/giving/DonationRow.jsx) — 0 matches
- No direct match detected.

## [src/components/giving/RecurringPlanCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/giving/RecurringPlanCard.jsx) — 1 matches
- L23: `await base44.functions.invoke("manageRecurringDonation", {`

## [src/components/globe/CampaignGlobe.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/globe/CampaignGlobe.jsx) — 0 matches
- No direct match detected.

## [src/components/inbox/InboxItemCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/inbox/InboxItemCard.jsx) — 3 matches
- L44: `if (item.record_id) { const { data } = await base44.functions.invoke("updateInboxItem", { item_id: item.record_id, ai_draft: text }); if (data?.ok !== true) throw new Error("Inbox draft upda`
- L49: `if (item.record_id) { const { data } = await base44.functions.invoke("updateInboxItem", { item_id: item.record_id, status: "done" }); if (data?.ok !== true) throw new Error("Inbox status upd`
- L50: `else if (item.notification_id) { const { data } = await base44.functions.invoke("markNotificationRead", { notification_id: item.notification_id }); if (data?.ok !== true) throw new Error("No`
