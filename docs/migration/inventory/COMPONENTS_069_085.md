# Frontend non-UI components 69–85
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/campaigns/OutreachAgentPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/OutreachAgentPanel.jsx) — 5 matches
- L27: `const me = await base44.auth.me();`
- L29: `const acts = await base44.entities.AgentActivity.filter({ campaign_id: campaign.id }, "-created_date", 30);`
- L51: `const { data } = await base44.functions.invoke("updateCampaignSettings", {`
- L68: `const { data } = await base44.functions.invoke("updateCampaignSettings", {`
- L83: `const { data } = await base44.functions.invoke("reviewAgentActivity", { activity_id: id, status });`

## [src/components/campaigns/ShareCampaignKit.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/ShareCampaignKit.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/SuccessStories.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/SuccessStories.jsx) — 1 matches
- L12: `base44.entities.Campaign.filter({ status: "active" }, "-raised_amount", 100)`

## [src/components/campaigns/TrustBadge.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/TrustBadge.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/UpdatesSection.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/UpdatesSection.jsx) — 1 matches
- L78: `const { data } = await base44.functions.invoke("postCampaignUpdate", {`

## [src/components/coach/CoachMarks.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/coach/CoachMarks.jsx) — 3 matches
- L8: `// the user profile (tips_completed) via base44.auth.updateMe, so it never`
- L26: `const me = await base44.auth.me();`
- L81: `base44.auth.updateMe({ tips_completed: true }).catch(() => {});`

## [src/components/coach/CoachTourButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/coach/CoachTourButton.jsx) — 0 matches
- No direct match detected.

## [src/components/coach/PageTips.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/coach/PageTips.jsx) — 0 matches
- No direct match detected.

## [src/components/coach/coachTours.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/coach/coachTours.js) — 0 matches
- No direct match detected.

## [src/components/coach/pageTips.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/coach/pageTips.js) — 0 matches
- No direct match detected.

## [src/components/comms/CommPreferences.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/comms/CommPreferences.jsx) — 2 matches
- L17: `base44.auth.me().then((me) => setPrefs(me.comm_prefs || {}));`
- L27: `await base44.auth.updateMe({ comm_prefs: next });`

## [src/components/comms/ComposeMessage.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/comms/ComposeMessage.jsx) — 4 matches
- L41: `base44.auth.me().then((me) =>`
- L42: `base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date").then(setCampaigns)`
- L49: `const me = await base44.auth.me();`
- L83: `const { data } = await base44.functions.invoke("sendCommunication", {`

## [src/components/comms/MessageHistory.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/comms/MessageHistory.jsx) — 2 matches
- L22: `base44.auth.me().then((me) =>`
- L23: `base44.entities.Message.filter({ created_by_id: me.id }, "-created_date", 100).then(setMessages)`

## [src/components/comms/templates.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/comms/templates.js) — 0 matches
- No direct match detected.

## [src/components/community/ActivityFeed.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/ActivityFeed.jsx) — 2 matches
- L22: `const res = await base44.functions.invoke("getCommunityFeed", { limit: 20 });`
- L40: `const res = await base44.functions.invoke("getCommunityFeed", { limit: 20, before: cursor });`

## [src/components/community/ActivityFeedCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/ActivityFeedCard.jsx) — 0 matches
- No direct match detected.

## [src/components/community/CommunityCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/community/CommunityCard.jsx) — 0 matches
- No direct match detected.
