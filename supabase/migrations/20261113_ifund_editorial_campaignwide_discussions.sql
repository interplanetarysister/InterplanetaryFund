-- Stage updated editorial issue vocabulary and private owner discussion.
-- Only apply after explicit review of deployed function and existing records.
-- No automatic AI worker, external contact, financial side-effect or user grant.
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
      ('claim_evidence','polaris','Verify numerical and absolute claims','Check figures and guarantees against independent source evidence; remove unsupported claims.'),
      ('budget_clarity','orbit','Clarify use of funds','Detail known budget categories; do not fabricate costs.'),
      ('timeline_updates','nexus','Clarify milestones and updates','Outline realistic updates and milestones where known.'),
      ('title_spacing','echo','Polish title spacing','Review excess spaces and punctuation in campaign title.'),
      ('summary_punctuation','echo','Polish short-description punctuation','Review ending punctuation and accidental excess spaces in the summary.'),
      ('story_punctuation','story','Polish full-story punctuation','Review ending punctuation and spacing without changing beneficiary claims.'),
      ('summary_redundancy','polaris','Review repeated summary sentences','Remove exact repeated sentences only after confirming meaning.'),
      ('story_redundancy','polaris','Review repeated story sentences','Retain first occurrences; do not remove necessary detail.'),
      ('cross_field_summary','polaris','Avoid duplicating the entire summary in the story','Add verified supporting facts rather than repeating the short description.'),
      ('cross_field_title','echo','Review repeated campaign headline','Keep purposeful repetition and improve clarity where needed.'),
      ('cross_field_sentences','polaris','Review repeated description and story sentences','Retain useful detail while removing unneeded sentence duplication.')
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
       set updated_at=now(),
           review_status=case when public.ifund_editorial_agent_reviews.review_status='acknowledged'
             then 'queued' else public.ifund_editorial_agent_reviews.review_status end
    returning id into v_existing;
    return query select r.id,r.finding_id,r.lead_agent,r.review_status
       from public.ifund_editorial_agent_reviews r where r.id=v_existing;
    v_id:=null;v_agent:=null;v_title:=null;v_advice:=null;
  end loop;
end $$;


-- Owner-provided discussion stays private and never represents an AI execution.
-- Rule-based partner review is labeled as such in both SQL and the member UI.
create or replace function public.ifund_add_editorial_review_comment(
  p_review_id uuid, p_comment text
) returns table(review_id uuid,reply_count integer,review_status text)
language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare
  v_owner uuid:=auth.uid();
  v_record public.ifund_editorial_agent_reviews%rowtype;
  v_count integer;
  v_body text;
begin
  if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
     or not exists(select 1 from auth.users u where u.id=v_owner
       and u.is_anonymous is false and u.email_confirmed_at is not null) then
    raise exception 'Confirmed active owner required' using errcode='42501';
  end if;
  v_body:=btrim(coalesce(p_comment,''));
  if char_length(v_body) not between 8 and 1200 then
    raise exception 'Write a comment of 8 to 1200 characters' using errcode='22023';
  end if;
  select * into v_record from public.ifund_editorial_agent_reviews r
    where r.id=p_review_id and r.owner_id=v_owner for update;
  if not found then raise exception 'Private review not found' using errcode='42501';end if;
  v_count:=pg_catalog.jsonb_array_length(v_record.discussion);
  if v_count>=29 then raise exception 'Discussion limit reached; start a new review when needed' using errcode='22023';end if;
  update public.ifund_editorial_agent_reviews r set
    discussion=r.discussion || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'agent','owner','kind','owner_comment','text',v_body,'recorded_at',now()::text
      ),
      pg_catalog.jsonb_build_object(
        'agent','nexus','kind','rule_based_next_step',
        'text','Owner feedback recorded. STORY should check factual tone; POLARIS should review duplication; ECHO should review clarity. These suggestions require actual specialist execution before they can be marked independently reviewed.',
        'recorded_at',now()::text
      )
    ),
    review_status='owner_action_needed',
    updated_at=now()
    where r.id=p_review_id and r.owner_id=v_owner;
  return query select r.id,pg_catalog.jsonb_array_length(r.discussion)::integer,r.review_status
    from public.ifund_editorial_agent_reviews r where r.id=p_review_id;
end $$;
revoke all on function public.ifund_add_editorial_review_comment(uuid,text) from public,anon;
grant execute on function public.ifund_add_editorial_review_comment(uuid,text) to authenticated;
