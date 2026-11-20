-- Reproducible schema for the verified-administrator Agent Operations Room.
-- The same contract was introduced in the production database. Keep it in
-- versioned source so future deployments and test environments are consistent.
create table if not exists public.ifund_agent_operations_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  speaker_type text not null check (speaker_type in ('admin','agent')),
  agent_id text check (agent_id in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
  author_user_id uuid references auth.users(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  event_type text not null default 'discussion' check (event_type in ('discussion','assignment','analysis','result','blocker')),
  source_kind text not null default 'admin_post' check (source_kind in ('admin_post','verified_agent_runtime')),
  source_receipt text,
  created_at timestamptz not null default now(),
  constraint ifund_ops_authorship check (
    (speaker_type='admin' and agent_id is null and author_user_id is not null and source_kind='admin_post' and source_receipt is null)
    or
    (speaker_type='agent' and agent_id is not null and author_user_id is null and source_kind='verified_agent_runtime' and source_receipt is not null)
  )
);
create index if not exists ifund_agent_ops_thread_time
  on public.ifund_agent_operations_messages(thread_id, created_at desc);
alter table public.ifund_agent_operations_messages enable row level security;

revoke all on public.ifund_agent_operations_messages from public, anon, authenticated;
grant select, insert on public.ifund_agent_operations_messages to authenticated;

drop policy if exists verified_admin_read_agent_operations on public.ifund_agent_operations_messages;
create policy verified_admin_read_agent_operations
  on public.ifund_agent_operations_messages for select to authenticated
  using ((select public.ifund_current_user_is_verified_admin()));

drop policy if exists verified_admin_write_own_messages on public.ifund_agent_operations_messages;
create policy verified_admin_write_own_messages
  on public.ifund_agent_operations_messages for insert to authenticated
  with check (
    (select public.ifund_current_user_is_verified_admin())
    and speaker_type='admin'
    and author_user_id=(select auth.uid())
    and agent_id is null
    and source_kind='admin_post'
    and source_receipt is null
  );

comment on table public.ifund_agent_operations_messages is
  'Private verified-administrator room. Browser clients may write only their own admin messages. Agent messages require separately verified runtime receipts from privileged backend.';
