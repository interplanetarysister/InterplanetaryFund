# Frontend non-UI components 154–170
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/ops/TreasurySummary.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/TreasurySummary.jsx) — 0 matches
- No direct match detected.

## [src/components/ops/inAppAgentRoster.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/inAppAgentRoster.js) — 0 matches
- No direct match detected.

## [src/components/payments/ApplePayButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/ApplePayButton.jsx) — 3 matches
- L48: `const { data: config } = await base44.functions.invoke("getPayPalConfig", {});`
- L115: `const { data: order } = await base44.functions.invoke("createPayPalOrder", {`
- L130: `const { data: captured } = await base44.functions.invoke("capturePayPalOrder", {`

## [src/components/payments/CashAppDonateButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/CashAppDonateButton.jsx) — 0 matches
- No direct match detected.

## [src/components/payments/CryptoDonateOption.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/CryptoDonateOption.jsx) — 0 matches
- No direct match detected.

## [src/components/payments/GooglePayButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/GooglePayButton.jsx) — 3 matches
- L35: `const { data: config } = await base44.functions.invoke("getPayPalConfig", {});`
- L62: `const { data: order } = await base44.functions.invoke("createPayPalOrder", {`
- L81: `const { data: result } = await base44.functions.invoke("capturePayPalOrder", {`

## [src/components/payments/PayPalCheckoutButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/PayPalCheckoutButton.jsx) — 3 matches
- L28: `const { data: config } = await base44.functions.invoke("getPayPalConfig", {});`
- L42: `const { data } = await base44.functions.invoke("createPayPalOrder", {`
- L57: `const { data: result } = await base44.functions.invoke("capturePayPalOrder", {`

## [src/components/payments/PayPalDonateButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/PayPalDonateButton.jsx) — 0 matches
- No direct match detected.

## [src/components/payments/paypalScripts.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/payments/paypalScripts.js) — 0 matches
- No direct match detected.

## [src/components/platform/BlueprintPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/BlueprintPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/platform/ConstitutionPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/ConstitutionPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/platform/FeatureFlagsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/FeatureFlagsPanel.jsx) — 3 matches
- L48: `base44.entities.FeatureFlag.list("-created_date", 100).then(setFlags).catch(() => { setFlags([]); setError("Could not load feature flags. Reload and retry."); });`
- L63: `const { data } = await base44.functions.invoke("manageFeatureFlag", form);`
- L89: `const { data } = await base44.functions.invoke("manageFeatureFlag", { id: flag.id, enabled });`

## [src/components/platform/FraudControlPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/FraudControlPanel.jsx) — 6 matches
- L25: `base44.entities.Withdrawal.filter({ status: "under_review" }),`
- L26: `base44.entities.Campaign.filter({ status: "paused" }),`
- L42: `const { data } = await base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: w.id });`
- L52: `const { data } = await base44.functions.invoke("requestWithdrawal", { action: "release_reservation", withdrawal_id: w.id, confirm_not_paid: true, admin_note: denyReason });`
- L63: `const { data } = await base44.functions.invoke("adminCampaignControl", { action: "restore", campaign_id: c.id });`
- L73: `const { data } = await base44.functions.invoke("adminCampaignControl", { action: "pause", campaign_id: campaignId, reason: freezeReason });`

## [src/components/platform/KnowledgePanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/KnowledgePanel.jsx) — 2 matches
- L34: `base44.entities.KnowledgeArticle.list("-created_date", 100).then(setArticles).catch(() => {`
- L59: `const { data } = await base44.functions.invoke("createKnowledgeArticle", { ...form, summary });`

## [src/components/platform/LiveProvidersPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/LiveProvidersPanel.jsx) — 3 matches
- L37: `const { data } = await base44.functions.invoke("getLiveProviderStatus", {});`
- L49: `const { data } = await base44.functions.invoke("manageFeatureFlag", {`
- L64: `const { data } = await base44.functions.invoke("manageFeatureFlag", { id: feature.flag_id, enabled });`

## [src/components/platform/OperationsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/OperationsPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/platform/ServiceHealthPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/platform/ServiceHealthPanel.jsx) — 8 matches
- L9: `{ name: "Identity & Auth", check: () => base44.auth.me() },`
- L10: `{ name: "Campaign OS", check: () => base44.entities.Campaign.list("-created_date", 1) },`
- L11: `{ name: "Donation & Financial OS", check: () => base44.entities.Donation.list("-created_date", 1) },`
- L12: `{ name: "Communications OS", check: () => base44.entities.Message.list("-created_date", 1) },`
- L13: `{ name: "Mission Control", check: () => base44.entities.Recommendation.list("-created_date", 1) },`
- L14: `{ name: "Community OS", check: () => base44.entities.Community.list("-created_date", 1) },`
- L15: `{ name: "Institution OS", check: () => base44.entities.Institution.list("-created_date", 1) },`
- L16: `{ name: "Platform Intelligence", check: () => base44.entities.ExecutiveReport.list("-created_date", 1) },`
