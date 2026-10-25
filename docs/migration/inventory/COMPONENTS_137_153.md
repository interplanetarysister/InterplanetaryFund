# Frontend non-UI components 137–153
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/mission/RecommendationsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/RecommendationsPanel.jsx) — 4 matches
- L11: `const me = await base44.auth.me();`
- L13: `base44.entities.Recommendation.filter({ created_by_id: me.id }, "-created_date", 30),`
- L14: `base44.entities.Recommendation.filter({ owner_user_id: me.id }, "-created_date", 30),`
- L30: `const { data } = await base44.functions.invoke("updateMissionItemStatus", { kind: "recommendation", id: rec.id, status });`

## [src/components/mobile/OfflineBanner.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mobile/OfflineBanner.jsx) — 0 matches
- No direct match detected.

## [src/components/mobile/PullToRefresh.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mobile/PullToRefresh.jsx) — 0 matches
- No direct match detected.

## [src/components/mobile/Skeletons.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mobile/Skeletons.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/AutomateStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/AutomateStep.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/CompleteStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/CompleteStep.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/ConnectStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/ConnectStep.jsx) — 1 matches
- L20: `base44.functions.invoke("getPaymentCapabilities", {})`

## [src/components/onboarding/EngineStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/EngineStep.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/OnboardingShell.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/OnboardingShell.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/ProfileStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/ProfileStep.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/WelcomeStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/WelcomeStep.jsx) — 0 matches
- No direct match detected.

## [src/components/onboarding/onboardingSteps.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/onboarding/onboardingSteps.js) — 0 matches
- No direct match detected.

## [src/components/ops/FundMigrationDashboard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/FundMigrationDashboard.jsx) — 6 matches
- L34: `const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "all", initiator_type: "admin", request_id: crypto.randomUUID() });`
- L36: `const c = await base44.entities.Campaign.list("-raised_amount", 100);`
- L47: `const me = await base44.auth.me();`
- L55: `base44.entities.Campaign.list("-raised_amount", 100),`
- L56: `base44.entities.ExternalFundMigrationRecord.filter({ state: "recorded" }),`
- L111: `const { data } = await base44.functions.invoke("recordExternalFundMigration", {`

## [src/components/ops/OpsAgentCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/OpsAgentCard.jsx) — 0 matches
- No direct match detected.

## [src/components/ops/OpsCampaignCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/OpsCampaignCard.jsx) — 0 matches
- No direct match detected.

## [src/components/ops/OpsReports.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/OpsReports.jsx) — 0 matches
- No direct match detected.

## [src/components/ops/PendingDonationReview.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ops/PendingDonationReview.jsx) — 2 matches
- L7: `const load=useCallback(async()=>{setLoading(true);setError("");try{const all=await base44.entities.Donation.filter({payment_verified:false},"-created_date",200);setRows(Array.isArray(all)?al`
- L13: `const {data}=await base44.functions.invoke("requestWithdrawal",{action:"clear",donation_id:row.id});`
