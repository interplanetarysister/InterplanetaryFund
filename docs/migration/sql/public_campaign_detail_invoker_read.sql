-- Applied to Supabase project ssibsfmtodgximseeqsv on 2026-11-01.
-- Public campaign detail: read-only, invoker rights, RLS enforced.
create or replace function public.ifund_public_campaign_detail(p_campaign_id uuid)
returns table(id uuid, title text, summary text, story text, category text, goal_amount numeric, cover_image_url text, status text, created_at timestamptz, updated_at timestamptz)
language sql stable security invoker
set search_path = ''
as $$
 select c.id,c.title,c.summary,c.story,c.category,c.goal_amount,c.cover_image_url,c.status,c.created_at,c.updated_at
 from public.ifund_campaigns c
 where c.id = p_campaign_id and c.status = 'active'
 limit 1
$$;
revoke all on function public.ifund_public_campaign_detail(uuid) from public;
grant execute on function public.ifund_public_campaign_detail(uuid) to anon,authenticated;
