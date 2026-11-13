-- Social interactions and moderation. Stage and review before applying to production.
create table if not exists public.ifund_social_likes (
 post_id uuid not null references public.ifund_posts(id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (post_id,member_id)
);
create table if not exists public.ifund_social_reports (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.ifund_posts(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(length(trim(reason)) between 15 and 1500),
 status text not null default 'open' check(status in ('open','restored','removed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 unique(post_id,reporter_id)
);
create index if not exists ifund_social_reports_open_idx on public.ifund_social_reports(status,created_at desc);
create table if not exists public.ifund_social_friendships (
 requester_id uuid not null references auth.users(id) on delete cascade,
 addressee_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(requester_id,addressee_id),
 check(requester_id <> addressee_id)
);
create index if not exists ifund_social_friends_recipient_idx on public.ifund_social_friendships(addressee_id,status);
create table if not exists public.ifund_social_replies (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.ifund_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists ifund_social_replies_post_idx on public.ifund_social_replies(post_id,created_at);
alter table public.ifund_social_likes enable row level security;
alter table public.ifund_social_reports enable row level security;
alter table public.ifund_social_friendships enable row level security;
alter table public.ifund_social_replies enable row level security;
revoke all on public.ifund_social_likes,public.ifund_social_reports,
 public.ifund_social_friendships,public.ifund_social_replies from public,anon,authenticated;

-- Every social mutation uses a verified, active, terms-compliant member.
create or replace function public.ifund_social_member_ok()
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and public.ifund_my_profile_settings() is not null
$$;
revoke all on function public.ifund_social_member_ok() from public,anon,authenticated;
grant execute on function public.ifund_social_member_ok() to authenticated;

create or replace function public.ifund_social_like(p_post uuid,p_like boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if not exists(select 1 from public.ifund_posts p where p.id=p_post
 and not exists(select 1 from public.ifund_social_reports r where r.post_id=p.id and r.status in ('open','removed')))
 then raise exception 'Post unavailable' using errcode='22023'; end if;
 if p_like then
   insert into public.ifund_social_likes(post_id,member_id) values(p_post,auth.uid()) on conflict do nothing;
 else
   delete from public.ifund_social_likes where post_id=p_post and member_id=auth.uid();
 end if;
 return p_like;
end $$;
create or replace function public.ifund_social_report(p_post uuid,p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,''))) not between 15 and 1500
 then raise exception 'Please provide an explanation (15 to 1500 characters)' using errcode='22023'; end if;
 if not exists(select 1 from public.ifund_posts where id=p_post and author_id <> auth.uid())
 then raise exception 'Cannot report this post' using errcode='22023'; end if;
 -- one report per person/post, and rate-limit reports to reduce abuse.
 if exists(select 1 from public.ifund_social_reports where reporter_id=auth.uid() and created_at > now()-interval '1 minute')
 then raise exception 'Please wait before reporting another post' using errcode='22023'; end if;
 insert into public.ifund_social_reports(post_id,reporter_id,reason)
 values(p_post,auth.uid(),trim(p_reason));
 return true;
exception when unique_violation then
 raise exception 'You already reported this post' using errcode='23505';
end $$;
create or replace function public.ifund_social_moderation_queue()
returns table(id uuid, post_id uuid, body text, reason text, created_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
 select r.id,r.post_id,p.body,r.reason,r.created_at,r.status
 from public.ifund_social_reports r join public.ifund_posts p on p.id=r.post_id
 where public.ifund_current_user_is_verified_admin()
 order by case when r.status='open' then 0 else 1 end,r.created_at desc limit 200
$$;
create or replace function public.ifund_social_review(p_report uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_post uuid;
begin
 if not public.ifund_current_user_is_verified_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_action not in ('restore','remove') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select post_id into v_post from public.ifund_social_reports where id=p_report and status='open' for update;
 if v_post is null then raise exception 'Report not found or already reviewed' using errcode='22023'; end if;
 -- All open reports on the same post are resolved consistently.
 update public.ifund_social_reports set status=case when p_action='restore' then 'restored' else 'removed' end,
 reviewed_at=now(),reviewed_by=auth.uid() where post_id=v_post and status='open';
 return true;
end $$;
create or replace function public.ifund_social_friend(p_target uuid,p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if p_target is null or p_target=auth.uid() then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_action='request' then
   if not exists(select 1 from public.ifund_profiles p where p.id=p_target and p.public_profile_enabled and p.account_status='active' and not p.account_deletion_pending)
   then raise exception 'Member unavailable' using errcode='22023'; end if;
   if exists(select 1 from public.ifund_social_friendships where
     (requester_id=auth.uid() and addressee_id=p_target) or (requester_id=p_target and addressee_id=auth.uid()))
   then raise exception 'Friend request already exists' using errcode='23505'; end if;
   insert into public.ifund_social_friendships(requester_id,addressee_id) values(auth.uid(),p_target);
   return 'pending';
 elsif p_action in ('accept','decline') then
   update public.ifund_social_friendships set status=case when p_action='accept' then 'accepted' else 'declined' end,
     updated_at=now() where requester_id=p_target and addressee_id=auth.uid() and status='pending'
   returning status into v_status;
 elsif p_action='remove' then
   delete from public.ifund_social_friendships where
     (requester_id=auth.uid() and addressee_id=p_target) or (requester_id=p_target and addressee_id=auth.uid())
   returning 'removed' into v_status;
 end if;
 if v_status is null then raise exception 'No matching request' using errcode='22023'; end if;
 return v_status;
end $$;
create or replace function public.ifund_social_friend_status(p_target uuid)
returns text language sql stable security definer set search_path = '' as $$
 select case when f.status='accepted' then 'friends'
 when f.requester_id=auth.uid() then 'sent'
 when f.addressee_id=auth.uid() then 'received'
 else null end from public.ifund_social_friendships f
 where f.status in ('pending','accepted') and (
 (f.requester_id=auth.uid() and f.addressee_id=p_target)
 or (f.requester_id=p_target and f.addressee_id=auth.uid())) limit 1
$$;
create or replace function public.ifund_social_reply(p_post uuid,p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Invalid reply' using errcode='22023'; end if;
 if not exists(select 1 from public.ifund_posts p where p.id=p_post
  and not exists(select 1 from public.ifund_social_reports r where r.post_id=p.id and r.status in ('open','removed')))
 then raise exception 'Post unavailable' using errcode='22023'; end if;
 insert into public.ifund_social_replies(post_id,author_id,body)
 values(p_post,auth.uid(),trim(p_body)) returning id into v_id;
 return v_id;
end $$;
create or replace function public.ifund_social_replies_read(p_post uuid)
returns table(id uuid,body text,created_at timestamptz,display_name text,profile_id uuid)
language sql stable security definer set search_path = '' as $$
 select r.id,r.body,r.created_at,
 case when p.public_profile_enabled and p.account_status='active' then p.display_name end,
 case when p.public_profile_enabled and p.account_status='active' then p.id end
 from public.ifund_social_replies r
 left join public.ifund_profiles p on p.id=r.author_id
 where r.post_id=p_post and not exists(
  select 1 from public.ifund_social_reports x where x.post_id=r.post_id and x.status in ('open','removed'))
 order by r.created_at asc limit 100
$$;
create or replace function public.ifund_social_like_summary(p_posts uuid[])
returns table(post_id uuid,like_count bigint,liked boolean)
language sql stable security definer set search_path = '' as $$
 select p.id,count(l.member_id),coalesce(bool_or(l.member_id=auth.uid()),false)
 from public.ifund_posts p left join public.ifund_social_likes l on l.post_id=p.id
 where p.id=any(p_posts) and cardinality(p_posts)<=30
 and not exists(select 1 from public.ifund_social_reports r where r.post_id=p.id and r.status in ('open','removed'))
 group by p.id
$$;

-- Replace existing feed projection to suppress reported/removed posts.

-- Imported, already-public Base44 archive posts need the same report pathway.
-- Keep the archive itself immutable; these records only control visibility.
create table if not exists public.ifund_social_archive_reports (
 id uuid primary key default gen_random_uuid(),
 archive_id text not null,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(length(trim(reason)) between 15 and 1500),
 status text not null default 'open' check(status in ('open','restored','removed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 unique(archive_id,reporter_id)
);
alter table public.ifund_social_archive_reports enable row level security;
revoke all on public.ifund_social_archive_reports from public,anon,authenticated;
create index if not exists ifund_archive_reports_open_idx
 on public.ifund_social_archive_reports(status,created_at desc);

create table if not exists public.ifund_social_archive_likes (
 archive_id text not null,
 member_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(archive_id,member_id)
);
alter table public.ifund_social_archive_likes enable row level security;
revoke all on public.ifund_social_archive_likes from public,anon,authenticated;
create or replace function public.ifund_social_archive_like(p_archive text,p_like boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if p_archive is null or length(p_archive)>128 or not exists(
  select 1 from public.ifund_social_post p where p.id=p_archive
  and p.source_system='base44_public_social_archive')
 or exists(select 1 from public.ifund_social_archive_reports r
   where r.archive_id=p_archive and r.status in ('open','removed'))
 then raise exception 'Archive post unavailable' using errcode='22023'; end if;
 if p_like then
  insert into public.ifund_social_archive_likes(archive_id,member_id)
  values(p_archive,auth.uid()) on conflict do nothing;
 else
  delete from public.ifund_social_archive_likes where archive_id=p_archive and member_id=auth.uid();
 end if;
 return p_like;
end $$;
create or replace function public.ifund_social_archive_like_summary(p_archives text[])
returns table(post_id text,like_count bigint,liked boolean)
language sql stable security definer set search_path = '' as $$
 select 'archive-'||p.id,count(l.member_id),coalesce(bool_or(l.member_id=auth.uid()),false)
 from public.ifund_social_post p
 left join public.ifund_social_archive_likes l on l.archive_id=p.id
 where p.id=any(p_archives) and cardinality(p_archives)<=30
 and p.source_system='base44_public_social_archive'
 and not exists(select 1 from public.ifund_social_archive_reports r
  where r.archive_id=p.id and r.status in ('open','removed'))
 group by p.id
$$;
revoke all on function public.ifund_social_archive_like(text,boolean),
 public.ifund_social_archive_like_summary(text[]) from public,anon,authenticated;
grant execute on function public.ifund_social_archive_like(text,boolean) to authenticated;
grant execute on function public.ifund_social_archive_like_summary(text[]) to anon,authenticated;

create or replace function public.ifund_social_archive_report(p_archive text,p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if not public.ifund_social_member_ok() then raise exception 'Active verified member required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,''))) not between 15 and 1500 then raise exception 'Explanation must be 15–1500 characters' using errcode='22023'; end if;
 if p_archive is null or length(p_archive)>128 or not exists(
  select 1 from public.ifund_social_post p where p.id=p_archive
    and p.source_system='base44_public_social_archive')
 then raise exception 'Archive post unavailable' using errcode='22023'; end if;
 if exists(select 1 from (
  select created_at from public.ifund_social_reports where reporter_id=auth.uid()
  union all select created_at from public.ifund_social_archive_reports where reporter_id=auth.uid()
 ) x where created_at>now()-interval '1 minute')
 then raise exception 'Please wait before reporting another post' using errcode='22023'; end if;
 insert into public.ifund_social_archive_reports(archive_id,reporter_id,reason)
 values(p_archive,auth.uid(),trim(p_reason));
 return true;
exception when unique_violation then raise exception 'You already reported this post' using errcode='23505';
end $$;
create or replace function public.ifund_social_archive_queue()
returns table(id uuid,post_id text,body text,reason text,created_at timestamptz,status text)
language sql stable security definer set search_path = '' as $$
 select r.id,r.archive_id,p.content,r.reason,r.created_at,r.status
 from public.ifund_social_archive_reports r join public.ifund_social_post p on p.id=r.archive_id
 where public.ifund_current_user_is_verified_admin()
 order by case when r.status='open' then 0 else 1 end,r.created_at desc limit 200
$$;
create or replace function public.ifund_social_archive_review(p_report uuid,p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_archive text;
begin
 if not public.ifund_current_user_is_verified_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_action not in ('restore','remove') then raise exception 'Invalid decision' using errcode='22023'; end if;
 select archive_id into v_archive from public.ifund_social_archive_reports
 where id=p_report and status='open' for update;
 if v_archive is null then raise exception 'Report already resolved' using errcode='22023'; end if;
 update public.ifund_social_archive_reports
 set status=case when p_action='restore' then 'restored' else 'removed' end,
 reviewed_at=now(),reviewed_by=auth.uid()
 where archive_id=v_archive and status='open';
 return true;
end $$;
revoke all on function public.ifund_social_archive_report(text,text),
 public.ifund_social_archive_queue(),public.ifund_social_archive_review(uuid,text)
 from public,anon,authenticated;
grant execute on function public.ifund_social_archive_report(text,text),
 public.ifund_social_archive_queue(),public.ifund_social_archive_review(uuid,text) to authenticated;

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
 null::text as source_platform,null::text as external_url,null::text as media_url
 from public.ifund_posts s left join public.ifund_profiles p on p.id=s.author_id
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
-- Protect all direct table reads as well as the public RPC, while keeping
-- INSERT ... RETURNING supported for authenticated members.
create or replace function public.ifund_post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select not exists(select 1 from public.ifund_social_reports r
 where r.post_id=p_post and r.status in ('open','removed'))
$$;
revoke all on function public.ifund_post_visible(uuid) from public,anon,authenticated;
grant execute on function public.ifund_post_visible(uuid) to anon,authenticated;
drop policy if exists ifund_posts_public_read on public.ifund_posts;
create policy ifund_posts_public_read on public.ifund_posts for select to anon,authenticated
 using (public.ifund_post_visible(id));
-- The reports table has no direct grants or RLS read policy; encapsulate its
-- lookup in a security definer function to avoid RLS recursion/permission errors.
-- Retain insert rights but enforce lifecycle at database boundary.
drop policy if exists ifund_posts_insert on public.ifund_posts;
create policy ifund_posts_insert on public.ifund_posts for insert to authenticated
 with check(author_id=auth.uid() and public.ifund_social_member_ok());

do $$
declare f text;
begin
 foreach f in array array[
 'ifund_social_like(uuid,boolean)','ifund_social_report(uuid,text)',
 'ifund_social_moderation_queue()','ifund_social_review(uuid,text)',
 'ifund_social_friend(uuid,text)','ifund_social_friend_status(uuid)',
 'ifund_social_reply(uuid,text)','ifund_social_replies_read(uuid)',
 'ifund_social_like_summary(uuid[])'] loop
 execute 'revoke all on function public.'||f||' from public,anon,authenticated';
 execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
end $$;
grant execute on function public.ifund_social_replies_read(uuid),
 public.ifund_social_like_summary(uuid[]) to anon;

-- Only expose the existence of a published member blog when a campaign is public.
create or replace function public.ifund_public_campaign_blog_author(p_campaign uuid)
returns uuid language sql stable security definer set search_path = '' as $$
 select c.owner_id
 from public.ifund_campaigns c
 where c.id=p_campaign and c.status='active'
 and exists(select 1 from public.ifund_blogs b
   join public.ifund_blog_entries e on e.blog_id=b.id
   where b.owner_auth_user_id=c.owner_id and b.type='member'
     and b.status='active' and e.status='published')
 limit 1
$$;
revoke all on function public.ifund_public_campaign_blog_author(uuid) from public,anon,authenticated;
grant execute on function public.ifund_public_campaign_blog_author(uuid) to anon,authenticated;

-- Friend requests appear only in the recipient's private workspace.
create or replace function public.ifund_social_friend_requests()
returns table(member_id uuid,display_name text,created_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select f.requester_id,coalesce(nullif(p.display_name,''),'IFund member'),f.created_at
 from public.ifund_social_friendships f
 join public.ifund_profiles p on p.id=f.requester_id
 where f.addressee_id=auth.uid() and f.status='pending'
 and p.account_status='active' and not p.account_deletion_pending
 and public.ifund_social_member_ok()
 order by f.created_at desc limit 100
$$;
revoke all on function public.ifund_social_friend_requests() from public,anon,authenticated;
grant execute on function public.ifund_social_friend_requests() to authenticated;


-- Public discussion on imported archive records is stored in IFund, not posted
-- back to the external origin platform.
create table if not exists public.ifund_social_archive_replies (
 id uuid primary key default gen_random_uuid(),
 archive_id text not null,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists ifund_archive_replies_post_idx
 on public.ifund_social_archive_replies(archive_id,created_at);
alter table public.ifund_social_archive_replies enable row level security;
revoke all on public.ifund_social_archive_replies from public,anon,authenticated;

create or replace function public.ifund_social_archive_reply(p_archive text,p_body text)
returns uuid language plpgsql security definer set search_path = '' as $ifund$
declare v_id uuid;
begin
 if not public.ifund_social_member_ok() then
  raise exception 'Active verified member required' using errcode='42501';
 end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 1000 then
  raise exception 'Reply must be 1–1000 characters' using errcode='22023';
 end if;
 if p_archive is null or length(p_archive)>128 or not exists(
   select 1 from public.ifund_social_post p
   where p.id=p_archive and p.source_system='base44_public_social_archive')
   or exists(select 1 from public.ifund_social_archive_reports r
     where r.archive_id=p_archive and r.status in ('open','removed'))
 then raise exception 'Post unavailable' using errcode='22023'; end if;
 insert into public.ifund_social_archive_replies(archive_id,author_id,body)
 values(p_archive,auth.uid(),trim(p_body)) returning id into v_id;
 return v_id;
end $ifund$;

create or replace function public.ifund_social_archive_replies_read(p_archive text)
returns table(id uuid,body text,created_at timestamptz,display_name text,profile_id uuid)
language sql stable security definer set search_path = '' as $ifund$
 select r.id,r.body,r.created_at,
 case when p.public_profile_enabled and p.account_status='active'
   and not p.account_deletion_pending then p.display_name end,
 case when p.public_profile_enabled and p.account_status='active'
   and not p.account_deletion_pending then p.id end
 from public.ifund_social_archive_replies r
 left join public.ifund_profiles p on p.id=r.author_id
 where r.archive_id=p_archive
 and exists(select 1 from public.ifund_social_post s
   where s.id=r.archive_id and s.source_system='base44_public_social_archive')
 and not exists(select 1 from public.ifund_social_archive_reports x
   where x.archive_id=r.archive_id and x.status in ('open','removed'))
 order by r.created_at asc limit 100
$ifund$;
revoke all on function public.ifund_social_archive_reply(text,text),
 public.ifund_social_archive_replies_read(text) from public,anon,authenticated;
grant execute on function public.ifund_social_archive_reply(text,text) to authenticated;
grant execute on function public.ifund_social_archive_replies_read(text) to anon,authenticated;


-- Only the owner can access their unpublished social draft. This is not a
-- scheduled publish queue, and no external provider receives the content.
create table if not exists public.ifund_social_drafts (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 2000),
 updated_at timestamptz not null default now()
);
alter table public.ifund_social_drafts enable row level security;
revoke all on public.ifund_social_drafts from public,anon,authenticated;

create or replace function public.ifund_my_social_draft()
returns text language sql stable security definer set search_path = '' as $ifund$
 select d.body from public.ifund_social_drafts d
 where d.owner_id=auth.uid() and public.ifund_social_member_ok()
$ifund$;
create or replace function public.ifund_save_my_social_draft(p_body text)
returns boolean language plpgsql security definer set search_path = '' as $ifund$
begin
 if not public.ifund_social_member_ok() then
  raise exception 'Verified active member required' using errcode='42501'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 2000 then
  raise exception 'Draft length must be 1–2000 characters' using errcode='22023'; end if;
 insert into public.ifund_social_drafts(owner_id,body)
 values(auth.uid(),trim(p_body))
 on conflict(owner_id) do update
 set body=excluded.body,updated_at=now();
 return true;
end $ifund$;
create or replace function public.ifund_clear_my_social_draft()
returns boolean language plpgsql security definer set search_path = '' as $ifund$
begin
 if not public.ifund_social_member_ok() then
  raise exception 'Verified active member required' using errcode='42501'; end if;
 delete from public.ifund_social_drafts where owner_id=auth.uid();
 return true;
end $ifund$;
revoke all on function public.ifund_my_social_draft(),
 public.ifund_save_my_social_draft(text),
 public.ifund_clear_my_social_draft() from public,anon,authenticated;
grant execute on function public.ifund_my_social_draft(),
 public.ifund_save_my_social_draft(text),
 public.ifund_clear_my_social_draft() to authenticated;
