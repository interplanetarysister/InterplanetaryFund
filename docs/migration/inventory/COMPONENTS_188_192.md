# Frontend non-UI components 188–192
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/social/ShareToProfileDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/ShareToProfileDialog.jsx) — 4 matches
- L34: `base44.functions`
- L73: `const { data } = await base44.functions.invoke("createSocialPost", {`
- L90: `const { data: distributed } = await base44.functions.invoke("createDistributedPost", { campaign_id: campaignId, connection_id: conn.id, content: draft.trim() });`
- L92: `const { data: result } = await base44.functions.invoke("publishPost", { post_id: distributed.post.id, user_publish_authorized: true });`

## [src/components/social/SocialFeed.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/social/SocialFeed.jsx) — 6 matches
- L22: `base44.entities.SocialPost.list("-created_date", 20),`
- L23: `user?.id ? base44.functions.invoke("managePostInterest", {mode:"list"}).catch(()=>null) : Promise.resolve(null),`
- L40: `const unsubscribe = base44.entities.SocialPost.subscribe((event) => {`
- L58: `const more = await base44.entities.SocialPost.filter(query, "-created_date", 20);`
- L85: `const response = await base44.functions.invoke("managePostInterest", {mode:"set",post_id:post.id,field,value});`
- L96: `await base44.entities.SocialPost.delete(post.id);`

## [src/components/subscriptions/plans.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/subscriptions/plans.js) — 0 matches
- No direct match detected.

## [src/components/withdrawals/CollectAndWithdrawDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/withdrawals/CollectAndWithdrawDialog.jsx) — 3 matches
- L38: `const {data}=await base44.functions.invoke("prepareCollectAndWithdraw",campaign?.id?{campaign_id:campaign.id}:{});`
- L47: `const {data}=await base44.functions.invoke("authorizeCollectAndWithdraw",{authorization_id:prepared.authorization_id,confirm:true});`
- L49: `const execution=await base44.functions.invoke("executeCollectAndWithdraw",{authorization_id:prepared.authorization_id});`

## [src/components/withdrawals/WithdrawalDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/withdrawals/WithdrawalDialog.jsx) — 1 matches
- L28: `const res = await base44.functions.invoke("requestWithdrawal", {`
