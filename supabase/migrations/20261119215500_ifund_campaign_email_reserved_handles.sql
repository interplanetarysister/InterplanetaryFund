-- Protect existing business, support, demo and administrative identities.
-- Owner-selected member mail addresses must not impersonate iFund roles.
create or replace function public.ifund_set_campaign_email_option(
 p_opt_in boolean,p_handle text default null
) returns jsonb
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare v_owner uuid:=auth.uid();v_normalized text:=lower(btrim(coalesce(p_handle,'')));
  v_existing public.ifund_campaign_email_options%rowtype;
  v_subscription jsonb;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
    or not exists(select 1 from auth.users u where u.id=v_owner
       and u.email_confirmed_at is not null and u.is_anonymous is false)
  then raise exception 'Verified member account required' using errcode='42501';end if;
  if p_opt_in is null then raise exception 'Selection required' using errcode='22023';end if;
  perform pg_catalog.pg_advisory_xact_lock(19216,pg_catalog.hashtext(v_owner::text));
  select * into v_existing from public.ifund_campaign_email_options
   where owner_id=v_owner for update;
  if not p_opt_in then
    update public.ifund_campaign_email_options
      set opted_in=false,updated_at=now() where owner_id=v_owner;
    return public.ifund_campaign_email_addon_status();
  end if;
  v_subscription:=public.ifund_campaign_email_addon_status();
  if coalesce((v_subscription->>'eligible')::boolean,false) is false
  then raise exception 'An active provider-verified paid subscription is required'
       using errcode='42501';end if;
  if v_normalized !~ '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$'
    or char_length(v_normalized) not between 3 and 24
    or v_normalized=any(array[
       'admin','administrator','support','security','abuse','billing','payments',
       'paypal','postmaster','webmaster','contact','help','legal','privacy',
       'donations','fund','funds','ifund','interplanetaryfund','team','staff',
       'noreply','no-reply','system','notifications','official','press',
       'info','sales','hello','signup','register','root','accounts',
       'user','users','judge','judges','demo','demos','campaign','campaigns',
       'donate','donor','donors','fundraising','owner','owners','office',
       'inbox','mailer','email','mail','webhooks','webhook','reports',
       'verification','verify','confirm','billingteam','adminteam',
       'supportteam','customerservice','helpdesk','reply','answers'
    ])
    or v_normalized ~
      '^(admin|support|security|abuse|staff|help|legal|privacy|team|official|payments|paypal|postmaster|webmaster|ifund|interplanetaryfund|user|judge|demo|donor|billing|verification|verify|no-reply|noreply)([.-]|[0-9])'
  then raise exception 'Choose an available personal address name (3–24 characters)'
       using errcode='22023';end if;
  if v_existing.owner_id is not null and v_existing.local_part<>v_normalized
    and exists(select 1 from ifund_ops.campaign_email_addon_billing b
       where b.owner_id=v_owner and b.routing_verified_at is not null)
  then raise exception 'Changing a provisioned address requires support review'
      using errcode='42501';end if;
  insert into public.ifund_campaign_email_options(owner_id,local_part,opted_in)
   values(v_owner,v_normalized,true)
  on conflict (owner_id) do update set
    local_part=excluded.local_part,opted_in=true,updated_at=now();
  return public.ifund_campaign_email_addon_status();
exception when unique_violation then
  raise exception 'This email name is already reserved' using errcode='23505';
end $$;
revoke all on function public.ifund_set_campaign_email_option(boolean,text)
 from public,anon,authenticated;
grant execute on function public.ifund_set_campaign_email_option(boolean,text) to authenticated;
