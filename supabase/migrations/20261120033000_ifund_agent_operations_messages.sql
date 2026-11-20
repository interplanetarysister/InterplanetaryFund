-- Private operations-room messages (NEXUS advisory analysis plus
-- administrator discussions) for the member's own team. Both ends are
-- verified administrators: the frontend gates reads and posts on the hosted
-- RPC and the Worker writes through service_role, so the table itself grants
-- nothing to members. Agent entries are written only by the privileged
-- Worker and are never returned to anyone except verified administrators.
begin;

-- The hosted RPC exists in production. Create a harness-only stand-in when
-- this migration runs against an isolated catalog that has not received the
-- hosted definition; production keeps the hosted behavior.
do $do$
begin
  if to_regprocedure('public.ifund_current_user_is_verified_admin()') is null then
    create function public.ifund_current_user_is_verified_admin()
    returns boolean
    language sql
    stable
    set search_path = ''
    as $fn$
      select coalesce((select true
        from auth.users u
        where u.id = auth.uid()
          and u.is_anonymous is not true
          and u.email_confirmed_at is not null), false)
    $fn$;
  end if;
end
$do$;

create table if not exists public.ifund_agent_operations_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  speaker_type text not null,
  agent_id text,
  body text not null,
  event_type text not null,
  source_kind text,
  source_receipt text,
  author_user_id uuid,
  created_at timestamptz not null default now()
);

-- The room is the private operations surface for the member's own team:
-- verified administrators only, for both reads and posts.
create policy ifund_agent_operations_messages_admin_read
  on public.ifund_agent_operations_messages
  for select
  to authenticated
  using (auth.uid() is not null and public.ifund_current_user_is_verified_admin());

create policy ifund_agent_operations_messages_admin_insert
  on public.ifund_agent_operations_messages
  for insert
  to authenticated
  with check (auth.uid() is not null and public.ifund_current_user_is_verified_admin());

create index if not exists ifund_agent_operations_messages_thread_idx
  on public.ifund_agent_operations_messages (thread_id, created_at);

comment on table public.ifund_agent_operations_messages is
  'Private administrator operations-room messages; agent entries require verified runtime receipts.';

commit;
