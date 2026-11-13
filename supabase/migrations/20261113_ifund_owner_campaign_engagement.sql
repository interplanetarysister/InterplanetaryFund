-- Campaign-owner engagement reporting without exposing follower or donor identities.
-- Figures are counts, not CRM contact permissions or evidence of successful messaging.
create or replace function public.ifund_owner_campaign_engagement()
returns table(campaign_id uuid,campaign_title text,campaign_status text,
  active_followers bigint,verified_captures bigint,verified_recurring_captures bigint)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare caller uuid:=auth.uid();
begin
  if caller is null or not coalesce(public.ifund_current_account_is_active(),false) then
    raise exception 'Confirmed active account required' using errcode='42501';
  end if;
  return query select c.id,c.title,c.status,
    (select count(*) from public.ifund_follows f where f.campaign_id=c.id and coalesce(f.archived,false)=false),
    (select count(*) from public.ifund_donations d
      where d.campaign_id=c.id and d.status='captured' and d.paypal_capture_verified_at is not null),
    (select count(*) from public.ifund_donations d
      where d.campaign_id=c.id and d.status='captured'
        and d.paypal_capture_verified_at is not null and d.is_recurring is true)
  from public.ifund_campaigns c where c.owner_id=caller
  order by c.updated_at desc nulls last,c.id limit 100;
end
$$;
revoke all on function public.ifund_owner_campaign_engagement() from public,anon;
grant execute on function public.ifund_owner_campaign_engagement() to authenticated;
