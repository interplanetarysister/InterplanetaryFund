-- TEST COLLECTION DATA ONLY. Does not create/capture payments or affect balances.
-- Supabase migration already applied via connected production-project migration API;
-- checked 2026-11-10 Pacific. This version-controlled source is idempotent.
create table if not exists public.ifund_payment_path_test_evidence (
  case_key text primary key,
  channel text not null,
  entrypoint text not null,
  environment text not null check (environment in ('sandbox','live-disabled','external-sandbox')),
  evidence_kind text not null check (evidence_kind in ('runtime-configuration','source-review','provider-capture','signed-webhook','database-reconciliation','automated-test')),
  result text not null check (result in ('unverified','blocked','passed','failed')),
  test_only boolean not null default true check (test_only = true),
  simulated boolean not null default false,
  provider_order_id text,
  provider_capture_id text,
  provider_event_id text,
  details text not null default '',
  blocker text not null default '',
  evidence_url text,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_unproven_provider_receipts check (
    (evidence_kind not in ('provider-capture','signed-webhook','database-reconciliation') or result <> 'passed')
    or (provider_order_id is not null and provider_capture_id is not null and not simulated)
  )
);
alter table public.ifund_payment_path_test_evidence enable row level security;
revoke all on public.ifund_payment_path_test_evidence from public, anon, authenticated;
comment on table public.ifund_payment_path_test_evidence is
  'TEST DATA ONLY: payment path evidence registry, never a donation receipt or financial ledger';
insert into public.ifund_payment_path_test_evidence
(case_key,channel,entrypoint,environment,evidence_kind,result,details,blocker)
values
('sandbox-status','paypal-sandbox','/api/paypal/sandbox/status','sandbox','runtime-configuration','blocked','Preview flag enabled, webhook ID configured','Three required runtime credentials missing'),
('sandbox-campaign-paypal','paypal-wallet','/api/paypal/sandbox/orders -> /api/paypal/sandbox/capture','sandbox','source-review','blocked','Orders v2 code inspected','No real sandbox capture; missing credentials'),
('sandbox-campaign-card','hosted-card','/api/paypal/sandbox/orders','sandbox','source-review','unverified','Hosted card integration not present in sandbox demo handler','Implement/test eligible SDK card-fields path'),
('sandbox-platform-support','platform-support','/hackathon + hosted PayPal support link','sandbox','source-review','unverified','Support link is separate from campaign receipts','Sandbox link/payment not provider-verified'),
('sandbox-subscription','paypal-subscription','/api/paypal/subscriptions/webhook','external-sandbox','source-review','unverified','Webhook registration user-supplied','Verify handler and subscription state'),
('sandbox-base44-campaign','base44-paypal-campaign','/functions/payPalCampaignWebhook','external-sandbox','source-review','unverified','Base44 sandbox registration user-supplied','Verify Base44 receipts'),
('sandbox-base44-subscription','base44-paypal-subscription','/functions/payPalSubscriptionWebhook','external-sandbox','source-review','unverified','Base44 subscription registration user-supplied','Verify signed events'),
('sandbox-kofi','kofi','/api/webhooks/kofi','external-sandbox','source-review','unverified','Ko-fi is not a PayPal webhook protocol','Verify Ko-fi handler/signature'),
('sandbox-wix','wix','/api/webhooks/wix','external-sandbox','source-review','unverified','Wix is not a PayPal webhook protocol','Verify Wix handler/signature'),
('sandbox-duplicate-capture','idempotency','/api/paypal/sandbox/capture','sandbox','source-review','unverified','Conditional capture persistence logic inspected','Provider-backed retries not verified'),
('sandbox-signed-webhook','paypal-webhook','/api/paypal/sandbox/webhook','sandbox','source-review','blocked','PayPal signature verification code inspected','No verified webhook delivery; credentials missing'),
('sandbox-refund-dispute','refund-dispute','/api/paypal/sandbox/webhook','sandbox','source-review','unverified','Demo handler accepts capture-completed only','Refund/dispute handler missing in sandbox demo'),
('live-gated','paypal-live','/api/payments/*','live-disabled','runtime-configuration','passed','Production Worker flag false confirmed','Checkout intentionally paused'),
('sandbox-ledger-isolation','sandbox-database','ifund_paypal_sandbox_orders; ifund_paypal_sandbox_events','sandbox','database-reconciliation','unverified','Zero sandbox orders/events and zero donations at audit','Real sandbox transaction required')
on conflict (case_key) do nothing;

-- Additional prospective incoming-payment channels and failure/abuse cases.
insert into public.ifund_payment_path_test_evidence(case_key,channel,entrypoint,environment,evidence_kind,result,details,blocker) values
('sandbox-venmo','venmo','/api/payments/create-order','sandbox','source-review','unverified','Live Worker allows venmo channel','No sandbox SDK/approval/capture evidence'),
('sandbox-applepay','applepay','/api/payments/create-order','sandbox','source-review','unverified','Live Worker allows applepay channel','No sandbox wallet/device proof'),
('sandbox-googlepay','googlepay','/api/payments/create-order','sandbox','source-review','unverified','Live Worker allows googlepay channel','No sandbox wallet proof'),
('sandbox-guest','guest-card-paypal','CampaignDonationDialog','sandbox','source-review','unverified','Frontend claims account-free checkout','No guest transaction acceptance evidence'),
('sandbox-cancel','buyer-cancellation','/hackathon?paypal=cancelled','sandbox','source-review','unverified','Return/cancel URL configured','No real cancellation event tested'),
('sandbox-provider-error','provider-error','/api/paypal/sandbox/orders','sandbox','source-review','unverified','Fail-closed provider response handling','No timeout/retry recovery proof'),
('sandbox-amount-boundary','amount-validation','/api/paypal/sandbox/orders','sandbox','source-review','unverified','Input range $1-$100 in integer cents','Boundary cases not provider-tested'),
('sandbox-duplicate-webhook','webhook-idempotency','/api/paypal/sandbox/webhook','sandbox','source-review','unverified','Idempotent event processing in source','No duplicate signed delivery test'),
('sandbox-cross-campaign','ownership-isolation','/api/paypal/sandbox/capture','sandbox','source-review','unverified','Captured order tied to stored campaign','No provider-backed mismatch rejection test'),
('sandbox-partial-refund','partial-refund','/api/paypal/sandbox/webhook','sandbox','source-review','unverified','Sandbox handler supports completed-capture only','Partial refund path not implemented'),
('sandbox-dispute','dispute-reversal','/api/paypal/sandbox/webhook','sandbox','source-review','unverified','Sandbox handler supports completed-capture only','Dispute/reversal path not implemented'),
('sandbox-merchant-receipt','receipt-display','/hackathon','sandbox','source-review','unverified','Capture returns order and capture IDs','Persisted user receipt/admin finance display not verified')
on conflict(case_key) do nothing;
