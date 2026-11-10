-- Applied to Supabase ssibsfmtodgximseeqsv as migration 20261110200956.
-- Additive, sandbox-only checkout token binding. Does not enable payments.
alter table public.ifund_paypal_sandbox_orders
  add column if not exists checkout_token_hash text;
create unique index if not exists ifund_paypal_sandbox_checkout_token_hash_unique
  on public.ifund_paypal_sandbox_orders (checkout_token_hash)
  where checkout_token_hash is not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='ifund_paypal_sandbox_checkout_token_hash_format'
      and conrelid='public.ifund_paypal_sandbox_orders'::regclass
  ) then
    alter table public.ifund_paypal_sandbox_orders
      add constraint ifund_paypal_sandbox_checkout_token_hash_format
      check (checkout_token_hash is null or checkout_token_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;
comment on column public.ifund_paypal_sandbox_orders.checkout_token_hash is
 'SHA-256 of private short-lived checkout session token; never store plaintext, expose to clients, or use for live payments';
