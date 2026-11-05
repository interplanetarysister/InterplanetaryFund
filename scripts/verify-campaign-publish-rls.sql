-- Live permission probe for an existing canonical database. All campaign
-- writes occur in an exception subtransaction and are rolled back. No user,
-- profile, schema, payment or existing campaign is changed. Two existing
-- verified active identities are required; their identifiers are not returned.
do $probe$
declare
  v_owner uuid;
  v_other uuid;
  v_campaign uuid;
  v_count integer;
  v_checks jsonb := '[]'::jsonb;
begin
  select p.id into v_owner from public.ifund_profiles p
    join auth.users u on u.id=p.id
    where p.account_status='active' and p.account_deletion_pending=false
      and u.email_confirmed_at is not null order by p.id limit 1;
  select p.id into v_other from public.ifund_profiles p
    join auth.users u on u.id=p.id
    where p.account_status='active' and p.account_deletion_pending=false
      and u.email_confirmed_at is not null and p.id<>v_owner order by p.id limit 1;
  if v_owner is null or v_other is null then raise exception 'Two verified active test identities are required'; end if;
  begin
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',v_owner::text,true);
    execute 'set local role authenticated';
    insert into public.ifund_campaigns(owner_id,title,category,status)
      values(v_owner,'Synthetic rollback-only publish permission probe','community','draft') returning id into v_campaign;
    if not exists(select 1 from public.ifund_campaigns where id=v_campaign and status='draft') then raise exception 'Owner draft reload failed'; end if;
    v_checks := v_checks || jsonb_build_array('owner draft insert and reload');
    begin
      update public.ifund_campaigns set status='active' where id=v_campaign and owner_id=v_owner and status='draft';
      raise exception 'Incomplete campaign was published';
    exception when check_violation then
      v_checks := v_checks || jsonb_build_array('incomplete publication rejected by live constraint');
    end;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',v_other::text,true);
    if exists(select 1 from public.ifund_campaigns where id=v_campaign) then raise exception 'Other owner could read private draft'; end if;
    update public.ifund_campaigns set title='Unauthorized change' where id=v_campaign;
    get diagnostics v_count=row_count;
    if v_count<>0 then raise exception 'Other owner could edit private draft'; end if;
    begin
      insert into public.ifund_campaigns(owner_id,title,category,status) values(v_owner,'Unauthorized insert','community','draft');
      raise exception 'Ownership impersonation was allowed';
    exception when insufficient_privilege then
      v_checks := v_checks || jsonb_build_array('other owner draft read, update and impersonated insert denied');
    end;
    execute 'set local role anon';
    if exists(select 1 from public.ifund_campaigns where id=v_campaign) then raise exception 'Anonymous visitor could read private draft'; end if;
    v_checks := v_checks || jsonb_build_array('anonymous draft read denied');
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',v_owner::text,true);
    update public.ifund_campaigns set summary='Synthetic test only',story='This temporary campaign is never committed.',goal_amount=10,status='active'
      where id=v_campaign and owner_id=v_owner and status='draft';
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'Owner publish did not affect exactly one existing draft'; end if;
    v_checks := v_checks || jsonb_build_array('owner publishes the same campaign with reviewed content');
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',v_other::text,true);
    update public.ifund_campaigns set title='Unauthorized public change' where id=v_campaign;
    get diagnostics v_count=row_count;
    if v_count<>0 then raise exception 'Other owner could edit published campaign'; end if;
    v_checks := v_checks || jsonb_build_array('other owner published campaign update denied');
    execute 'set local role anon';
    if not exists(select 1 from public.ifund_campaigns where id=v_campaign and status='active') then raise exception 'Published campaign missing from anonymous Discover read'; end if;
    v_checks := v_checks || jsonb_build_array('published campaign visible to anonymous Discover read');
    begin
      perform owner_id from public.ifund_campaigns where id=v_campaign;
      raise exception 'Anonymous private owner column exposed';
    exception when insufficient_privilege then
      v_checks := v_checks || jsonb_build_array('anonymous private owner column denied');
    end;
    -- Roll back every test write and local role/claim change. PL/pgSQL keeps
    -- the verification variables while reverting the subtransaction.
    raise sqlstate 'ZP001' using message='Intentional rollback of successful permission probe';
  exception when sqlstate 'ZP001' then null;
  end;
  if exists(select 1 from public.ifund_campaigns where id=v_campaign) then raise exception 'Test campaign was not rolled back'; end if;
  perform set_config('ifund.publish_probe_result',jsonb_build_object('status','PASS','checks',v_checks,'persisted_test_campaigns',0)::text,false);
end
$probe$;
select current_setting('ifund.publish_probe_result')::jsonb as verification;
