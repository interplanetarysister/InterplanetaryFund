-- Prevent double counting; only PayPal-verified, captured (not refunded) gifts count.
-- Applied to Supabase production 2026-11-10.
alter table public.ifund_campaign_funding_totals
  add constraint ifund_funding_totals_nonnegative check (captured_gift_cents >= 0 and donor_count >= 0);

CREATE OR REPLACE FUNCTION private.ifund_sync_funding_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_before_gift bigint := 0;
  v_after_gift bigint := 0;
  v_before_count bigint := 0;
  v_after_count bigint := 0;
begin
  if tg_op='UPDATE' and new.campaign_id is distinct from old.campaign_id then
    raise exception 'Donation campaign ownership is immutable' using errcode='23514';
  end if;
  if tg_op <> 'INSERT' and old.status='captured'
    and old.paypal_capture_id is not null and old.paypal_capture_verified_at is not null then
    v_before_gift:=old.gift_cents; v_before_count:=1;
  end if;
  if tg_op <> 'DELETE' and new.status='captured'
    and new.paypal_capture_id is not null and new.paypal_capture_verified_at is not null then
    v_after_gift:=new.gift_cents; v_after_count:=1;
  end if;
  v_id:=case when tg_op='DELETE' then old.campaign_id else new.campaign_id end;
  -- Create a nonnegative zero baseline, then apply a signed delta under
  -- the row lock. Inserting a negative delta directly can violate CHECK
  -- constraints before ON CONFLICT is evaluated on PostgreSQL.
  insert into public.ifund_campaign_funding_totals(campaign_id,captured_gift_cents,donor_count,updated_at)
    values(v_id,0,0,now()) on conflict(campaign_id) do nothing;
  update public.ifund_campaign_funding_totals set
    captured_gift_cents=captured_gift_cents+(v_after_gift-v_before_gift),
    donor_count=donor_count+(v_after_count-v_before_count),
    updated_at=now()
  where campaign_id=v_id;
  return case when tg_op='DELETE' then old else new end;
end $function$


drop trigger if exists ifund_donations_funding_rollup on public.ifund_donations;
drop trigger if exists ifund_sync_funding_totals_on_donation on public.ifund_donations;
create trigger ifund_sync_funding_totals_on_donation
after insert or update of campaign_id,status,gift_cents,paypal_capture_id,paypal_capture_verified_at
or delete on public.ifund_donations
for each row execute function private.ifund_sync_funding_totals();
revoke all on function private.ifund_sync_funding_totals() from public,anon,authenticated;
grant execute on function private.ifund_sync_funding_totals() to service_role;
