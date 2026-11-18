-- Tighten event-item checkout provider binding and make member activity immutable
-- except for a one-way active -> cancelled transition.
alter table public.ifund_event_items
  drop constraint if exists ifund_event_items_checkout_host;

alter table public.ifund_event_items
  add constraint ifund_event_items_checkout_host check (
    checkout_url is null or (
      checkout_url ~* '^https://([a-z0-9-]+\.)*(eventbrite\.com|paypal\.com|paypal\.me|32auctions\.com|auctria\.com|givesmart\.com|givebutter\.com|zeffy\.com|betterunite\.com|onecause\.com)(/|[?#]|$)'
      and checkout_url !~ '[[:space:]]'
      and checkout_url !~* '^https://[^/]*@'
      and checkout_url !~* '^https://[^/]*:([0-9]+)'
      and checkout_url !~* '^https://[^/]+/?([?#].*)?$'
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
  );

create or replace function public.ifund_guard_event_registration_cancellation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status <> 'active'
    or new.status <> 'cancelled'
    or (to_jsonb(new) - 'status' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Event activity can only be cancelled without changing its details.'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.ifund_guard_event_registration_cancellation() from public, anon, authenticated;

drop trigger if exists ifund_event_registration_cancellation_guard
  on public.ifund_event_registrations;

create trigger ifund_event_registration_cancellation_guard
before update on public.ifund_event_registrations
for each row execute function public.ifund_guard_event_registration_cancellation();

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
  );

create or replace function public.ifund_guard_event_registration_cancellation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.status <> 'active'
    or new.status <> 'cancelled'
    or (to_jsonb(new) - 'status' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Event activity can only be cancelled without changing its details.'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.ifund_guard_event_registration_cancellation() from public, anon, authenticated;

drop trigger if exists ifund_event_registration_cancellation_guard
  on public.ifund_event_registrations;

create trigger ifund_event_registration_cancellation_guard
before update on public.ifund_event_registrations
for each row execute function public.ifund_guard_event_registration_cancellation();
