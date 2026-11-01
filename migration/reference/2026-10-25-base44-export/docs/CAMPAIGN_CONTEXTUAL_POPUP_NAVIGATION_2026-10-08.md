# Campaign action popups: take people to the interaction

The Interplanetary Fund website must not put an action recommendation in a
popup, toast, notification or mission card without letting the user reach the
real place where that action can be performed.

## Connected user paths

- Campaign progress, announcements and updates -> the named campaign's update editor
- Cross-platform publishing or promotions -> the named campaign's distribution panel
- Outreach -> the named campaign's outreach controls
- Sharing and embedding -> its share kit
- Story, title, goal, image and campaign-detail improvements -> its edit details dialog
- AI instructions -> its editable campaign AI profile
- Campaign coaching -> its coaching panel
- Donations and payment activity -> its visible campaign funding panel
- Campaign inbox replies or comments -> the inbox filtered to that campaign
- Unfinished private drafts -> the saved campaign's draft editor and last step
- No campaign context -> only a supported high-confidence destination (e.g. Create Campaign), not a fabricated campaign URL

The same central destination policy is used by notification cards, the unified
inbox, Mission Control and action-related toast popups. Where an action has a
specific campaign ID, that ID is maintained across navigation.

**Accept & open** on a recommendation records the owner's decision before
navigating. It never silently posts or sends a message. **Go to action**
navigates without changing a recommendation's status.

## Access and safety

- Public campaign details remain viewable; editing is shown only to the owner
  or an authorized administrator. Backend saveCampaign still enforces ownership.
- Only known same-site application routes are used for automatic navigation;
  arbitrary external callback URLs and unsafe notification links are refused.
- Existing community, institution and admin notification deep links stay valid.
- Mobile and desktop fundraising sections both have functional scroll targets.
- Navigation waits for the selected campaign screen to load before scrolling,
  focusing the correct control rather than dropping the user at the page top.
- Creating, updating, sharing, posting, withdrawing or sending messages is never
  performed merely by following a popup's destination.

## Verification

Run: npm run verify:contextual-actions

The source tests cover campaign action categories, preserved private drafts,
notification links, safe local routing, and all actual component section anchors.
The production frontend build, lint, TypeScript check, and server-authoritative
campaign mutation regression also passed locally.

Published-browser checks after syncing main:
1. Analyze a campaign in Mission Control, then click "Improve story" and
   confirm its real edit dialog opens for that campaign.
2. Click "Post update" and confirm the update form is in view.
3. Accept an outreach recommendation and confirm it opens that campaign's
   outreach controls, without starting a post automatically.
4. Open a donation notification and confirm the funding card scrolls into view
   on desktop and phone.
5. Open a campaign comment alert and confirm the inbox is filtered to that
   campaign.
6. Ensure the notification links to community and institution detail pages still
   open normally, and arbitrary external URLs cannot cause automatic navigation.

Provider operations and published mobile-browser behavior are not established
by local source-level tests alone.
