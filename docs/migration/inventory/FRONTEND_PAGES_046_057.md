# Frontend pages 46–57
Static callsite scan; no secrets copied. Each hit records file and line, not proof of runtime activity.

## [src/pages/Platform.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Platform.jsx) (1 direct matching lines)
- L21: `base44.auth.me().then(setUser);`

## [src/pages/Privacy.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Privacy.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/Profile.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Profile.jsx) (3 direct matching lines)
- L27: `const me = await base44.auth.me();`
- L47: `await base44.auth.updateMe({ photo_url: url });`
- L59: `await base44.auth.logout("/login");`

## [src/pages/PublicProfile.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/PublicProfile.jsx) (1 direct matching lines)
- L13: `base44.functions.invoke("managePublicProfile",{mode:"read",user_id:id}).then(r=>{`

## [src/pages/PublicationArticle.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/PublicationArticle.jsx) (1 direct matching lines)
- L21: `base44.functions.invoke("manageOfficialPublications", { mode: "item", id })`

## [src/pages/Register.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Register.jsx) (5 direct matching lines)
- L34: `await base44.auth.register({ email, password });`
- L47: `const result = await base44.auth.verifyOtp({ email, otpCode });`
- L49: `base44.auth.setToken(result.access_token);`
- L52: `await base44.auth.updateMe({ username: username.trim() });`
- L73: `await base44.auth.resendOtp(email);`

## [src/pages/ResetPassword.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/ResetPassword.jsx) (1 direct matching lines)
- L29: `await base44.auth.resetPassword({ resetToken, newPassword });`

## [src/pages/Social.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Social.jsx) (4 direct matching lines)
- L32: `const maybeUser = await base44.auth.me().catch(() => null);`
- L44: `base44.functions.invoke("listConnections", {}),`
- L45: `base44.entities.Campaign.filter({}).catch(() => []),`
- L46: `base44.functions.invoke("listFundraisingProviderCapabilities", {}).catch(() => ({ data: { providers: [] } })),`

## [src/pages/Subscriptions.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Subscriptions.jsx) (12 direct matching lines)
- L24: `base44.functions.invoke("getPayPalSubscriptionOptions", {}).catch(() => ({ data: null })),`
- L25: `base44.auth.me().catch(() => null),`
- L43: `base44.functions.invoke("confirmPayPalSubscription", { subscription_id: id })`
- L69: `const { data } = await base44.functions.invoke("createPayPalSubscriptionCheckout", { tier: plan.id, interval, origin: window.location.origin });`
- L82: `const { data } = await base44.functions.invoke("startPremiumTrial", {});`
- L95: `const { data } = await base44.functions.invoke("cancelPayPalSubscription", {});`
- L114: `const { data: plan } = await base44.functions.invoke("verifyOwnerPayPalBasicPlan", {});`
- L118: `const { data: hook } = await base44.functions.invoke("setupPayPalSubscriptionWebhook", {});`
- L120: `const { data: enabled } = await base44.functions.invoke("activateSubscriptionCheckout", {});`
- L140: `const { data: catalog } = await base44.functions.invoke("syncPayPalSubscriptionCatalog", {});`
- L142: `const { data: hook } = await base44.functions.invoke("setupPayPalSubscriptionWebhook", {});`
- L144: `const { data: enabled } = await base44.functions.invoke("activateSubscriptionCheckout", {});`

## [src/pages/SustainabilityAdmin.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/SustainabilityAdmin.jsx) (4 direct matching lines)
- L51: `base44.entities.Campaign.filter({ category: "environment", status: "active" }, "-created_date", 100),`
- L52: `base44.entities.SustainabilityAudit.list("-created_date", 25),`
- L76: `await base44.entities.SustainabilityAudit.create({`
- L111: `await base44.entities.SustainabilityAudit.create({`

## [src/pages/Terms.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Terms.jsx) (0 direct matching lines)
- No direct Base44 call detected; may call wrappers.

## [src/pages/Withdrawals.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/pages/Withdrawals.jsx) (8 direct matching lines)
- L49: `const me = await base44.auth.me();`
- L52: `base44.functions.invoke("getFeatureAvailability", {}).catch(() => ({ data: null })),`
- L53: `base44.functions.invoke("getPaymentCapabilities", {}).catch(() => ({ data: null })),`
- L56: `const owned = await base44.entities.Campaign.filter({ created_by_id: me.id });`
- L59: `const balanceRes = await base44.functions.invoke("getCampaignWithdrawalBalance", { campaign_id: c.id });`
- L72: `const w = await base44.entities.Withdrawal.filter({ owner_user_id: me.id });`
- L76: `const rq = await base44.entities.Withdrawal.filter({ status: "under_review" });`
- L91: `const res = await base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: id });`
