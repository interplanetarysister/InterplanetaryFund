# IFund demo activity seed (isolated, zero-credit)

Status: database seed applied 2026-11-11 to Supabase project `ssibsfmtodgximseeqsv`; frontend wiring **not yet deployed**.

Existing demo namespace: `public.ifund_demo_campaigns` (82 records at inspection), `ifund_demo_users` (11), and existing demo payment tables. New `public.ifund_demo_activity` contains 1,400 deterministic, fictional records across 82 demo campaigns. The migration is idempotent by unique `seed_key` and does not create real Auth accounts, donations, PayPal orders/captures, verified receipts, or ledger entries.

All activity has `is_simulated=true`. `pledge_example` records are illustrative only and must never contribute to financial totals, verified donations, receipt lists, or platform fees. The table has RLS enabled and explicitly revokes anonymous and authenticated access; expose it only through a reviewed, read-only Cloudflare server endpoint that authorizes demo mode and returns safe fields. Do not expose service keys to the browser.

UI follow-up: wire the existing /hackathon demo to a server-verified read-only activity endpoint, visibly label content 'Fictional demo activity', paginate by `occurred_at`, and keep the real PayPal sandbox Orders v2 receipts in their existing isolated provider-backed tables. A separate actual AI request must remain judge-testable. No recurring cron or Base44 builder calls are necessary.

Validation SQL:
```sql
select count(*) as activity_rows, count(distinct campaign_id) as campaigns, bool_and(is_simulated) as all_simulated from public.ifund_demo_activity;
select relrowsecurity from pg_class where oid='public.ifund_demo_activity'::regclass;
```

Release gates: no production DNS change, no fake payment success, no enabling withdrawals; verify Cloudflare preview UI and RLS negative tests before exposing demo data to judges.
