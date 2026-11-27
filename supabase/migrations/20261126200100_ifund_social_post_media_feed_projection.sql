-- Phase 1 "Attach & Play" (companion to 20261126200000): public feed
-- projections for post media. Split from the schema migration because
-- these function definitions build on the full social profile schema
-- (20261113010000), while the column/trigger migration only needs
-- ifund_posts and ifund_member_media.
--
-- Public projections: identical to the 20261113010000 definitions except the
-- native-post branch resolves media_id to its public playback path. Archive
-- rows keep their stored media_url untouched.
create or replace function public.ifund_public_social_feed(
 p_before timestamptz default null,p_before_id text default null,p_author uuid default null)
returns table(id text,body text,posted_at timestamptz,display_name text,
 profile_id uuid,source_platform text,external_url text,media_url text)
language sql stable security definer set search_path = '' as $$
 with feed as (
 select 'post-'||s.id::text as id,s.body,s.created_at as posted_at,
 case when p.public_profile_enabled and p.account_status='active'
 and not p.account_deletion_pending then p.display_name end as display_name,
 case when p.public_profile_enabled and p.account_status='active'
 and not p.account_deletion_pending then p.id end as profile_id,
 null::text as source_platform,null::text as external_url,
 case when m.id is not null then '/api/media/public/file/'||m.id::text||'.'||
   case m.content_type
     when 'video/mp4' then 'mp4' when 'video/webm' then 'webm'
     when 'image/png' then 'png' when 'image/jpeg' then 'jpg'
     when 'image/webp' then 'webp' when 'image/gif' then 'gif'
   end end as media_url
 from public.ifund_posts s left join public.ifund_profiles p on p.id=s.author_id
 left join public.ifund_member_media m on m.id=s.media_id
   and m.deletion_requested_at is null and m.content_kind in ('video','image')
 where not exists(select 1 from public.ifund_social_reports r
 where r.post_id=s.id and r.status in ('open','removed'))
 and (p_author is null or (s.author_id=p_author and p.public_profile_enabled and p.show_posts
 and p.account_status='active' and not p.account_deletion_pending))
 union all
 select 'archive-'||s.id,s.content,coalesce(s.created_date,s.created_at),
 s.author_name,null::uuid,s.source_platform,s.external_url,s.media_url
 from public.ifund_social_post s
 where p_author is null and s.source_system='base44_public_social_archive'
 and not exists(select 1 from public.ifund_social_archive_reports r
  where r.archive_id=s.id and r.status in ('open','removed'))
 )
 select f.id,f.body,f.posted_at,f.display_name,f.profile_id,
 f.source_platform,f.external_url,f.media_url from feed f
 where p_before is null or (f.posted_at,f.id)<(p_before,p_before_id)
 order by f.posted_at desc,f.id desc limit 24
$$;
revoke all on function public.ifund_public_social_feed(timestamptz,text,uuid)
 from public,anon,authenticated;
grant execute on function public.ifund_public_social_feed(timestamptz,text,uuid)
 to anon,authenticated;

create or replace function public.ifund_public_social_post(p_post text)
returns table(id text,body text,posted_at timestamptz,display_name text,
 profile_id uuid,source_platform text,external_url text,media_url text)
language sql stable security definer set search_path = '' as $ifund$
 with one_post as (
  select 'post-'||s.id::text as id,s.body,s.created_at as posted_at,
   case when p.public_profile_enabled and p.account_status='active'
     and not p.account_deletion_pending then p.display_name end as display_name,
   case when p.public_profile_enabled and p.account_status='active'
     and not p.account_deletion_pending then p.id end as profile_id,
   null::text as source_platform,null::text as external_url,
   case when m.id is not null then '/api/media/public/file/'||m.id::text||'.'||
     case m.content_type
       when 'video/mp4' then 'mp4' when 'video/webm' then 'webm'
       when 'image/png' then 'png' when 'image/jpeg' then 'jpg'
       when 'image/webp' then 'webp' when 'image/gif' then 'gif'
     end end as media_url
  from public.ifund_posts s left join public.ifund_profiles p on p.id=s.author_id
  left join public.ifund_member_media m on m.id=s.media_id
    and m.deletion_requested_at is null and m.content_kind in ('video','image')
  where s.id = case when p_post ~ '^post-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then substring(p_post from 6)::uuid else null::uuid end
    and public.ifund_post_visible(s.id)
  union all
  select 'archive-'||s.id,s.content,coalesce(s.created_date,s.created_at),
   s.author_name,null::uuid,s.source_platform,s.external_url,s.media_url
  from public.ifund_social_post s
  where s.id=case when p_post like 'archive-%' and length(p_post)<=136
    then substring(p_post from 9) else null::text end
    and s.source_system='base44_public_social_archive'
    and not exists(select 1 from public.ifund_social_archive_reports r
      where r.archive_id=s.id and r.status in ('open','removed'))
 )
 select * from one_post limit 1
$ifund$;
revoke all on function public.ifund_public_social_post(text) from public,anon,authenticated;
grant execute on function public.ifund_public_social_post(text) to anon,authenticated;
