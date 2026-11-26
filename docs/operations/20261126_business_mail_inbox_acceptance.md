# iFund business mail routing and inbox repair — 2026-11-26

Scope: `interplanetarysister/InterplanetaryFund` only, Cloudflare account `c95db4f2c901f32776471b85f1eda15d`, Supabase `ssibsfmtodgximseeqsv`.

## Confirmed receiving
- Cloudflare Email Routing is enabled and ready for `interplanetaryfund.com`.
- Domain MX records point to Cloudflare routing.
- Both explicit `user@` routing and catch-all routing send to `ifund-email-ingress`.
- The Worker has R2 archive binding `ifund-mail-archive`.
- R2 contains five recent archived email objects and corresponding `persisted` delivery receipts.
- Supabase `public.admin_inbound_email` holds five received records, including `user@` and `support@`.
- `public.ifund_inbox_items` contains no corresponding business email rows because the existing Mail UI only queried the ordinary member inbox table.

## Implemented
- Migration `20261126180000_ifund_private_admin_mail_ui_rpc.sql` applied in the iFund project.
- `public.ifund_admin_mail_list()` exposes the latest 50 business emails only to JWT-authenticated users listed in `ifund_admin_mail_access`.
- `public.ifund_admin_mail_set_read(uuid,boolean)` changes the read status with the same ACL check.
- Browser has **no direct table SELECT** privilege on `admin_inbound_email`; all email bodies remain in the private DB table.
- `apps/web/src/pages/Inbox.jsx` now includes an admin-only business email section with read/unread buttons.

## Acceptance tests and gate
- The existing admin-mail ACL has one user, which also passes the verified-admin authorization function.
- ACL-authorized session simulation read all five messages.
- Non-member identity was denied.
- Authorized read-status write was verified in a rolled-back transaction.
- iFund production deployment **not run**. Full local relevant tests, build compilation, and browser acceptance remain pending before production authorization.
- Current hackathon-demo and onlycryptids-media-scout Workers have **no Cron Triggers**; no destructive deletion was performed. Existing live iFund Cron Triggers were preserved.
