create or replace function public.ifund_admin_workflow_registry()
returns table(source_id text,name text,trigger_kind text,original_cron text,source_status text,migration_status text,execution_enabled boolean,target_handler text)
language plpgsql stable security definer set search_path = ''
as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','super_admin') then
   raise exception 'not authorized' using errcode = '42501';
 end if;
 return query select w.source_id,w.name,w.trigger_kind,w.original_cron,w.source_status,w.migration_status,w.execution_enabled,w.target_handler
 from ifund_control.workflow_registry w order by w.name;
end
$$;
revoke all on function public.ifund_admin_workflow_registry() from public,anon;
grant execute on function public.ifund_admin_workflow_registry() to authenticated;