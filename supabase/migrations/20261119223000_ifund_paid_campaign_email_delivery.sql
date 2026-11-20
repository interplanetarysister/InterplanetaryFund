-- Route paid @interplanetaryfund.com campaign mail to the rightful IFund Inbox.
-- This is deliberately NOT a browser API, payment capture, or SMTP sender.
-- Only Supabase service_role, invoked after verified signed Cloudflare ingress,
-- may call it. Every message is denied until independent billing and routing
-- evidence is recorded. Admin and internal addresses never match a paid alias.
create or replace function public.ifund_receive_paid_campaign_email(
  p_to text,p_from text,p_subject text,p_body text,p_message_id text
)
returns uuid
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare
  v_to text:=lower(btrim(coalesce(p_to,'')));
  v_owner uuid;
  v_id uuid;
  v_key text;
  v_subject text:=btrim(coalesce(p_subject,''));
  v_body text:=coalesce(p_body,'');
  v_sender text:=btrim(coalesce(p_from,''));
  v_message_id text:=btrim(coalesce(p_message_id,''));
begin
  if v_to !~ '^[a-z][a-z0-9.-]{2,23}@interplanetaryfund[.]com$'
     or v_to like '%.%@%' or v_to like '%..%'
     or v_sender='' or char_length(v_sender)>254
     or v_message_id='' or char_length(v_message_id)>254
     or char_length(v_subject)>240 or char_length(v_body)>11500
  then raise exception 'Mailbox unavailable' using errcode='22023';end if;
  select o.owner_id into v_owner
  from public.ifund_campaign_email_options o
  join auth.users u on u.id=o.owner_id
  join public.ifund_profiles profile on profile.id=o.owner_id
  join ifund_access.member_entitlements e on e.owner_id=o.owner_id
  join ifund_ops.campaign_email_addon_billing b on b.owner_id=o.owner_id
  where o.local_part=split_part(v_to,'@',1) and o.opted_in=true
    and u.email_confirmed_at is not null and u.is_anonymous is false
    and profile.account_status='active'
    and profile.account_deletion_pending is false
    and e.tier='basic' and e.status='active' and e.provider='paypal'
    and e.verified_at is not null and e.verified_at<=now()
    and e.valid_until>now() and nullif(e.receipt_id,'') is not null
    and b.state='active' and b.provider='paypal' and b.amount_cents=100
    and b.currency='USD' and b.environment='live'
    and nullif(b.provider_subscription_id,'') is not null
    and nullif(b.provider_plan_id,'') is not null
    and nullif(b.last_provider_event_id,'') is not null
    and b.verified_at is not null and b.verified_at<=now()
    and b.paid_through>now() and b.routing_verified_at is not null
  limit 1;
  if v_owner is null then
    raise exception 'Mailbox unavailable' using errcode='42501';
  end if;
  -- Internal receipts are immutable and scoped to the recipient and ID.
  v_key:='ifund:paid-mail:v1:'||
    encode(sha256(convert_to(v_to||E'\n'||v_message_id,'UTF8')),'hex');
  insert into public.ifund_inbox_items
    (owner_id,platform,type,author,content,link,status,recipient_address,
     external_message_id,connection_id,reply_support,mailbox_priority,canonical_operation_id)
  values
    (v_owner,'iFund Email','message',left(v_sender,200),
      left('Subject: '||v_subject||E'\n\n'||v_body,12000),
      '/inbox','open',v_to,v_message_id,'ifund-paid-email','unsupported','normal',v_key)
  on conflict(canonical_operation_id) where canonical_operation_id is not null
  do nothing
  returning id into v_id;
  if v_id is null then
    select i.id into v_id from public.ifund_inbox_items i
    where i.canonical_operation_id=v_key
      and i.owner_id=v_owner and i.recipient_address=v_to
      and i.external_message_id=v_message_id;
  end if;
  if v_id is null then
    raise exception 'Mailbox receipt unavailable' using errcode='23505';
  end if;
  return v_id;
end;
$$;
revoke all on function public.ifund_receive_paid_campaign_email(text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.ifund_receive_paid_campaign_email(text,text,text,text,text)
to service_role;
