begin;
-- Private What If? Engine foundation. No financial, OAuth, external messaging or public publishing operations.
create table public.ifund_missions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null default '' check(length(title)<=160),
 original_prompt text not null check(length(original_prompt) between 1 and 12000),
 goal_type text not null default 'other' check(goal_type in ('emergency','personal','education','business','creative','community','environment','other')),
 desired_outcome text not null default '' check(length(desired_outcome)<=4000),
 summary text not null default '' check(length(summary)<=4000),
 status text not null default 'draft' check(status in ('draft','planned','in_progress','completed','archived')),
 privacy text not null default 'private' check(privacy='private'),
 current_plan_version integer not null default 0 check(current_plan_version between 0 and 10000),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 completed_at timestamptz,archived_at timestamptz,
 unique(id,owner_id)
);
create index ifund_missions_owner_list on public.ifund_missions(owner_id,updated_at desc,id);
comment on table public.ifund_missions is 'Private Mission, separate from campaign and financial data.';
create function public.ifund_missions_before_update() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.original_prompt is distinct from old.original_prompt then
  raise exception 'Mission identity or original prompt is immutable' using errcode='23514';
 end if;
 if new.revision is distinct from old.revision+1 then raise exception 'Stale mission revision' using errcode='40001'; end if;
 if new.status is distinct from old.status and not (
  (old.status='draft' and new.status in ('planned','in_progress','archived')) or
  (old.status='planned' and new.status in ('draft','in_progress','archived')) or
  (old.status='in_progress' and new.status in ('planned','completed','archived')) or
  (old.status='completed' and new.status in ('in_progress','archived')) or
  (old.status='archived' and new.status in ('draft','in_progress'))
 ) then raise exception 'Invalid Mission status transition' using errcode='23514'; end if;
 new.updated_at=now();
 new.completed_at=case when new.status='completed' then coalesce(old.completed_at,now()) else null end;
 new.archived_at=case when new.status='archived' then coalesce(old.archived_at,now()) else null end;
 return new;
end $$;
create trigger ifund_missions_revision_guard before update on public.ifund_missions
 for each row execute function public.ifund_missions_before_update();

create table public.ifund_mission_plan_versions(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 version integer not null check(version between 1 and 10000),
 input_revision integer not null check(input_revision>0),
 structured_plan jsonb not null check(jsonb_typeof(structured_plan)='object' and octet_length(structured_plan::text)<=131072),
 source_kind text not null check(source_kind in ('assistant_draft','owner_revision','manual_template')),
 model_id text check(length(model_id)<=180),
 evidence_note text not null default '' check(length(evidence_note)<=2000),
 created_at timestamptz not null default now(),unique(mission_id,version),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_plan_owner on public.ifund_mission_plan_versions(owner_id,mission_id,version desc);
create table public.ifund_mission_tasks(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 milestone_key text check(length(milestone_key)<=120),
 title text not null check(length(btrim(title)) between 1 and 240),
 description text not null default '' check(length(description)<=4000),
 state text not null default 'todo' check(state in ('todo','in_progress','blocked','done','cancelled')),
 sort_order integer not null default 0,due_at timestamptz,completed_at timestamptz,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_tasks_order on public.ifund_mission_tasks(owner_id,mission_id,sort_order,id);
create function public.ifund_mission_tasks_before_update() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.mission_id is distinct from old.mission_id then
  raise exception 'Task identity cannot change' using errcode='23514';
 end if;
 if new.revision is distinct from old.revision+1 then raise exception 'Stale task revision' using errcode='40001'; end if;
 new.completed_at=case when new.state='done' then coalesce(old.completed_at,now()) else null end;
 new.updated_at=now();return new;
end $$;
create trigger ifund_mission_tasks_revision_guard before update on public.ifund_mission_tasks
 for each row execute function public.ifund_mission_tasks_before_update();

create table public.ifund_mission_campaign_links(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
 linked_at timestamptz not null default now(),unique(mission_id,campaign_id),unique(campaign_id),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_campaign_links_owner on public.ifund_mission_campaign_links(owner_id,mission_id);
create function public.ifund_mission_campaign_owner_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if not exists (select 1 from public.ifund_campaigns c where c.id=new.campaign_id and c.owner_id=new.owner_id) then
  raise exception 'Mission and campaign owners must match' using errcode='23514'; end if;
 return new;
end $$;
create trigger ifund_mission_campaign_owner_check before insert or update on public.ifund_mission_campaign_links
 for each row execute function public.ifund_mission_campaign_owner_guard();

create table public.ifund_mission_opportunity_matches(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 opportunity_id text references public.ifund_opportunity(id) on delete set null,
 source_url text check(source_url is null or (length(source_url)<=2000 and source_url~'^https://')),
 provider_name text not null default '' check(length(provider_name)<=160),
 title text not null check(length(btrim(title)) between 1 and 240),
 explanation text not null default '' check(length(explanation)<=3000),
 source_status text not null default 'unverified' check(source_status in ('unverified','source_checked','provider_verified','expired')),
 match_status text not null default 'suggested' check(match_status in ('suggested','potential_fit','not_eligible','interested','application_started','submitted','offered','confirmed','fulfilled','declined','expired')),
 checked_at timestamptz,expires_at timestamptz,evidence_ref text check(length(evidence_ref)<=500),
 created_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_matches_owner on public.ifund_mission_opportunity_matches(owner_id,mission_id,created_at desc);

create table public.ifund_mission_connection_intents(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 provider text not null check(provider~'^[a-z0-9][a-z0-9_-]{1,70}$'),
 requested_capability text not null check(requested_capability in ('read_profile','research','draft','publish','send','apply')),
 state text not null default 'requested' check(state in ('requested','awaiting_oauth','authorized','denied','revoked','failed')),
 external_connection_id uuid references public.ifund_connections(id) on delete set null,
 authorized_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_connections_owner on public.ifund_mission_connection_intents(owner_id,mission_id,provider);
create function public.ifund_mission_connection_owner_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if new.external_connection_id is not null and not exists(
  select 1 from public.ifund_connections c where c.id=new.external_connection_id and
  c.owner_id=new.owner_id and c.status='connected' and c.verified_at is not null
 ) then raise exception 'Connection not verified for this owner' using errcode='23514';end if;
 return new;
end $$;
create trigger ifund_mission_connection_owner_check before insert or update on public.ifund_mission_connection_intents
 for each row execute function public.ifund_mission_connection_owner_guard();

create table public.ifund_mission_cost_items(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 label text not null check(length(btrim(label)) between 1 and 200),
 estimated_minor bigint not null default 0 check(estimated_minor between 0 and 1000000000000),
 currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),
 source_kind text not null default 'owner_estimate' check(source_kind in ('owner_estimate','documented_quote')),
 source_note text not null default '' check(length(source_note)<=2000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_costs_owner on public.ifund_mission_cost_items(owner_id,mission_id);

create table public.ifund_mission_agent_actions(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 agent_id text not null check(agent_id in ('nexus','polaris','orbit','discover','pulse','link','story','echo','forge')),
 action_kind text not null check(action_kind in ('research','draft','opportunity_check','external_message','external_application','external_publish')),
 status text not null default 'proposed' check(status in ('proposed','awaiting_approval','approved','running','completed','failed','rejected','cancelled')),
 description text not null check(length(description) between 1 and 3000),
 scope jsonb not null default '{}'::jsonb check(jsonb_typeof(scope)='object' and octet_length(scope::text)<=8192),
 approval_actor uuid references auth.users(id),approved_at timestamptz,approval_expires_at timestamptz,
 external_receipt_ref text check(length(external_receipt_ref)<=500),
 idempotency_key uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(mission_id,idempotency_key),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade,
 check((approved_at is null and approval_actor is null) or (approved_at is not null and approval_actor=owner_id))
);
create index ifund_mission_agent_actions_owner on public.ifund_mission_agent_actions(owner_id,mission_id,created_at desc);

create table public.ifund_mission_events(
 id uuid primary key default gen_random_uuid(),mission_id uuid not null,owner_id uuid not null,
 event_key uuid not null,actor_kind text not null check(actor_kind in ('member','agent','system','provider')),
 event_type text not null check(event_type in ('created','updated','status_changed','plan_generated','task_changed','campaign_linked','match_added','connection_requested','agent_proposed','agent_approved','agent_finished','archived','reopened')),
 safe_summary text not null default '' check(length(safe_summary)<=1600),
 receipt_ref text check(length(receipt_ref)<=500),created_at timestamptz not null default now(),
 unique(mission_id,event_key),
 foreign key(mission_id,owner_id) references public.ifund_missions(id,owner_id) on delete cascade
);
create index ifund_mission_events_owner on public.ifund_mission_events(owner_id,mission_id,created_at desc);

-- All nine exposed tables use RLS and deny-by-default grants.
do $$
declare t text;
begin
 foreach t in array array['ifund_missions','ifund_mission_plan_versions','ifund_mission_tasks',
 'ifund_mission_campaign_links','ifund_mission_opportunity_matches','ifund_mission_connection_intents',
 'ifund_mission_cost_items','ifund_mission_agent_actions','ifund_mission_events']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
create policy ifund_missions_owner_read on public.ifund_missions for select to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_missions_owner_add on public.ifund_missions for insert to authenticated
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_missions_owner_edit on public.ifund_missions for update to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false)
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
do $$
declare t text;
begin
 foreach t in array array['ifund_mission_plan_versions','ifund_mission_tasks',
 'ifund_mission_campaign_links','ifund_mission_opportunity_matches','ifund_mission_connection_intents',
 'ifund_mission_cost_items','ifund_mission_agent_actions','ifund_mission_events']
 loop
  execute format('create policy %I on public.%I for select to authenticated using (owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and coalesce((select auth.jwt()->>''is_anonymous'')::boolean,false)=false)',t||'_owner_read',t);
 end loop;
end $$;
create policy ifund_mission_tasks_owner_add on public.ifund_mission_tasks for insert to authenticated
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_mission_tasks_owner_edit on public.ifund_mission_tasks for update to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false)
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_mission_tasks_owner_delete on public.ifund_mission_tasks for delete to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_mission_costs_owner_add on public.ifund_mission_cost_items for insert to authenticated
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_mission_costs_owner_edit on public.ifund_mission_cost_items for update to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false)
 with check(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy ifund_mission_costs_owner_delete on public.ifund_mission_cost_items for delete to authenticated
 using(owner_id=(select auth.uid()) and (select public.ifund_current_account_is_active()) and
 (select public.ifund_current_user_has_current_terms()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);

grant select on public.ifund_missions,public.ifund_mission_plan_versions,public.ifund_mission_tasks,
 public.ifund_mission_campaign_links,public.ifund_mission_opportunity_matches,
 public.ifund_mission_connection_intents,public.ifund_mission_cost_items,
 public.ifund_mission_agent_actions,public.ifund_mission_events to authenticated;
grant insert(owner_id,title,original_prompt,goal_type,desired_outcome,summary) on public.ifund_missions to authenticated;
grant update(title,goal_type,desired_outcome,summary,status,revision) on public.ifund_missions to authenticated;
grant insert(mission_id,owner_id,milestone_key,title,description,state,sort_order,due_at) on public.ifund_mission_tasks to authenticated;
grant update(milestone_key,title,description,state,sort_order,due_at,revision) on public.ifund_mission_tasks to authenticated;
grant delete on public.ifund_mission_tasks to authenticated;
grant insert(mission_id,owner_id,label,estimated_minor,currency,source_note) on public.ifund_mission_cost_items to authenticated;
grant update(label,estimated_minor,currency,source_note) on public.ifund_mission_cost_items to authenticated;
grant delete on public.ifund_mission_cost_items to authenticated;
revoke all on function public.ifund_missions_before_update(),public.ifund_mission_tasks_before_update(),
 public.ifund_mission_campaign_owner_guard(),public.ifund_mission_connection_owner_guard() from public,anon,authenticated;
commit;