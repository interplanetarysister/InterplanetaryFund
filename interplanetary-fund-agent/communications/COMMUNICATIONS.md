# Interplanetary Fund — Communications System
**Version:** 1.0.0

## Channels
1. *In-App Notifications* — notifications table, convex support functions
2. *Email* — Resend integration (needs API key), convex/emailSystem.ts
3. *Social Media* — Facebook groups (63), distributed posts
4. *WhatsApp* — Connected via Base44 channel (for agent-to-Michelle)

## Notification System
- getNotifications — Fetch user notifications
- markNotificationRead — Mark as read
- Types: campaign update, donation received, follower, system
- Frontend: src/pages/Notifications.tsx

## Email System
- convex/emailSystem.ts — Send emails via Resend
- convex/emailCapture.ts — Capture email subscribers
- emailSubscribers table — Subscriber list
- emailSubscribers table — Subscriber list
- STATUS: Needs Resend API key for outbound delivery
- Donor email queue ready

## Social Outreach
- Auto post generation: Daily 8am PT
- Facebook group discovery: Every 4 hours
- Outreach strategy improvement: Every 6 hours
- Anti-spam guardrails enforced
- Content: AI-generated social captions, press releases
