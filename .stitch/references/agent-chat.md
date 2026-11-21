# Agent chat

**Surfaces:** persistent `AgentSidePanel` and in-page AgentsTeam console.  
**Owners:** `apps/web/src/components/agents/GlobalAgentCompanion.jsx`, `AgentSidePanel.jsx`, `apps/web/src/pages/AgentsTeam.jsx`  
**Shell:** `GlobalAgentCompanion` wraps the whole router. A persistent Log in / Account launcher is visible everywhere; the Ask IFund launcher, side panel, and `ifund-open-agent` handler are active on every route except the exact homepage. `SiteTour` is also mounted here for eligible signed-in members.
**Capture:** @html/agent-chat-desktop.html, @html/agent-chat-mobile.html, @screenshots/agent-chat-desktop.png, @screenshots/agent-chat-mobile.png. Opened locally on `/agents` by dispatching `ifund-open-agent` for NEXUS. No question was typed or sent. The sign-in variant is captured separately in @html/auth-voice-desktop.html and @html/auth-voice-mobile.html and documented in @references/auth-voice.md#secure-sign-in-and-nexus-voice-entry.

## Purpose

The chat is an advisory companion, not an autonomous operator. It stays available while the member browses, makes the selected specialist obvious, exposes access state plainly, and always returns to the full workspace.

## Two consoles, one identity system

- **Persistent side panel:** On non-home routes, the "Ask IFund" launcher → `GlobalAgentCompanion` event listener → `AgentSidePanel`. This is the docked/modal chat captured here; on `/` both the launcher and panel are suppressed and external open events are ignored.
- **In-page console:** `AgentsTeam.jsx` owns `#ask-mission-control` with its own textarea, specialist select, recommendation panel, and reply article. It is documented in @references/agent-team-overview.md#ai-team-overview.
- Both use `AGENT_IDENTITIES`, `AgentIdentityIcon`, consultation trails, advisory disclaimers, and the same fail-closed language.

## Side-panel anatomy

1. **Header.** Agent icon, name, role, 44px close button. Intro: "Keep browsing iFund while this advisory panel stays open."
2. **Agent switcher.** `.ifund-agent-panel-choices`, horizontally scrollable, 58px min-height tiles, `aria-pressed`, all identities available.
3. **Message log.** `.ifund-agent-panel-messages[role="log"][aria-live="polite"]` on `#151F30` with `#304057` border. Welcome empty state, user bubbles (`.user`, `#175D7E`, right), answers (`.answer`, `#26364D`, left), consultation trail, "Checking your question…", and `role="alert"` request/voice errors.
4. **Composer.** Quick site-nav links, availability status with sign-in or plans link, dictation/voice controls, "Listening… review before sending", textarea `#ifund-side-agent-question` (maxLength 2000), send button, "Open full workspace", and voice-optional disclaimer. Spoken local navigation intents are interpreted before a question is composed: member-only routes open secure sign-in with a return URL, and the panel announces that no publication or outside post occurred. A goal spoken by a guest can navigate to a private, unsaved `/what-if` draft; it never creates an account or campaign.
5. **Desktop vs mobile.** Desktop: inline `flex: 0 0 clamp(335px,36vw,520px)`, left border, no page overlay. Below 767px: fixed right sheet `min(100vw,480px)`, `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, body scroll lock, focus restored on unmount. At 390px padding tightens but controls remain 44px.

## Visual tokens

- Panel: `#090F1E` background, `#EFF6FF` text, `#35435B` left border, `-10px 0 35px #0002` shadow.
- Floating controls: fixed bottom-right; the adjacent Log in / Account and Ask IFund launchers use `#101B37`, cyan borders, and cyan focus outlines and sit above the bottom nav on phones. `QuickActions` occupies the opposite bottom-left corner.
- Switcher: selected `#0C293D` with `#5FE6ED` border; 9px uppercase labels with `overflow-wrap:anywhere`.
- Focus: 2px `#70E3EF` in the panel; 3px high-contrast focus for close/tool/send controls.
- Motion: message scroll behavior becomes auto under reduced motion.

## Gate and state copy

Direct answers require `/api/agents/team/status` `configured === true`, a verified active `ifund_story_subscription` (integer level ≥ 1), a saved owner-scoped AI permission preference, a verified email-confirmed session, and an 8–2000 character question. Consent changes abort in-flight requests; account switches clear messages; campaign handoff rechecks ownership.

Preserve explicit states:

- "Checking agent access…" and reason strings for unauthenticated, deployment-unavailable, membership, permission, and verification failure.
- Empty welcome message; "Checking your question…"; request and voice alerts.
- Mic-start, unsupported-browser, listening/review-before-sending states.
- Sign-in-first voice guidance for dashboard, connections, update publishing, and external publishing; no member action is performed by the utterance.
- Spoken password/verification-code refusal with a return to the secure form.
- Advisory disclaimer: no posting, paying, publishing, or moving money.
- "Open full workspace" link back to `/agents`.

## Accessibility

The panel is non-modal on desktop and modal on mobile. Message log is live; status and errors are textual. Focus order runs header → switcher → messages → composer. Escape closes only the mobile sheet. Agent switcher state is exposed with `aria-pressed`; voice controls have accessible names. No private conversation text is stored in public training files.

## Source crosswalk

`GlobalAgentCompanion.jsx` · `AgentSidePanel.jsx` · `AgentIdentityIcon.jsx` · `AGENT_IDENTITIES` · `voiceSiteIntents.mjs` · `agentSpeech.mjs` · `TeamConversationHistory.jsx` · `askIFundAgent` · `canAskAgentWithSavedPermission` · `styles/agent-companion.css` · `styles/agent-team.css`.

## Stitch variation guidance

Vary bubble radius, panel texture, switcher treatment, and empty-state illustration. Do not remove availability copy, advisory disclaimers, voice status, focus trap, consultation trail, or the full-workspace link. Never show a successful answer in a design mock as proof that hosted inference, membership, permission, or provider grants are active.
