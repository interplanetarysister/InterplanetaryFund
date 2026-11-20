-- Make real inbound delivery use the same verified $1/month paid-plan
-- authorization as the trusted recipient lookup. Preserve campaign attachment
-- and immutable read-only message receipts.
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
  v_campaign uuid;
  v_campaign_title text;
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
  -- Single, server-only entitlement gate; no independent permissive copy of
  -- billing checks can drift away from the plan and provider evidence rules.
  select gate.owner_id,gate.campaign_id,c.title
    into v_owner,v_campaign,v_campaign_title
    from public.ifund_paid_campaign_email_inbound_recipient(v_to) gate
    left join public.ifund_campaigns c
      on c.id=gate.campaign_id and c.owner_id=gate.owner_id
    limit 1;
  if v_owner is null then
    raise exception 'Mailbox unavailable' using errcode='42501';
  end if;
  -- Internal receipts are immutable and scoped to the recipient and ID.
  v_key:='ifund:paid-mail:v1:'||
    encode(sha256(convert_to(v_to||E'\n'||v_message_id,'UTF8')),'hex');
  insert into public.ifund_inbox_items
    (owner_id,platform,type,author,content,link,status,campaign_id,campaign_title,recipient_address,
     external_message_id,connection_id,reply_support,mailbox_priority,canonical_operation_id)
  values
    (v_owner,'iFund Email','message',left(v_sender,200),
      left('Subject: '||v_subject||E'\n\n'||v_body,12000),
      '/inbox','open',v_campaign,left(v_campaign_title,240),v_to,v_message_id,'ifund-paid-email','unsupported','normal',v_key)
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
