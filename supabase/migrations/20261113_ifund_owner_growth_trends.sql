-- Growth specialist: free owner-only 7/30 day activity counts.
-- Capture counts are PayPal-verified events, not net income or unique donors.
create or replace function public.ifund_owner_growth_trends()
returns table (
 campaign_id uuid,
 new_follows_7d bigint,
 new_follows_30d bigint,
 new_verified_captures_7d bigint,
 new_verified_captures_30d bigint,
 checked_at timestamptz
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Active campaign owner required' using errcode='42501';
 end if;
 return query
 select c.id,
    (select count(*) from public.ifund_follows f
      where f.campaign_id=c.id and f.archived is not true
        and f.created_at>=now()-interval '7 days'),
    (select count(*) from public.ifund_follows f
      where f.campaign_id=c.id and f.archived is not true
        and f.created_at>=now()-interval '30 days'),
    (select count(*) from public.ifund_donations d
      where d.campaign_id=c.id and d.status='captured'
        and d.paypal_capture_verified_at is not null
        and d.captured_at>=now()-interval '7 days'),
    (select count(*) from public.ifund_donations d
      where d.campaign_id=c.id and d.status='captured'
        and d.paypal_capture_verified_at is not null
        and d.captured_at>=now()-interval '30 days'),
    now()
 from public.ifund_campaigns c
 where c.owner_id=v_uid
 order by c.updated_at desc nulls last,c.id limit 100;
end
$$;
revoke all on function public.ifund_owner_growth_trends() from public,anon;
grant execute on function public.ifund_owner_growth_trends() to authenticated;
