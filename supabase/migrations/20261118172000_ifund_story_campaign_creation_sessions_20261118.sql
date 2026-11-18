-- Bind pre-save Story AI requests to an explicit, short-lived IFund campaign-creation session.
-- This closes the no-campaign-id bypass while preserving the authenticated native creator flow.
begin;

create table if not exists public.ifund_story_campaign_creation_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  constraint ifund_story_creation_session_expiry check (expires_at > created_at),
  constraint ifund_story_creation_session_owner_request_unique unique (owner_id, request_id)
);

create index if not exists ifund_story_creation_session_expiry_idx
  on public.ifund_story_campaign_creation_sessions (expires_at);

alter table public.ifund_story_campaign_creation_sessions enable row level security;
revoke all on table public.ifund_story_campaign_creation_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.ifund_story_campaign_creation_sessions to service_role;

create or replace function public.ifund_story_campaign_creation_session_begin(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = 'off'
as $function$
declare
  v_owner uuid := auth.uid();
  v_session_id uuid;
begin
  if v_owner is null
     or p_request_id is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
     or not coalesce(public.ifund_current_account_is_active(), false)
     or not coalesce(public.ifund_current_user_has_current_terms(), false)
     or not exists (
       select 1 from auth.users u
       where u.id = v_owner and u.email_confirmed_at is not null and u.deleted_at is null
     ) then
    raise exception 'Verified active IFund account required to start campaign writing'
      using errcode = '42501';
  end if;

  insert into public.ifund_story_campaign_creation_sessions (
    owner_id, request_id, expires_at
  ) values (
    v_owner, p_request_id, statement_timestamp() + interval '30 minutes'
  )
  on conflict (owner_id, request_id) do update
    set expires_at = greatest(
      public.ifund_story_campaign_creation_sessions.expires_at,
      excluded.expires_at
    )
  returning id into v_session_id;

  return v_session_id;
end
$function$;

revoke all on function public.ifund_story_campaign_creation_session_begin(uuid) from public, anon;
grant execute on function public.ifund_story_campaign_creation_session_begin(uuid) to authenticated;
comment on function public.ifund_story_campaign_creation_session_begin(uuid) is
  'Issues an owner-bound, 30-minute, idempotent session for pre-save IFund-native campaign Story AI drafting. Not an authorization for outside campaign servicing.';

create or replace function public.ifund_story_campaign_creation_session_authorized(
  p_session_id uuid,
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = 'off'
as $function$
  select coalesce(
    auth.uid() is not null
    and p_session_id is not null
    and p_request_id is not null
    and not coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    and coalesce(public.ifund_current_account_is_active(), false)
    and coalesce(public.ifund_current_user_has_current_terms(), false)
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.email_confirmed_at is not null
        and u.deleted_at is null
    )
    and exists (
      select 1
      from public.ifund_story_campaign_creation_sessions s
      where s.id = p_session_id
        and s.owner_id = auth.uid()
        and s.request_id = p_request_id
        and s.expires_at > statement_timestamp()
    ),
    false
  );
$function$;

revoke all on function public.ifund_story_campaign_creation_session_authorized(uuid, uuid) from public, anon;
grant execute on function public.ifund_story_campaign_creation_session_authorized(uuid, uuid) to authenticated;
comment on function public.ifund_story_campaign_creation_session_authorized(uuid, uuid) is
  'Verifies an unexpired campaign-creation session belongs to the current verified IFund owner and exact Story request.';

commit;
