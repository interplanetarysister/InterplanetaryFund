-- Owner-managed public fundraising events and account-linked attendance.
-- External checkout stays with the organizer's provider. Reported external purchases
-- are member statements, never IFund donations, receipts, campaign totals or ledger entries.

create table if not exists public.ifund_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  event_type text not null check (event_type in (
    'benefit_dinner','art_auction','benefit_concert','community_event','gala','other'
  )),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  description text not null default '' check (char_length(description) <= 5000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 80),
  venue_name text not null default '' check (char_length(venue_name) <= 140),
  location_label text not null default '' check (char_length(location_label) <= 180),
  checkout_provider text,
  checkout_url text,
  status text not null default 'draft' check (status in ('draft','published','cancelled','completed')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_events_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint ifund_events_checkout_pair check (
    (checkout_url is null and checkout_provider is null) or
    (checkout_url is not null and checkout_provider is not null)
  ),
  constraint ifund_events_checkout_provider check (
    checkout_provider is null or checkout_provider in (
      'eventbrite','paypal','32auctions','auctria','givesmart',
      'givebutter','zeffy','betterunite','onecause'
    )
  ),
  constraint ifund_events_checkout_host check (
    checkout_url is null or (
      checkout_url ~* '^https://([a-z0-9-]+\.)*(eventbrite\.com|paypal\.com|paypal\.me|32auctions\.com|auctria\.com|givesmart\.com|givebutter\.com|zeffy\.com|betterunite\.com|onecause\.com)(/|[?#]|$)'
      and checkout_url !~ '[[:space:]]'
      and checkout_url !~* '^https://[^/]*@'
      and checkout_url !~* '^https://[^/]*:([0-9]+)'
      and checkout_url !~* '^https://[^/]+/?([?#].*)?$'
      and (
        (checkout_provider='eventbrite' and checkout_url ~* '^https://([a-z0-9-]+\.)*eventbrite\.com(/|[?#]|$)') or
        (checkout_provider='paypal' and checkout_url ~* '^https://([a-z0-9-]+\.)*(paypal\.com|paypal\.me)(/|[?#]|$)') or
        (checkout_provider='32auctions' and checkout_url ~* '^https://([a-z0-9-]+\.)*32auctions\.com(/|[?#]|$)') or
        (checkout_provider='auctria' and checkout_url ~* '^https://([a-z0-9-]+\.)*auctria\.com(/|[?#]|$)') or
        (checkout_provider='givesmart' and checkout_url ~* '^https://([a-z0-9-]+\.)*givesmart\.com(/|[?#]|$)') or
        (checkout_provider='givebutter' and checkout_url ~* '^https://([a-z0-9-]+\.)*givebutter\.com(/|[?#]|$)') or
        (checkout_provider='zeffy' and checkout_url ~* '^https://([a-z0-9-]+\.)*zeffy\.com(/|[?#]|$)') or
        (checkout_provider='betterunite' and checkout_url ~* '^https://([a-z0-9-]+\.)*betterunite\.com(/|[?#]|$)') or
        (checkout_provider='onecause' and checkout_url ~* '^https://([a-z0-9-]+\.)*onecause\.com(/|[?#]|$)')
      )
    )
  ),
  constraint ifund_events_id_owner_unique unique (id, owner_id)
);

create table if not exists public.ifund_event_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('ticket','auction_item','meal','experience','raffle')),
  title text not null check (char_length(btrim(title)) between 2 and 140),
  description text not null default '' check (char_length(description) <= 3000),
  estimated_value_cents bigint check (estimated_value_cents is null or estimated_value_cents between 0 and 100000000),
  starting_bid_cents bigint check (starting_bid_cents is null or starting_bid_cents between 0 and 100000000),
  checkout_provider text,
  checkout_url text,
  status text not null default 'available' check (status in ('draft','available','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_event_items_event_owner_fk
    foreign key (event_id, owner_id) references public.ifund_events(id, owner_id) on delete cascade,
  constraint ifund_event_items_id_event_owner_unique unique (id, event_id, owner_id),
  constraint ifund_event_items_id_event_unique unique (id, event_id),
  constraint ifund_event_items_checkout_pair check (
    (checkout_url is null and checkout_provider is null) or
    (checkout_url is not null and checkout_provider is not null)
  ),
  constraint ifund_event_items_checkout_provider check (
    checkout_provider is null or checkout_provider in (
      'eventbrite','paypal','32auctions','auctria','givesmart',
      'givebutter','zeffy','betterunite','onecause'
    )
  ),
  constraint ifund_event_items_checkout_host check (
    checkout_url is null or (
      checkout_url ~* '^https://([a-z0-9-]+\.)*(eventbrite\.com|paypal\.com|paypal\.me|32auctions\.com|auctria\.com|givesmart\.com|givebutter\.com|zeffy\.com|betterunite\.com|onecause\.com)(/|[?#]|$)'
      and checkout_url !~ '[[:space:]]'
      and checkout_url !~* '^https://[^/]*@'
      and checkout_url !~* '^https://[^/]*:([0-9]+)'
      and checkout_url !~* '^https://[^/]+/?([?#].*)?$'
      and (
        (checkout_provider='eventbrite' and checkout_url ~* '^https://([a-z0-9-]+\\.)*eventbrite\\.com(/|[?#]|$)') or
        (checkout_provider='paypal' and checkout_url ~* '^https://([a-z0-9-]+\\.)*(paypal\\.com|paypal\\.me)(/|[?#]|$)') or
        (checkout_provider='32auctions' and checkout_url ~* '^https://([a-z0-9-]+\\.)*32auctions\\.com(/|[?#]|$)') or
        (checkout_provider='auctria' and checkout_url ~* '^https://([a-z0-9-]+\\.)*auctria\\.com(/|[?#]|$)') or
        (checkout_provider='givesmart' and checkout_url ~* '^https://([a-z0-9-]+\\.)*givesmart\\.com(/|[?#]|$)') or
        (checkout_provider='givebutter' and checkout_url ~* '^https://([a-z0-9-]+\\.)*givebutter\\.com(/|[?#]|$)') or
        (checkout_provider='zeffy' and checkout_url ~* '^https://([a-z0-9-]+\\.)*zeffy\\.com(/|[?#]|$)') or
        (checkout_provider='betterunite' and checkout_url ~* '^https://([a-z0-9-]+\\.)*betterunite\\.com(/|[?#]|$)') or
        (checkout_provider='onecause' and checkout_url ~* '^https://([a-z0-9-]+\\.)*onecause\\.com(/|[?#]|$)')
      )
    )
  )
);

create table if not exists public.ifund_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ifund_events(id) on delete cascade,
  item_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('rsvp','external_purchase_reported')),
  status text not null default 'active' check (status in ('active','cancelled')),
  quantity integer not null default 1 check (quantity between 1 and 100),
  reported_amount_cents bigint check (reported_amount_cents is null or reported_amount_cents between 0 and 100000000),
  reported_currency text not null default 'USD' check (reported_currency ~ '^[A-Z]{3}$'),
  external_reference text check (external_reference is null or char_length(external_reference) <= 200),
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifund_event_registrations_item_fk
    foreign key (item_id, event_id)
    references public.ifund_event_items(id, event_id) on delete cascade,
  constraint ifund_event_registrations_activity_shape check (
    (activity_type='rsvp' and item_id is null and reported_amount_cents is null
      and reported_at is null and external_reference is null)
    or
    (activity_type='external_purchase_reported' and reported_at is not null)
  )
);

create unique index if not exists ifund_event_rsvp_active_unique
  on public.ifund_event_registrations(event_id, user_id)
  where activity_type='rsvp' and status='active';
create unique index if not exists ifund_event_external_activity_active_unique
  on public.ifund_event_registrations(
    event_id, user_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where activity_type='external_purchase_reported' and status='active';
create index if not exists ifund_events_public_schedule_idx
  on public.ifund_events(starts_at, id)
  where status='published' and visibility='public';
create index if not exists ifund_events_owner_schedule_idx
  on public.ifund_events(owner_id, starts_at desc, id);
create index if not exists ifund_event_items_event_status_idx
  on public.ifund_event_items(event_id, status, created_at desc);
create index if not exists ifund_event_registrations_member_idx
  on public.ifund_event_registrations(user_id, created_at desc, id);
create index if not exists ifund_event_registrations_event_idx
  on public.ifund_event_registrations(event_id, created_at desc);

alter table public.ifund_events enable row level security;
alter table public.ifund_event_items enable row level security;
alter table public.ifund_event_registrations enable row level security;

revoke all on public.ifund_events, public.ifund_event_items, public.ifund_event_registrations
  from public, anon, authenticated;
grant select (
  id,campaign_id,event_type,title,description,starts_at,ends_at,timezone,
  venue_name,location_label,checkout_provider,checkout_url,status,visibility,
  published_at,created_at,updated_at
) on public.ifund_events to anon;
grant select (
  id,event_id,item_type,title,description,estimated_value_cents,starting_bid_cents,
  checkout_provider,checkout_url,status,created_at,updated_at
) on public.ifund_event_items to anon;
grant select on public.ifund_events, public.ifund_event_items to authenticated;
grant insert, update on public.ifund_events, public.ifund_event_items to authenticated;
grant select (
  id,event_id,item_id,user_id,activity_type,status,quantity,reported_amount_cents,
  reported_currency,external_reference,reported_at,created_at,updated_at
) on public.ifund_event_registrations to authenticated;
grant insert (
  event_id,item_id,user_id,activity_type,status,quantity,reported_amount_cents,
  reported_currency,external_reference,reported_at,updated_at
) on public.ifund_event_registrations to authenticated;
grant update(status) on public.ifund_event_registrations to authenticated;

create policy ifund_events_public_read
  on public.ifund_events for select to anon, authenticated
  using (
    status='published' and visibility='public'
    and (
      campaign_id is null or exists (
        select 1 from public.ifund_campaigns c
        where c.id=campaign_id and c.status='active'
      )
    )
  );

create policy ifund_events_owner_read
  on public.ifund_events for select to authenticated
  using (owner_id=(select auth.uid()));

create policy ifund_events_owner_insert
  on public.ifund_events for insert to authenticated
  with check (
    owner_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and (campaign_id is null or exists (
      select 1 from public.ifund_campaigns c
      where c.id=campaign_id and c.owner_id=(select auth.uid())
        and (ifund_events.status<>'published' or c.status='active')
    ))
  );

create policy ifund_events_owner_update
  on public.ifund_events for update to authenticated
  using (owner_id=(select auth.uid()))
  with check (
    owner_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and (campaign_id is null or exists (
      select 1 from public.ifund_campaigns c
      where c.id=campaign_id and c.owner_id=(select auth.uid())
        and (ifund_events.status<>'published' or c.status='active')
    ))
  );

create policy ifund_events_owner_delete
  on public.ifund_events for delete to authenticated
  using (owner_id=(select auth.uid()));

create policy ifund_event_items_public_read
  on public.ifund_event_items for select to anon, authenticated
  using (
    status='available'
    and exists (
      select 1 from public.ifund_events e
      where e.id=event_id and e.status='published' and e.visibility='public'
        and (e.campaign_id is null or exists (
          select 1 from public.ifund_campaigns c
          where c.id=e.campaign_id and c.status='active'
        ))
    )
  );

create policy ifund_event_items_owner_read
  on public.ifund_event_items for select to authenticated
  using (owner_id=(select auth.uid()));

create policy ifund_event_items_owner_insert
  on public.ifund_event_items for insert to authenticated
  with check (
    owner_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (
      select 1 from public.ifund_events e
      where e.id=event_id and e.owner_id=(select auth.uid())
    )
  );

create policy ifund_event_items_owner_update
  on public.ifund_event_items for update to authenticated
  using (owner_id=(select auth.uid()))
  with check (
    owner_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (
      select 1 from public.ifund_events e
      where e.id=event_id and e.owner_id=(select auth.uid())
    )
  );

create policy ifund_event_items_owner_delete
  on public.ifund_event_items for delete to authenticated
  using (owner_id=(select auth.uid()));

create policy ifund_event_registrations_member_private_read
  on public.ifund_event_registrations for select to authenticated
  using (user_id=(select auth.uid()));

create policy ifund_event_registrations_verified_member_insert
  on public.ifund_event_registrations for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and not exists (select 1 from public.ifund_events e where e.id=event_id and e.owner_id=(select auth.uid()))
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
    and exists (
      select 1 from public.ifund_events e
      where e.id=event_id
        and e.status='published' and e.visibility='public'
        and (activity_type='rsvp' or e.checkout_url is not null or exists (
          select 1 from public.ifund_event_items i
          where i.id=item_id and i.event_id=e.id and i.status='available'
            and i.checkout_url is not null
        ))
        and (item_id is null or exists (
          select 1 from public.ifund_event_items i
          where i.id=item_id and i.event_id=e.id and i.status='available'
        ))
    )
  );

create policy ifund_event_registrations_member_cancel
  on public.ifund_event_registrations for update to authenticated
  using (
    user_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
  )
  with check (
    user_id=(select auth.uid())
    and (select ifund_private.verified_email_creator())
    and (select public.ifund_current_account_is_active())
    and (select public.ifund_current_user_has_current_terms())
  );

comment on table public.ifund_events is
  'Organizer-owned fundraising event listings. Third-party checkout links are outbound only; no event sales enter the IFund donation ledger.';
comment on table public.ifund_event_items is
  'Owner-managed tickets, auction items, meals and experiences. Checkout is provided by the organizer-listed external provider.';
comment on table public.ifund_event_registrations is
  'Member RSVP and self-reported external event purchases. These are not provider-verified transactions, receipts, donations or ledger entries.';
