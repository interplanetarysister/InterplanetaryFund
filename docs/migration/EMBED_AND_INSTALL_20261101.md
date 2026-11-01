# Public install and campaign embed parity — November 1, 2026

Restores the original publicly navigable `/download` and `/embed/campaign/:id` experience in the authoritative independent `InterplanetaryFund/apps/web` frontend. Source adapted from existing migration draft `migration/build-completeness-gates-20261029`, where these pages were already implemented; source has been reviewed and ported rather than rewritten from scratch.

The iframe route reads only the independently verified **active canonical campaign** through `getCampaignDetail` and never takes donations or exposes drafts. The progress indicator is suppressed unless a verified financial total exists. Cross-origin iframe embedding and third-party X-Frame-Options/CSP behavior remain an external browser verification gate.

The install page uses the browser's native `beforeinstallprompt` event and offers platform instructions. It **does not** claim that a compatible or signed Android APK is available from the independent site. A PWA shortcut is different from the current Base44-signed APK; publishing a new native release requires verified signing-key continuity and device QA.

No DNS changes, Base44 deletion, payments, mail, or provider credentials are involved. A green build alone does not fulfill the full 59-route plus Android visual and workflow acceptance matrix.
