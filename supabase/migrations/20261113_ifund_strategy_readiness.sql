-- Strategy Agent's first no-model tool: owner-scoped campaign readiness.
-- These are editing prompts, not a forecast of fundraising outcomes.
create or replace function public.ifund_owner_campaign_strategy_readiness()
returns table (
 campaign_id uuid,
 campaign_title text,
 campaign_status text,
 has_clear_title boolean,
 has_summary boolean,
 has_story boolean,
 has_goal boolean,
 has_cover_reference boolean,
 last_updated timestamptz
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
declare v_uid uuid := auth.uid();
begin
 if v_uid is null or not coalesce(public.ifund_current_account_is_active(),false) then
   raise exception 'Active member required' using errcode='42501';
 end if;
 return query
 select c.id,c.title,c.status,
   length(btrim(coalesce(c.title,'')))>=12,
   length(btrim(coalesce(c.summary,'')))>=60,
   length(btrim(coalesce(c.story,'')))>=200,
   coalesce(c.goal_amount,0)>0,
   length(btrim(coalesce(c.cover_image_url,'')))>0,
   c.updated_at
 from public.ifund_campaigns c
 where c.owner_id=v_uid
 order by c.updated_at desc nulls last,c.id
 limit 100;
end
$$;
revoke all on function public.ifund_owner_campaign_strategy_readiness() from public,anon;
grant execute on function public.ifund_owner_campaign_strategy_readiness() to authenticated;
