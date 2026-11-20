-- Privileged background-agent room access is scoped to this room only.
-- No authenticated user or browser receives the Worker token.
create table if not exists ifund_private.ifund_ops_bot_control (
  singleton boolean primary key default true check (singleton),
  secret_sha256 text not null check (secret_sha256 ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists ifund_private.ifund_ops_bot_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.ifund_agent_operations_messages(id),
  status text not null default 'claimed' check (status in ('claimed','completed','failed','superseded')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '5 minutes'),
  finished_at timestamptz
);
create index if not exists ifund_ops_bot_runs_day on ifund_private.ifund_ops_bot_runs(created_at desc);
alter table ifund_private.ifund_ops_bot_control enable row level security;
alter table ifund_private.ifund_ops_bot_runs enable row level security;
revoke all on ifund_private.ifund_ops_bot_control from public,anon,authenticated;
revoke all on ifund_private.ifund_ops_bot_runs from public,anon,authenticated;

create or replace function ifund_private.ifund_ops_bot_valid(p_token text)
returns boolean language sql stable security definer set search_path='' as $$
  select length(coalesce(p_token,''))=64
  and coalesce(p_token,'') ~ '^[a-f0-9]{64}$'
  and exists(
    select 1 from ifund_private.ifund_ops_bot_control c
    where c.singleton=true and c.enabled=true
      and c.secret_sha256=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex')
  );
$$;
revoke all on function ifund_private.ifund_ops_bot_valid(text) from public,anon,authenticated;

create or replace function public.ifund_ops_bot_claim(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  candidate record;
  run_id uuid;
begin
  if not ifund_private.ifund_ops_bot_valid(p_token) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(21012026) then
    return jsonb_build_object('state','busy');
  end if;
  -- Hard daily limit, including failures, prevents unbounded AI spend.
  if (select count(*) from ifund_private.ifund_ops_bot_runs
      where created_at >= date_trunc('day',now())) >= 8 then
    return jsonb_build_object('state','daily_limit');
  end if;
  select m.id,m.body,m.event_type into candidate
  from public.ifund_agent_operations_messages m
  where m.thread_id='00000000-0000-4000-8000-000000000a61'::uuid
    and m.speaker_type='admin' and m.source_kind='admin_post'
    and m.event_type in ('assignment','discussion')
    and length(btrim(m.body)) between 8 and 1100
    and m.created_at < now()-interval '90 seconds'
    and not exists (select 1 from ifund_private.ifund_ops_bot_runs r where r.source_id=m.id)
    and not exists (select 1 from public.ifund_agent_operations_messages answer
      where answer.source_receipt like m.event_type||'-'||m.id::text||':%')
  order by m.created_at
  limit 1;
  if candidate.id is null then return jsonb_build_object('state','empty'); end if;
  insert into ifund_private.ifund_ops_bot_runs(source_id)
  values(candidate.id) on conflict (source_id) do nothing returning id into run_id;
  if run_id is null then return jsonb_build_object('state','busy'); end if;
  return jsonb_build_object('state','claimed','run_id',run_id,
    'message_id',candidate.id,'message',candidate.body,'event_type',candidate.event_type);
end; $$;
revoke all on function public.ifund_ops_bot_claim(text) from public;
grant execute on function public.ifund_ops_bot_claim(text) to anon,authenticated;

create or replace function public.ifund_ops_bot_complete(p_token text,p_run_id uuid,p_messages jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r record;
  m record;
  entry jsonb;
  a text;
  content text;
  slot integer:=0;
  written integer:=0;
  inserted integer;
  seen text[]:=array[]::text[];
begin
  if not ifund_private.ifund_ops_bot_valid(p_token) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select run.id,run.status,run.expires_at,
    source.id as message_id,source.thread_id,source.event_type
    into r
  from ifund_private.ifund_ops_bot_runs run
  join public.ifund_agent_operations_messages source on source.id=run.source_id
  where run.id=p_run_id for update of run;
  if r.id is null or r.status<>'claimed' or r.expires_at<now() then
    raise exception 'Agent run is not current' using errcode='22023';
  end if;
  if jsonb_typeof(p_messages)<>'array' or jsonb_array_length(p_messages)<>3 then
    raise exception 'Three verified specialist messages required' using errcode='22023';
  end if;
  for entry in select value from jsonb_array_elements(p_messages) loop
    slot:=slot+1;
    a:=entry->>'agent';
    content:=btrim(entry->>'summary');
    if a is null or a not in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')
       or a=any(seen) or (slot=3 and a<>'nexus') or (slot<3 and a='nexus')
       or content is null or length(content) not between 1 and 1600 then
      raise exception 'Invalid agent result' using errcode='22023';
    end if;
    seen:=array_append(seen,a);
    insert into public.ifund_agent_operations_messages
      (thread_id,speaker_type,agent_id,body,event_type,source_kind,source_receipt)
    values(r.thread_id,'agent',a,content,
      case when a='nexus' then 'result' else 'analysis' end,
      'verified_agent_runtime',r.event_type||'-'||r.message_id::text||':'||a)
    on conflict do nothing;
    get diagnostics inserted=row_count;
    written:=written+inserted;
  end loop;
  update ifund_private.ifund_ops_bot_runs set
    status=case when written=0 then 'superseded' else 'completed' end,
    finished_at=now() where id=r.id;
  return jsonb_build_object('state',case when written=0 then 'superseded' else 'completed' end,
    'saved',written);
end; $$;
revoke all on function public.ifund_ops_bot_complete(text,uuid,jsonb) from public;
grant execute on function public.ifund_ops_bot_complete(text,uuid,jsonb) to anon,authenticated;

create or replace function public.ifund_ops_bot_fail(p_token text,p_run_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not ifund_private.ifund_ops_bot_valid(p_token) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  update ifund_private.ifund_ops_bot_runs set status='failed',finished_at=now()
   where id=p_run_id and status='claimed';
  return found;
end; $$;
revoke all on function public.ifund_ops_bot_fail(text,uuid) from public;
grant execute on function public.ifund_ops_bot_fail(text,uuid) to anon,authenticated;
