# DNS preflight — interplanetaryfund.com — 2026-10-25

**Status: NOT CUT OVER.** Read-only live inspection; no DNS, registrar, hosting, email, or payment configuration has been changed. This supplements [Phase 7 cutover runbook](PHASE7_CUTOVER_RUNBOOK.md) and follows [issue #137](https://github.com/interplanetarysister/InterplanetaryFund/issues/137). Preserve this as a dated snapshot; do not treat it as an always-current configuration.

## Verified Cloudflare state (connected account)
- Zone: `interplanetaryfund.com`, ID `7a97b6deca72df77895ca25423e86a61`, full zone, **pending** activation.
- Assigned Cloudflare nameservers: `angelina.ns.cloudflare.com`, `ed.ns.cloudflare.com`.
- Cloudflare reports previous nameservers `ns12.wixdns.net`, `ns13.wixdns.net`. This is NOT an independent current registrar delegation query.
- Apex `A` is `216.24.57.1`, DNS-only (not proxied).
- `www` CNAME is `base44.onrender.com`, DNS-only (not proxied).
- Existing Worker `interplanetary-fund2` has only selective host/path routes (including `/api/health*`, `/api/mcp*`, migration, agent, and OAuth paths); **there is no full-site route or Worker Custom Domain** for apex or www. Routes currently require proxied hostname DNS to take effect.
- Worker configuration still exposes a `IFUND_BASE44_ORIGIN` binding name. It is not proof of an independent non-Base44 production frontend.
- No Workers Custom Domains returned for the Cloudflare account. A separate Cloudflare Pages deployment for the independent frontend was not verified.

## Email snapshot / preserve exactly
- Three pre-staged MX records at the apex: `route2.mx.cloudflare.net` priority 23, `route3.mx.cloudflare.net` priority 52, `route1.mx.cloudflare.net` priority 97. These were observed, not validated as an enabled production mailbox.
- Apex SPF TXT is `v=spf1 include:_spf.mx.cloudflare.net ~all`. DKIM TXT exists at `cf2024-1._domainkey`; preserve its original full value verbatim when changing authorities.
- Cloudflare Email Routing for this zone is **disabled / unconfigured**. Its only catch-all rule points to Worker `ifund-email-ingress` but is **disabled** and described as staged until a secure inbox is verified. DO NOT enable routing or delete MX records based solely on their existence; first independently verify destination/recipient and actual send/receive behavior.
- Other service records, if present in the authoritative Wix DNS zone, must be inventoried and migrated before switching nameservers. Cloudflare's pre-staged zone cannot prove that its records match every authoritative Wix record.

## Known cutover blockers
1. Replacement React/Pages production frontend not verified live; documented Phase 5 parity and remaining function/data/auth checks not complete. Issue #137 prohibits production activation before these gates.
2. Apex and www still point to the old Base44/Render infrastructure.
3. Cloudflare DNS zone pending, not active; do not claim delegation succeeded.
4. Cloudflare Workers path routes do not constitute hosting for the full site, and their existing DNS records are not proxied.
5. Email destination/routing is not live-verified and routing is currently disabled.
6. Registrar-side nameserver edit capability and any Wix domain hold/restriction are not verified through connected Wix APIs.

## Activation checklist (future separately authorized cutover)
1. Validate independent Pages build, Supabase auth, functions, ledger, migrations, access controls, campaign saves and publishing. Confirm no Base44 runtime fallbacks. Record immutable deployed version and rollback.
2. Obtain exact Cloudflare Pages production hostname and SSL readiness; confirm both apex and www will resolve to the new app. Do not manufacture A or CNAME targets. Test via an isolated preview/custom hostname first.
3. At registrar, confirm `interplanetaryfund.com` can use external nameservers and is not attached to a Wix site in a way that prevents changing them. Wix documents the dashboard route: [Wix My Domains](https://manage.wix.com/account/domains) → Domain Actions → Manage DNS records → Nameservers → Use custom nameservers. If assigned to a Wix site, unassign before the change as Wix directs. Set both Cloudflare nameservers only after the application and mail prerequisites are met.
4. Before altering delegation, export authoritative old DNS zone; reconcile A/AAAA/CNAME/MX/TXT/SRV/CAA/verification records with Cloudflare. Avoid enabling unverified email catch-all rules.
5. Set Cloudflare apex and www to the confirmed **independent** hosting targets; choose correct Worker Custom Domain versus proxied Worker route, keeping any API paths and security behavior. Avoid old Base44 targets.
6. Change nameservers at registrar only with a rollback contact and approved activation window. Independently verify DNS delegation, HTTPS certificate issuance, apex/www, Supabase login, campaign create/save/publish, PayPal webhooks and email send/receive. DNS propagation is not instantaneous.
7. Roll back with captured old DNS records and registrar nameservers if checks fail; keep the legacy application live until verified and independently signed off. Do not equate a green DNS status with a successful app cutover.

**No live DNS mutation is approved by this document.** It records work needed to finish DNS without masking incomplete application migration.
