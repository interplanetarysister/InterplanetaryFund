# Frontend non-UI components 35–51
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/agents/ChatGPTBuilderHandoff.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/ChatGPTBuilderHandoff.jsx) — 2 matches
- L31: `const result = await base44.functions.invoke("manageAdminBuilderWork", { mode: "list" });`
- L47: `const response = await base44.functions.invoke("manageAdminBuilderWork", {`

## [src/components/agents/PlatformFixReviewPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/PlatformFixReviewPanel.jsx) — 3 matches
- L26: `base44.functions.invoke("managePlatformIncidents",{mode:"list"}),`
- L27: `base44.functions.invoke("manageApprovedBuilderExecution",{mode:"readiness"}).catch(()=>null),`
- L40: `const response=await base44.functions.invoke("managePlatformIncidents",input);`

## [src/components/analytics/AlertCenter.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/AlertCenter.jsx) — 0 matches
- No direct match detected.

## [src/components/analytics/CampaignPerformance.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/CampaignPerformance.jsx) — 0 matches
- No direct match detected.

## [src/components/analytics/MetricsGrid.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/MetricsGrid.jsx) — 0 matches
- No direct match detected.

## [src/components/analytics/ReportCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/ReportCard.jsx) — 0 matches
- No direct match detected.

## [src/components/analytics/ReportsPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/ReportsPanel.jsx) — 2 matches
- L36: `base44.entities.ExecutiveReport.list("-created_date", 20).then(setReports).catch(() => {`
- L78: `const report = await base44.entities.ExecutiveReport.create({`

## [src/components/analytics/RevenueChart.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/analytics/RevenueChart.jsx) — 0 matches
- No direct match detected.

## [src/components/auth/SocialButtons.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/auth/SocialButtons.jsx) — 3 matches
- L27: `onClick={() => base44.auth.loginWithProvider("google", returnTo)}`
- L36: `onClick={() => base44.auth.loginWithProvider("apple", returnTo)}`
- L44: `onClick={() => base44.auth.loginWithProvider("facebook", returnTo)}`

## [src/components/brand/BrandHero.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/brand/BrandHero.jsx) — 0 matches
- No direct match detected.

## [src/components/brand/BrandLogo.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/brand/BrandLogo.jsx) — 0 matches
- No direct match detected.

## [src/components/brand/brand.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/brand/brand.js) — 0 matches
- No direct match detected.

## [src/components/campaigns/AICoach.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/AICoach.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/AIInstructionsStep.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/AIInstructionsStep.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/AIStoryGenerator.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/AIStoryGenerator.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignCard.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignCopyChoices.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignCopyChoices.jsx) — 0 matches
- No direct match detected.
