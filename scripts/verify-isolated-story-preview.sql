-- Canonical ssibsfmtodgximseeqsv: operator-only permission verification.
-- Uses existing identities under simulated PostgREST roles/claims, not a real
-- member JWT. Every temporary preview-control/key change is rolled back.
-- No user, agreement, entitlement, campaign, task or financial record changes.
-- No model call or member execution receipt is produced by this probe.
do $probe$
declare
  v_candidate uuid;
  v_actor uuid;
  v_access jsonb;
  v_context jsonb;
  v_secret text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  v_original_digest text;
  v_original_preview boolean;
  v_assignments bigint;
  v_checks jsonb := '[]'::jsonb;
begin
  select preview_worker_secret_sha256,preview_enabled
    into v_original_digest,v_original_preview
    from ifund_ops.workforce_control where singleton for update;
  if not found or exists(select 1 from ifund_ops.workforce_control where enabled)
    or exists(select 1 from ifund_story_runtime.control where enabled) then
    raise exception 'Production controls must remain off during this preview probe';
  end if;
  select count(*) into v_assignments from ifund_ops.workforce_assignments;
  begin
    -- Find an already eligible identity without granting or extending access.
    for v_candidate in select p.id from public.ifund_profiles p
      join auth.users u on u.id=p.id
      where p.account_status='active' and not p.account_deletion_pending
        and u.email_confirmed_at is not null
        and exists(select 1 from public.ifund_legal_acceptances l
          where l.owner_id=p.id and l.terms_version='2026-10-13-v3'
            and l.explicit_consent)
      order by p.id
    loop
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_candidate,'role','authenticated')::text,true);
      perform set_config('request.jwt.claim.sub',v_candidate::text,true);
      execute 'set local role authenticated';
      select public.ifund_story_subscription() into v_access;
      execute 'reset role';
      if coalesce((v_access->>'level')::integer,0)>0 then v_actor:=v_candidate; exit; end if;
    end loop;
    if v_actor is null then raise exception 'An existing eligible and consenting identity is required; no access was granted'; end if;
    if not exists(select 1 from public.ifund_legal_acceptances
      where owner_id=v_actor and terms_version='2026-10-13-v3' and explicit_consent) then
      raise exception 'The existing identity must already have accepted the current agreement';
    end if;

    -- Uncommitted temporary preview proof. No Worker key is read or changed;
    -- this digest exists only inside the rolled-back subtransaction.
    update ifund_ops.workforce_control set preview_enabled=true,
      preview_worker_secret_sha256=encode(sha256(convert_to(v_secret,'UTF8')),'hex')
      where singleton;
    perform set_config('request.headers','{}',true);
    execute 'set local role authenticated';
    begin
      perform public.ifund_story_context(null);
      raise exception 'A member JWT alone opened disabled writing';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('member identity alone cannot open disabled writing');
    end;
    perform set_config('request.headers',jsonb_build_object('x-ifund-workforce-key',repeat('0',64),'x-ifund-workforce-environment','preview')::text,true);
    begin
      perform public.ifund_story_context(null);
      raise exception 'A forged environment label opened preview';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('wrong proof and client environment label denied');
    end;
    perform set_config('request.headers',jsonb_build_object('x-ifund-workforce-key',v_secret)::text,true);
    execute 'reset role';
    update ifund_ops.workforce_control set preview_enabled=false where singleton;
    execute 'set local role authenticated';
    begin
      perform public.ifund_story_context(null);
      raise exception 'A disabled preview opened writing';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('valid preview proof cannot override the disabled preview flag');
    end;
    execute 'reset role';
    update ifund_ops.workforce_control set preview_enabled=true where singleton;
    execute 'set local role authenticated';
    select public.ifund_story_context(null) into v_context;
    if v_context is null or not(v_context ? 'campaigns') then raise exception 'Preview context did not return its existing contract'; end if;
    v_checks:=v_checks||jsonb_build_array('eligible preview context works with both production gates off');
    begin
      perform ifund_workforce_runtime.story_preview_enabled();
      raise exception 'Private helper exposed to a browser role';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('private preview helper remains inaccessible to browser roles');
    end;
    execute 'reset role';
    update ifund_ops.workforce_control set free_plan_verified_until=now()-interval '1 second' where singleton;
    execute 'set local role authenticated';
    begin
      perform public.ifund_story_context(null);
      raise exception 'Expired Free-plan evidence opened preview';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('expired Free-plan evidence denies preview context');
    end;
    perform public.ifund_workforce_queued();
    v_checks:=v_checks||jsonb_build_array('owner recovery remains accessible after preview eligibility expires');
    execute 'set local role anon';
    begin
      perform public.ifund_story_context(null);
      raise exception 'Anonymous role accessed writing context';
    exception when insufficient_privilege then
      v_checks:=v_checks||jsonb_build_array('anonymous context denied');
    end;
    raise sqlstate 'ZP002' using message='Intentional rollback of preview permission verification';
  exception when sqlstate 'ZP002' then null;
  end;
  if not exists(select 1 from ifund_ops.workforce_control
    where singleton and not enabled
      and preview_enabled=v_original_preview
      and preview_worker_secret_sha256 is not distinct from v_original_digest)
    or exists(select 1 from ifund_story_runtime.control where enabled)
    or (select count(*) from ifund_ops.workforce_assignments)<>v_assignments then
    raise exception 'Preview probe did not preserve the initial state';
  end if;
  perform set_config('ifund.story_preview_probe_result',jsonb_build_object(
    'status','PASS','checks',v_checks,'persisted_control_or_key_changes',0,
    'inference_calls',0,'member_execution_receipt',false)::text,false);
end
$probe$;
select current_setting('ifund.story_preview_probe_result')::jsonb as verification;
