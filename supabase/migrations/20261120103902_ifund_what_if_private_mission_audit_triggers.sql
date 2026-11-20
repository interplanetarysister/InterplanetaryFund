begin;
create or replace function public.ifund_mission_audit_change()
returns trigger language plpgsql security definer set search_path=''
as $audit$
declare v_mission uuid; v_owner uuid; v_event text; v_message text;
begin
 if tg_table_name='ifund_missions' then
   v_mission:=new.id; v_owner:=new.owner_id;
   if tg_op='INSERT' then v_event:='created';v_message:='Private Mission created';
   elsif old.status is distinct from new.status then
     v_event:=case when new.status='archived' then 'archived'
       when old.status='archived' then 'reopened' else 'status_changed' end;
     v_message:='Mission status updated';
   else v_event:='updated';v_message:='Mission details or plan revision updated';end if;
 elsif tg_table_name='ifund_mission_tasks' then
   v_mission:=new.mission_id;v_owner:=new.owner_id;
   v_event:='task_changed';v_message:='Mission checklist updated';
 elsif tg_table_name='ifund_mission_plan_versions' then
   v_mission:=new.mission_id;v_owner:=new.owner_id;
   v_event:='updated';v_message:='Owner-reviewed plan version saved';
 elsif tg_table_name='ifund_mission_campaign_links' then
   v_mission:=new.mission_id;v_owner:=new.owner_id;
   v_event:='campaign_linked';v_message:='Owned fundraiser linked to Mission';
 else raise exception 'Unsupported Mission audit source' using errcode='23514';
 end if;
 insert into public.ifund_mission_events
   (mission_id,owner_id,event_key,actor_kind,event_type,safe_summary)
 values (v_mission,v_owner,gen_random_uuid(),
   case when auth.uid()=v_owner then 'member' else 'system' end,
   v_event,v_message);
 return new;
end
$audit$;
revoke all on function public.ifund_mission_audit_change() from public,anon,authenticated;
create trigger ifund_mission_created_event after insert or update on public.ifund_missions
 for each row execute function public.ifund_mission_audit_change();
create trigger ifund_mission_task_event after insert or update on public.ifund_mission_tasks
 for each row execute function public.ifund_mission_audit_change();
create trigger ifund_mission_plan_event after insert on public.ifund_mission_plan_versions
 for each row execute function public.ifund_mission_audit_change();
create trigger ifund_mission_campaign_event after insert on public.ifund_mission_campaign_links
 for each row execute function public.ifund_mission_audit_change();
commit;