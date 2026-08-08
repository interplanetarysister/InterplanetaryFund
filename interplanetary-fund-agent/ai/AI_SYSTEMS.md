# Interplanetary Fund — AI Systems
**Version:** 1.0.0

## AI Campaign Generation
- 6-step wizard: Title → Category → Goal → Story → Image → AI Generation
- Generates: FAQ, social captions, press releases, SEO content, donor thank-yous, image prompts, tags
- Style: afro-punk cyber-punk aesthetic
- Implementation: convex/aiCampaignGen.ts
- Frontend: src/pages/AICampaignWizard.tsx

## Image Generation
- Provider: Pollinations.ai (FREE, no credits)
- Implementation: convex/imageGen.ts
- Generates cover images for campaigns from AI prompts
- No Base44 credits used

## Outreach & Content
- Auto post generation: convex/postContent.ts (daily 8am PT)
- Outreach strategy improvement: convex/outreach.ts (every 6 hours)
- Facebook group discovery: convex/facebook.ts (every 4 hours)
- Anti-spam guardrails: convex/antiSpam.ts

## Agent Research
- Browserbase integration: convex/browserbase.ts
- Research sprints: convex/research.ts (every 12 hours)
- Per-agent browser research (every 6 hours)

## AI Content Fields (stored on campaigns)
- aiFaq — Frequently asked questions
- aiSocialCaptions — Social media captions (JSON string)
- aiPressRelease — Press release text
- aiDonorThankYou — Donor thank you message
- aiSeoContent — SEO-optimized content
- aiImagePrompt — Image generation prompt
- aiTags — Campaign tags for discovery
- aiGenerated — Boolean flag for AI-generated campaigns

## AI Profile Fields (monitored campaigns)
- aiTone — Communication tone
- aiIdealDonors — Target donor description
- aiInterestedOrgs — Interested organizations
- aiPlatforms — Target platforms
- aiPriority — Priority level (emotional, professional, other)
