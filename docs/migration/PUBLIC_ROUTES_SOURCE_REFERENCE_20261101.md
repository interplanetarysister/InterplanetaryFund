# Public route source reconciliation — 2026-11-01

## Purpose

Move the original public-information and support surfaces from `interplanetarysister/interplanetary-fund2/main` into the independent `interplanetarysister/InterplanetaryFund` React/Vite application, without copying Base44 client calls or asserting that unverified backends are operational. **This is a source/population checkpoint, not full platform parity or a production cutover authorization.**

The canonical destination remains `InterplanetaryFund`. The Base44 repo is a functional/visual reference only; no Convex or Vercel runtime should be reintroduced. The original reference is pinned to the exact Git blobs below so later agents can verify copy drift rather than guessing.

| Public route | Original reference | Source blob SHA | Independent implementation | Current status |
|---|---|---|---|---|
| `/about` | `interplanetary-fund2/src/pages/About.jsx` | `9b79a83547d9d57b5b09920cb02651c1086301a3` | `src/pages/About.jsx` | Source text ported; icon/brand shell adapted; browser/mobile visual parity pending |
| `/contact` | `interplanetary-fund2/src/pages/Contact.jsx` | `fa3e11da227886b4cd5ed30f6ff01de0027f67c8` | `src/pages/Contact.jsx` from safe migration copy `apps/web/src/pages/Contact.jsx` blob `ab71249c43181c4956d271d250a47b35b1f5cd12` | Honest email-app fallback; original support-ticket function deferred |
| `/terms` | `interplanetary-fund2/src/pages/Terms.jsx` | `a606cf6c842a55d5129523e9c652a4a2cf8d1aff` | `src/pages/Terms.jsx` | Original text renderer preserved; legal review and acceptance workflow not certified |
| `/privacy` | `interplanetary-fund2/src/pages/Privacy.jsx` | `2fca30b5b4d47dc889f15d3278846c0b08496e84` | `src/pages/Privacy.jsx` | Original policy rendered; actual provider/retention disclosures still require review |
| `/help` | `interplanetary-fund2/src/pages/Help.jsx` | `c6f4e0745fd6b8558e8fef1a03c953df2b7089c5` | `src/pages/Help.jsx` | Search, category and read-only migration guides; published DB article index and support tickets deferred |
| `/help/:slug` | `interplanetary-fund2/src/pages/HelpArticle.jsx` | `63f075dc576caa24c70a4360032fd50fa1d7121a` | `src/pages/HelpArticle.jsx` | Safe local article rendering; no unpublished/unauthorized DB reads; original feedback and article storage deferred |
| Shared Help Center taxonomy | `interplanetary-fund2/src/lib/helpCenter.js` | `65e7108e82ae6876b4bddfb528c548e0eebe2348` | `src/lib/helpCenter.js` | Original category names, slugs and stable URLs retained |
| Shared legal policy | `interplanetary-fund2/src/lib/legalPolicy.js` | `771288e458da9202039b64397ed89354391b56c0` | `src/lib/legalPolicy.js` | Verbatim source copy, including `2026-10-13-v3` legal version; not a new legal approval |

## Source and release invariants

- Keep original product copy and legal document versioning intact until legally approved, with no automatic account acceptance recorded merely because a page renders.
- No contact or Help Center form can claim successful submission without a functioning independently verified server endpoint. Contact currently opens a user email application; it does not send a message through the site.
- Local public help guides deliberately cover verified independent concepts; they do **not** copy Base44-specific AI, private mailbox or payment instructions that would falsely imply those workflows are live.
- Never expose private drafts, unpublished articles, identities, payment rows, or provider credentials through these public routes.
- Do not force all original `interplanetary-fund2` files into root by blind copying; reconcile imports, permissions and data contracts first. The larger `migration/build-completeness-gates-20261029` branch already contains partial replacement work and must be compared before each port.
- Email delivery and payment processing are explicitly deferred by the owner for later migration phases, except compatibility scaffolding that does not activate side effects.
- Regression tests and CI build are required before merging; live browser, accessibility, role and mobile evidence remain separate requirements. Cloudflare deployment stays independently gated.

## Next logical work

Reconcile original account/signup/route guard contract, consistent onboarding and deleted-account access handling, verified campaign-owner mapping, public/community story parity, and agent/workflow runtime coverage. Preserve financial integrity and original IDs. Do not mark the 58 source routes as complete from their presence alone.
