# Frontend non-UI components 120–136
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/inbox/IndependentAdminMail.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/inbox/IndependentAdminMail.jsx) — 0 matches
- No direct match detected.

## [src/components/inbox/VerificationInboxPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/inbox/VerificationInboxPanel.jsx) — 4 matches
- L14: `const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "list" });`
- L21: `base44.functions.invoke("manageVerificationMailbox", { mode: "list" })`
- L31: `const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "create", platform: platform || "general" });`
- L42: `const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "open", mail_id: id });`

## [src/components/institutions/ApplicationsTab.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/ApplicationsTab.jsx) — 2 matches
- L16: `base44.functions.invoke("listInstitutionApplications", { institution_id: institution.id })`
- L29: `const { data } = await base44.functions.invoke("decideGrantApplication", {`

## [src/components/institutions/ApplyDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/ApplyDialog.jsx) — 3 matches
- L25: `const me = await base44.auth.me();`
- L26: `setCampaigns(await base44.entities.Campaign.filter({ created_by_id: me.id }));`
- L41: `const { data } = await base44.functions.invoke("applyInstitutionOpportunity", {`

## [src/components/institutions/CreateInstitutionDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/CreateInstitutionDialog.jsx) — 1 matches
- L33: `const { data } = await base44.functions.invoke("createInstitution", form);`

## [src/components/institutions/InstitutionCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/InstitutionCard.jsx) — 0 matches
- No direct match detected.

## [src/components/institutions/InstitutionProfile.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/InstitutionProfile.jsx) — 0 matches
- No direct match detected.

## [src/components/institutions/MyApplications.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/MyApplications.jsx) — 2 matches
- L12: `const me = await base44.auth.me();`
- L13: `setApps(await base44.entities.GrantApplication.filter({ applicant_user_id: me.id }, "-created_date", 10));`

## [src/components/institutions/OpportunitiesTab.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/OpportunitiesTab.jsx) — 4 matches
- L18: `const me = await base44.auth.me();`
- L20: `base44.entities.InstitutionOpportunity.filter({ institution_id: institution.id }, "-created_date"),`
- L21: `base44.entities.GrantApplication.filter({ institution_id: institution.id, applicant_user_id: me.id }),`
- L35: `await base44.entities.InstitutionOpportunity.update(opp.id, { status });`

## [src/components/institutions/PublishOpportunityForm.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/PublishOpportunityForm.jsx) — 1 matches
- L20: `const { data } = await base44.functions.invoke("publishInstitutionOpportunity", {`

## [src/components/institutions/institutionTypes.js](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/institutions/institutionTypes.js) — 0 matches
- No direct match detected.

## [src/components/media/MediaUpload.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/media/MediaUpload.jsx) — 0 matches
- No direct match detected.

## [src/components/mission/AutomationPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/AutomationPanel.jsx) — 4 matches
- L28: `const me = await base44.auth.me();`
- L31: `base44.entities.DistributedPost.filter({ created_by_id: me.id }, "-updated_date", 25),`
- L32: `base44.entities.AgentActivity.filter({ owner_user_id: me.id }, "-created_date", 25),`
- L33: `base44.functions.invoke("trackAgentConversation", { mode: "list" }),`

## [src/components/mission/BriefingPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/BriefingPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/mission/ConfidenceBadge.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/ConfidenceBadge.jsx) — 0 matches
- No direct match detected.

## [src/components/mission/OpportunitiesPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/OpportunitiesPanel.jsx) — 4 matches
- L26: `const me = await base44.auth.me();`
- L27: `const items = await base44.entities.Opportunity.filter({ created_by_id: me.id }, "-created_date", 50);`
- L37: `await base44.functions.invoke("generateIntelligence", { mode: "opportunities" });`
- L48: `const { data } = await base44.functions.invoke("updateMissionItemStatus", { kind: "opportunity", id: opp.id, status });`

## [src/components/mission/RecommendationCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/mission/RecommendationCard.jsx) — 0 matches
- No direct match detected.
