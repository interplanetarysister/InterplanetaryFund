
create table if not exists ifund_training.collaboration_routes(
 origin_agent text not null check(origin_agent in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
 target_agent text not null check(target_agent in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
 source_version text not null default 'agentTrainingDirectory-2026-11-15',
 created_at timestamptz not null default now(),
 primary key(origin_agent,target_agent),
 check(origin_agent<>target_agent)
);
create table if not exists ifund_training.cross_agent_recommendations(
 candidate_id uuid not null references ifund_training.candidates(id),
 target_agent text not null check(target_agent in ('nexus','story','orbit','polaris','forge','echo','pulse','link','discover')),
 status text not null default 'proposed' check(status in ('proposed','accepted','rejected')),
 created_at timestamptz not null default now(),
 primary key(candidate_id,target_agent)
);
create index if not exists ifund_training_cross_agent_by_target on ifund_training.cross_agent_recommendations(target_agent,status);
alter table ifund_training.collaboration_routes enable row level security;
alter table ifund_training.cross_agent_recommendations enable row level security;
revoke all on ifund_training.collaboration_routes,ifund_training.cross_agent_recommendations from public,anon,authenticated;
grant select,insert,update,delete on ifund_training.collaboration_routes,ifund_training.cross_agent_recommendations to service_role;

insert into ifund_training.collaboration_routes(origin_agent,target_agent)
select origin_agent,target_agent from (values
('story',array['orbit','polaris','echo']::text[]),
('orbit',array['story','polaris']::text[]),
('polaris',array['story','forge','orbit']::text[]),
('forge',array['pulse','echo','link']::text[]),
('echo',array['story','orbit','pulse']::text[]),
('pulse',array['link','echo','polaris']::text[]),
('link',array['discover','orbit','forge']::text[]),
('discover',array['link','pulse']::text[]),
('nexus',array['story','orbit','polaris','forge','echo','pulse','link','discover']::text[])
) as x(origin_agent,targets)
cross join lateral unnest(x.targets) as target_agent
on conflict(origin_agent,target_agent) do nothing;

create or replace function ifund_training.route_new_skill_candidate()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into ifund_training.cross_agent_recommendations(candidate_id,target_agent)
 select new.id,r.target_agent
 from ifund_training.collaboration_routes r
 where r.origin_agent=new.agent_id
 on conflict do nothing;
 return new;
end $$;
revoke all on function ifund_training.route_new_skill_candidate() from public,anon,authenticated;
drop trigger if exists ifund_training_candidate_collaboration_router on ifund_training.candidates;
create trigger ifund_training_candidate_collaboration_router
after insert on ifund_training.candidates
for each row execute function ifund_training.route_new_skill_candidate();
insert into ifund_training.cross_agent_recommendations(candidate_id,target_agent)
select c.id,r.target_agent from ifund_training.candidates c
join ifund_training.collaboration_routes r on r.origin_agent=c.agent_id
on conflict do nothing;
