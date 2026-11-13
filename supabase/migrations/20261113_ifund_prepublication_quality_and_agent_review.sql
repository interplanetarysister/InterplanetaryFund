-- Release-staged migration. DO NOT APPLY during the owner-controlled build hold.
-- Existing active campaigns are retained unchanged; only a NEW transition
-- into active state must meet the 3,500-character story requirement.
create or replace function public.ifund_prepublication_story_gate()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' and char_length(btrim(coalesce(new.story,''))) < 3500 then
    if tg_op = 'INSERT' then
      raise exception 'Publishing requires a full-length story of at least 3500 characters.'
        using errcode='23514', constraint='ifund_prepublication_story_min_3500';
    elsif old.status is distinct from 'active' then
      raise exception 'Publishing requires a full-length story of at least 3500 characters.'
        using errcode='23514', constraint='ifund_prepublication_story_min_3500';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists ifund_prepublication_story_gate_trigger on public.ifund_campaigns;
create trigger ifund_prepublication_story_gate_trigger
before insert or update of status,story on public.ifund_campaigns
for each row execute function public.ifund_prepublication_story_gate();

-- Suggestions are private owner-scoped work items, not automatic AI executions.
-- No full campaign story, contact information, donor identity or external token is stored.
create table if not exists public.ifund_editorial_agent_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  finding_id text not null check (char_length(finding_id) between 4 and 64),
  lead_agent text not null,
  review_agents text[] not null default array['nexus','story','polaris']::text[],
  task_title text not null,
  suggested_action text not null,
  discussion jsonb not null default '[]'::jsonb,
  review_status text not null default 'queued' check (review_status in ('queued','under_review','owner_action_needed','acknowledged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,campaign_id,finding_id)
);
create index if not exists ifund_editorial_agent_reviews_owner_created_idx
 on public.ifund_editorial_agent_reviews(owner_id,created_at desc);
alter table public.ifund_editorial_agent_reviews enable row level security;
revoke all on public.ifund_editorial_agent_reviews from public,anon,authenticated;

-- Approved findings and agent routing are server-controlled, not supplied by browser claims.
create or replace function public.ifund_queue_editorial_agent_review(
  p_campaign_id uuid, p_finding_ids text[]
) returns table(review_id uuid,finding_id text,lead_agent text,review_status text)
language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare
  v_owner uuid:=auth.uid();
  v_id text;
  v_agent text;
  v_title text;
  v_advice text;
  v_lead_review text;
  v_partner_review text;
  v_existing uuid;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     or not exists(select 1 from auth.users u where u.id=v_owner
       and u.is_anonymous is false and u.email_confirmed_at is not null) then
    raise exception 'Confirmed active account required' using errcode='42501';
  end if;
  if p_campaign_id is null or not exists(
      select 1 from public.ifund_campaigns c
      where c.id=p_campaign_id and c.owner_id=v_owner and c.status in ('draft','paused')
  ) then raise exception 'Only a saved, owned draft or paused campaign can be reviewed'
     using errcode='42501';
  end if;
  if p_finding_ids is null or cardinality(p_finding_ids) not between 1 and 12 then
    raise exception 'Choose between 1 and 12 findings' using errcode='22023';
  end if;
  foreach v_id in array p_finding_ids loop
    select m.agent,m.title,m.advice into v_agent,v_title,v_advice
    from (values
      ('story_depth','story','Develop the full-length story','Explain verified need, funding plan, timeline and impact without inventing facts.'),
      ('story_terminal_punctuation','story','Review final punctuation','Use appropriate sentence-ending punctuation.'),
      ('excess_punctuation','story','Review repeated punctuation','Normalize repeated marks while preserving intent.'),
      ('multiple_spaces','echo','Normalize unintended spacing','Improve readability without altering claims.'),
      ('run_on_paragraph','story','Break up long passages','Add appropriate sentence boundaries.'),
      ('repeated_sentences','polaris','Remove repeated passages','Compare sections and remove genuine duplication only.'),
      ('summary_repeated','polaris','Make story add new information','Remove a verbatim summary duplicate from the full story.'),
      ('title_repetition','echo','Reduce headline repetition','Check title repetition across campaign fields.'),
      ('budget_clarity','orbit','Clarify use of funds','Detail known budget categories; do not fabricate costs.'),
      ('timeline_updates','nexus','Clarify milestones and updates','Outline realistic updates and milestones where known.')
    ) as m(id,agent,title,advice) where m.id=v_id;
    if v_agent is null then raise exception 'Unknown editorial finding' using errcode='22023'; end if;
    v_lead_review := case v_agent
      when 'story' then 'STORY: Check narrative clarity, punctuation, accuracy and beneficiary voice.'
      when 'polaris' then 'POLARIS: Check structure, repeated claims, sequencing and evidence.'
      when 'echo' then 'ECHO: Check supporter-facing readability and respectful wording.'
      when 'orbit' then 'ORBIT: Verify budget language against known costs; never promise funds.'
      else 'NEXUS: Check milestones, accountability and prioritization.' end;
    v_partner_review := 'Cross-review: STORY checks facts and tone; POLARIS checks structure; ECHO checks readability. Owner approves all edits before publication.';
    insert into public.ifund_editorial_agent_reviews
       (owner_id,campaign_id,finding_id,lead_agent,task_title,suggested_action,
        review_agents,discussion,review_status)
    values (v_owner,p_campaign_id,v_id,v_agent,v_title,v_advice,
        array[v_agent,'story','polaris','echo','nexus']::text[],
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('agent',v_agent,'kind','rule_based_proposal','text',v_lead_review),
          pg_catalog.jsonb_build_object('agent','nexus','kind','rule_based_cross_review','text',v_partner_review)
        ),'queued')
    on conflict (owner_id,campaign_id,finding_id) do update
       set updated_at=now()
    returning id into v_existing;
    return query select r.id,r.finding_id,r.lead_agent,r.review_status
       from public.ifund_editorial_agent_reviews r where r.id=v_existing;
    v_id:=null;v_agent:=null;v_title:=null;v_advice:=null;
  end loop;
end $$;

create or replace function public.ifund_my_editorial_agent_reviews()
returns table(review_id uuid,campaign_id uuid,finding_id text,lead_agent text,
  task_title text,suggested_action text,discussion jsonb,review_status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     then raise exception 'Active account required' using errcode='42501'; end if;
  return query select r.id,r.campaign_id,r.finding_id,r.lead_agent,
    r.task_title,r.suggested_action,r.discussion,r.review_status,r.created_at
    from public.ifund_editorial_agent_reviews r
    where r.owner_id=v_owner order by r.created_at desc limit 100;
end $$;
revoke all on function public.ifund_queue_editorial_agent_review(uuid,text[]) from public,anon;
revoke all on function public.ifund_my_editorial_agent_reviews() from public,anon;
grant execute on function public.ifund_queue_editorial_agent_review(uuid,text[]) to authenticated;
grant execute on function public.ifund_my_editorial_agent_reviews() to authenticated;
