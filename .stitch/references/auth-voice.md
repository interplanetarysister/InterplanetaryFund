# Secure sign-in and NEXUS voice entry

**Route:** `/login` (captured with `?returnTo=%2Fwhat-if`)  
**Owners:** `apps/web/src/pages/AuthPage.jsx`, `apps/web/src/components/agents/GlobalAgentCompanion.jsx`, `apps/web/src/components/agents/AgentSidePanel.jsx`  
**Shell:** Public `.ifund-auth` page inside the global companion. Unlike the exact homepage, sign-in routes keep the advisory launcher active; the opened panel is non-modal on desktop and a focus-trapped sheet on mobile.  
**Capture:** @html/auth-voice-desktop.html, @html/auth-voice-mobile.html, @screenshots/auth-voice-desktop.png, @screenshots/auth-voice-mobile.png. Captured unauthenticated with NEXUS opened by a local `ifund-open-agent` event; no credential, verification code, or question was entered or sent.

## Purpose

The sign-in screen must make secure authentication unambiguous while offering an accessible, optional route-finding helper. NEXUS can describe or open the correct screen, but it never accepts passwords, verification codes, account claims, or permission grants by voice.

## Captured anatomy

1. **Public chrome.** Brand logo links home and stays at the top of the narrow auth card.
2. **Card heading and status copy.** "Sign in securely to Interplanetary Fund." Registration adds the explicit email-verification and withdrawal 2FA notice; this capture uses sign-in.
3. **Broad-support explainer.** A cyan-tinted callout states that iFund supports donations, grants, work, donated essentials, equipment, volunteers, and trusted connections—not fundraising alone.
4. **NEXUS voice action.** "Use NEXUS voice navigation" dispatches `ifund-open-agent` for `nexus`. The adjacent copy says: "NEXUS can guide you to the correct screen by voice. Complete email verification and passwords securely on screen; never speak passwords or codes."
5. **Account form.** Email and password controls, secure submit, provider options when configured, and recovery/registration links remain below the advisory callout. They are never replaced by the chat panel.
6. **Advisory panel.** The same `AgentSidePanel` used elsewhere supplies identity, switcher, advisory log, availability status, voice controls, composer, and full-workspace link. A guest sees the sign-in availability reason; no answer is requested.

## Voice and safety contract

- Sign-in-first routing: local intent matching handles navigation routes only. Member-only commands such as dashboard, connections, update publishing, or external publishing open secure sign-in at `/login?returnTo=…` first and state that no account action occurred.
- Free-form questions continue through the existing authorized agent service; the panel rejects spoken password or one-time-code patterns.
- "Verify your account" guidance directs the member to the secure sign-in page or latest email link. Spoken words never verify identity.
- The panel's advisory disclaimer remains visible: it can explain or route, but it cannot post, pay, publish, grant OAuth access, or move money.

## Visual tokens

- Auth card: dark translucent panel with 28px radius, cyan/cyan-blue border tint, 28px mobile / 40px desktop padding.
- Advisory callout: `border-cyan-500/25`, `bg-cyan-500/10`, 12px radius, and 12px helper text.
- Voice button: 44px minimum, `rounded-lg`, `border-cyan-400/50`, cyan-100 label; focus ring remains 3px.
- Panel: `#090F1E` with `#EFF6FF` text and 2px cyan focus; see @references/agent-chat.md#agent-chat.

## Responsive and accessibility

The auth card keeps a single column at 390px. The NEXUS button is keyboard reachable before the form and has a visible label rather than icon-only shortcut. On mobile the opened side panel traps focus, closes with Escape, locks body scroll, and restores focus to the triggering control. No captured state contains a real credential.

## Source crosswalk

`AuthPage.jsx` · `GlobalAgentCompanion.jsx` · `AgentSidePanel.jsx` · `voiceSiteIntents.mjs` · `agentSpeech.mjs` · `AgentIdentityIcon.jsx`.

## Stitch variation guidance

Vary the card surface, callout illustration, and button treatment. Do not move credential entry into chat, soften the "never speak passwords or codes" notice, imply that voice command performed a member action, or hide the sign-in gate for member routes.
