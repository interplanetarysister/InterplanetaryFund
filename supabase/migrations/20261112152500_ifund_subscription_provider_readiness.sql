-- Make subscription plan availability mean both provider plan and billing webhook verification.
alter table public.ifund_subscription_plans
  add column if not exists paypal_webhook_id text,
  add column if not exists webhook_verified_at timestamptz;

update public.ifund_subscription_plans
set active = false
where active = true and webhook_verified_at is null;
