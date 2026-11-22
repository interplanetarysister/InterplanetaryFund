-- Private campaign donation messages are delivered only after verified capture.
-- The trigger is part of the same transaction as the immutable donation insert.
alter table public.ifund_payment_intents
  add column if not exists support_message text;
alter table public.ifund_payment_intents
  drop constraint if exists ifund_payment_intents_support_message_check,
  add constraint ifund_payment_intents_support_message_check
    check (support_message is null or length(btrim(support_message)) <= 500);

create table if not exists public.ifund_campaign_donation_messages (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null unique references public.ifund_donations(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete restrict,
  campaign_title text not null,
  donor_display_name text not null default 'Anonymous',
  message text not null check (length(btrim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists ifund_campaign_donation_messages_owner_recent
  on public.ifund_campaign_donation_messages(owner_id, created_at desc);

alter table public.ifund_campaign_donation_messages enable row level security;
revoke all on public.ifund_campaign_donation_messages from public, anon, authenticated;
grant select on public.ifund_campaign_donation_messages to authenticated;
grant select, insert on public.ifund_campaign_donation_messages to service_role;
drop policy if exists ifund_campaign_donation_messages_owner_read
  on public.ifund_campaign_donation_messages;
create policy ifund_campaign_donation_messages_owner_read
  on public.ifund_campaign_donation_messages
  for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.ifund_deliver_verified_campaign_donation_message()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_message text;
  v_display_name text;
  v_owner uuid;
  v_campaign_title text;
  v_delivery_id uuid;
begin
  if new.status is distinct from 'captured'
     or new.paypal_capture_verified_at is null then
    return new;
  end if;

  select nullif(btrim(i.support_message), ''),
         case when i.display_name_public
           then coalesce(nullif(btrim(i.public_display_name), ''), 'Supporter')
           else 'Anonymous' end,
         c.owner_id, c.title
    into v_message, v_display_name, v_owner, v_campaign_title
    from public.ifund_payment_intents i
    join public.ifund_campaigns c on c.id = i.campaign_id
   where i.paypal_order_id = new.paypal_order_id
     and i.campaign_id = new.campaign_id;

  if v_message is null or v_owner is null then
    return new;
  end if;

  insert into public.ifund_campaign_donation_messages
    (donation_id, owner_id, campaign_id, campaign_title, donor_display_name, message)
  values
    (new.id, v_owner, new.campaign_id, left(coalesce(v_campaign_title, 'Campaign'), 240),
     left(coalesce(v_display_name, 'Anonymous'), 60), left(v_message, 500))
  on conflict (donation_id) do nothing
  returning id into v_delivery_id;

  -- Notifications are optional for older deployments; the private inbox record
  -- above is the durable source of truth and remains available regardless.
  if v_delivery_id is not null
     and to_regclass('public.ifund_notifications') is not null then
    execute
      'insert into public.ifund_notifications(owner_id,title,body,type,link,read) values ($1,$2,$3,$4,$5,false)'
      using v_owner, 'New verified donation message',
        'A donor sent a message with a verified gift to ' || left(coalesce(v_campaign_title, 'your campaign'), 160) || '.',
        'donation_message', '/inbox';
  end if;

  return new;
end;
$$;

revoke all on function public.ifund_deliver_verified_campaign_donation_message()
  from public, anon, authenticated;
grant execute on function public.ifund_deliver_verified_campaign_donation_message()
  to service_role;
grant insert on public.ifund_notifications to service_role;

drop trigger if exists ifund_deliver_verified_campaign_donation_message
  on public.ifund_donations;
create trigger ifund_deliver_verified_campaign_donation_message
  after insert on public.ifund_donations
  for each row execute function public.ifund_deliver_verified_campaign_donation_message();

comment on table public.ifund_campaign_donation_messages is
  'Private campaign-owner messages delivered once, only after a PayPal capture has been verified and recorded.';
