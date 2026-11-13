-- Applied through Supabase migration API on 2026-11-13; demo-only.
-- Wallet method stays confined to sandbox tables and cannot produce live receipts.
alter table public.ifund_demo_orders drop constraint if exists ifund_demo_orders_checkout_method_check;
alter table public.ifund_demo_orders add constraint ifund_demo_orders_checkout_method_check
  check (checkout_method in ('paypal','card','googlepay'));
