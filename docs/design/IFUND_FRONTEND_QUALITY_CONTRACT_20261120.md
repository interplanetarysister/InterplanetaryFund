# iFund front-end quality bar — permanent visual contract

**Owner directive, November 20, 2026.** The standard for every public screen, registered member screen, modal, admin screen, agent UI, responsive state and installed mobile app is polished, coherent, premium software. This contract requires real implementation review, not invented claims about the design team.

## Design language

- **Professional, calm, intentional:** one coherent dark/light palette, refined typography, predictable spacing, consistent elevations, precise alignment, measured motion and obvious navigation. Fundraising and money data are exceptionally readable.
- **Cosmic Geometry:** centered, mathematically symmetric geometry derived from a shared system. Avoid randomly placed circles, lopsided leaves, asymmetrical decorative overlays, saturated noise, artificial glitter, cheap-looking gradients, competing patterns and repeated ornamental clutter.
- **Hierarchy:** one unmistakable primary action per screen, clear headings and labels, scannable grouped content, purposeful breathing room and no overlapping sticky or floating controls.
- **Shared components:** reuse existing source components/tokens rather than silently cloning or overriding them. If multiple files have distinct consumers, preserve each and verify import precedence.
- **User-first UX:** the minimum number of necessary clicks/fields, predictable responsive behavior, feedback states, empty/error/loading/retry paths, accessible navigation and conversational nontechnical copy.
- **Real, honest content:** never invent campaign funding totals, partnerships, user approvals, provider availability or completed agent operations to make a mockup look full.

## Acceptance requirements for any customer-facing frontend change

1. Inspect the current component and CSS import cascade **before** modification, including desktop + mobile fixed-position controls, safe areas, drawers, scrollable content and any global companion UI.
2. Verify 320px, 390px, 768px and desktop widths; account for device safe-area insets, collapsed/expanded quick actions, chat open/closed, light/dark modes and keyboard/focus interactions.
3. No two primary controls may collide or cover each other's hit areas. Fixed layers must not obscure navigation, forms, checkout, toasts or legal links.
4. Meet WCAG AA intent: meaningful focus indication, contrast, semantic labels, 44px touch controls where practical, reduced-motion handling and no horizontal overflow.
5. Use source-visible design tokens and responsive primitives; keep decorative assets local and lightweight, avoid paid assets/new runtime dependencies for appearance.
6. Inspect client browser rendering **after** implementation and repair identified defects before marking ready. Automated CSS tests and a green bundle alone are insufficient visual QA.
7. Test real task flows as guests/members/admin roles where permitted; don't bypass authorization to demonstrate a polished screen.
8. Document preview evidence, screenshots or observations and known unverified viewports. Keep production deployment gated by proper release review and verification.

Current shared surface implementation: `apps/web/src/styles/premium-surface.css` (centered six-fold geometry). The launcher is `apps/web/src/components/agents/GlobalAgentCompanion.jsx`; the distinct quick-actions FAB is `apps/web/src/components/QuickActions.jsx`. Keep both; use verified responsive layout to prevent collisions. The existing decorative styles are preserved for their separate history and consumers, but only the authoritative final layer may define the shared product surface.
