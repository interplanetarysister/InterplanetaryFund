# Dashboard

**Route:** `/dashboard`  
**Owner:** `apps/web/src/pages/Dashboard.jsx`  
**Shell:** Inside `Layout` (dark sidebar, mobile header, workspace bar, bottom nav, global agent launcher).  
**Capture:** @html/dashboard-desktop.html, @html/dashboard-mobile.html, @screenshots/dashboard-desktop.png, @screenshots/dashboard-mobile.png. Captured unauthenticated; the signed-in anatomy below is source-derived and must not be called browser-verified.

## Purpose

The dashboard is the private operating desk. It orients the member, offers a fast prompt and shortcuts, then surfaces campaign status, the nine-specialist team, followed activity, referrals, and events. Density is acceptable here, but hierarchy must keep the next action and verified facts dominant.

## Captured guest state

The local capture shows the unauthenticated fail-closed shell: workspace navigation, "Account services are unavailable. Return to sign in.", platform-support notice, and footer. It contains no private dashboard headings, campaign totals, follow activity, referral data, or signed-in hero. This is the correct guest behavior; the signed-in anatomy below is source-derived only.

## Signed-in section order

1. **Hero.** `.ifund-dashboard-hero` with cyan `.ifund-dashboard-eyebrow`, Fraunces headline "Make your what if happen.", lede, `.ifund-dashboard-primary` Start a Mission/campaign (flag-dependent), `.ifund-dashboard-secondary` "Ask your AI Team" (dispatches `ifund-open-agent` with NEXUS), and a decorative 170px `Sparkles` glyph. Orbit rings are a `::before` layer at 0.48 opacity.
2. **PromptComposer.** `id="dashboard-prompt"`, hero variant, note that drafting is private by default.
3. **What If module.** Conditional `.ifund-dashboard-card.ifund-dashboard-module` with "Open What If" / "My Missions" when the environment flag is enabled. The flag remains off in the captured build.
4. **Shortcuts.** `.ifund-dashboard-shortcuts` — My Missions/My campaigns, Discover, Fund your Mission, Messaging, Command Center. 2 columns, 4 from 800px, 1 at 390px; 64px minimum cards.
5. **Campaign snapshot.** 2→3 column `.ifund-dashboard-stat` tiles for Saved / Active / Drafts counts derived from `myCampaigns`.
6. **AI team module.** "Nine specialists, one workspace" with `AGENT_WORKSPACES` cards in 2/3/5 columns, `AgentIdentityIcon size=40`, "Meet the team" link, and permissions note.
7. **Two-column lower area.** `lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]` with "Your fundraising hub" mini-links and `FollowFeed`.
8. **Referral and events.** `ReferralRewards` and `EventsDashboardSection`.
9. **Campaign grids.** Saved and discover campaign sections render only when arrays are non-empty; inline `role="alert"` errors remain in place.

## Visual tokens

- Hero: `#081322 → #18233C` linear gradient with purple `#3B3A85A8` and teal `#12687477` radial fields, 24px radius, 1px `#466282` border, white text.
- Eyebrow: `#0E8CAA`, 10px/800/0.16em uppercase.
- Primary action: `#77E7E6` fill, `#07172B` text, 44px height, 13px radius.
- Secondary action: `border #94A6C1`, `bg #FFFFFF12`, white text.
- Modules: 21px radius, near-white gradient in light mode, midnight/purple in dark, 37px soft shadow.
- Stats: 1.15rem radius, translucent white/blue gradient, 1px `rgb(177 228 255 / .23)` border.
- Focus: 3px `#6BE9DC` outline for dashboard shortcuts, mini-links, and agent actions.

## States to preserve

- Session loading: `role="status"` "Verifying your session…".
- Guest: public welcome view with explicit legal/withdrawal notes.
- Account services error: `role="alert"` "Account services are unavailable" with sign-in link.
- Campaign query errors inline; campaign sections omitted when empty.
- FollowFeed loading, error, empty ("Your followed campaigns will appear here"), and populated states.
- Referral/events modules own status states.
- "Ask your AI Team" opens advisory chrome; it does not send a question or grant access.

## Responsive and accessibility

`max-w-7xl`, `px-4 sm:px-8`, `py-6 sm:py-9`. Grids step 2→3→5 and the lower area splits at `lg`. Below 390px the shortcut grid becomes one column and hero padding tightens to 18px. All controls remain at least 44px; text wraps rather than overflowing. Guest and error states use real ARIA roles, not color alone.

## Source crosswalk

`Dashboard.jsx` · `PromptComposer.jsx` · `CampaignCard.jsx` · `FollowFeed.jsx` · `ReferralRewards.jsx` · `EventsDashboardSection.jsx` · `AgentIdentityIcon.jsx` · `AGENT_WORKSPACES` · `styles/agent-companion.css` · `styles/ifund-next-cosmic.css` · `Layout.jsx`.

## Stitch variation guidance

Vary module density, hero art, stat presentation, and card rhythm. Keep the guest phase fail-closed, do not show invented campaign totals, and do not make the AI team module imply that direct answers are enabled without membership, permission, and gateway checks.
