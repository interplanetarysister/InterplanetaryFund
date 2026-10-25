# Frontend non-UI components 52–68
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/campaigns/CampaignEmbeddedText.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignEmbeddedText.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignFundingCard.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignFundingCard.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignHealth.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignHealth.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignTabs.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignTabs.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CampaignTranslation.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignTranslation.jsx) — 4 matches
- L35: `base44.functions.invoke("translateCampaign", { action: "list", campaign_id: campaign.id })`
- L58: `const { data } = await base44.functions.invoke("translateCampaign", {`
- L74: `const { data } = await base44.functions.invoke("translateCampaign", {`
- L93: `const { data } = await base44.functions.invoke("translateCampaign", {`

## [src/components/campaigns/CampaignVoiceAssistant.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CampaignVoiceAssistant.jsx) — 0 matches
- No direct match detected.

## [src/components/campaigns/CashAppSettings.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CashAppSettings.jsx) — 1 matches
- L16: `const { data } = await base44.functions.invoke("updateCampaignSettings", { campaign_id: campaign.id, patch: { cashapp_tag: tag.replace(/^\$/, "") } });`

## [src/components/campaigns/CrossPlatformTotals.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CrossPlatformTotals.jsx) — 1 matches
- L13: `base44.functions`

## [src/components/campaigns/CryptoCampaignSettings.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/CryptoCampaignSettings.jsx) — 1 matches
- L15: `const { data } = await base44.functions.invoke("updateCampaignSettings", {`

## [src/components/campaigns/DeleteCampaignButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/DeleteCampaignButton.jsx) — 1 matches
- L28: `const { data } = await base44.functions.invoke("deleteCampaign", { campaign_id: campaign.id });`

## [src/components/campaigns/DonateDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/DonateDialog.jsx) — 2 matches
- L53: `base44.functions.invoke("getPaymentCapabilities", {})`
- L69: `const { data } = await base44.functions.invoke("recordDonation", {`

## [src/components/campaigns/EditAIInstructionsDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/EditAIInstructionsDialog.jsx) — 1 matches
- L18: `const { data } = await base44.functions.invoke("updateCampaignSettings", { campaign_id: campaign.id, patch: { ai_profile: profile } });`

## [src/components/campaigns/EditCampaignDetailsDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/EditCampaignDetailsDialog.jsx) — 1 matches
- L47: `const { data } = await base44.functions.invoke("saveCampaign", {`

## [src/components/campaigns/FeaturedCarousel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/FeaturedCarousel.jsx) — 1 matches
- L14: `base44.entities.Campaign.filter({ is_featured: true, status: "active" }, "-raised_amount", 6)`

## [src/components/campaigns/FollowButton.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/FollowButton.jsx) — 5 matches
- L21: `const me = await base44.auth.me();`
- L24: `const existing = await base44.entities.FollowedCampaign.filter({ user_id: me.id, campaign_id: campaign.id });`
- L40: `if (!meId) { base44.auth.redirectToLogin(window.location.pathname); return; }`
- L47: `const { data } = await base44.functions.invoke("toggleCampaignFollow", { campaign_id: campaign.id });`
- L66: `const { data } = await base44.functions.invoke("toggleCampaignFollow", { campaign_id: campaign.id });`

## [src/components/campaigns/FollowPrefsDialog.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/FollowPrefsDialog.jsx) — 1 matches
- L32: `const { data } = await base44.functions.invoke("updateFollowPreferences", { follow_id: follow.id, notification_prefs: prefs });`

## [src/components/campaigns/ImportedCampaignSync.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/campaigns/ImportedCampaignSync.jsx) — 2 matches
- L11: `const rows=await base44.entities.ExternalCampaignImport.filter({campaign_id:campaign.id},"-updated_date",1).catch(()=>[]);`
- L18: `const synced=await base44.functions.invoke("syncImportedCampaign",{import_id:record.id,request_id:crypto.randomUUID()});`
