alter table public.ifund_profiles
  add column if not exists public_profile_enabled boolean not null default false,
  add column if not exists bio text not null default '',
  add column if not exists avatar_key text,
  add column if not exists show_posts boolean not null default true,
  add column if not exists featured_campaign_ids uuid[] not null default '{}';

create or replace function public.ifund_my_profile_settings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'handle', p.handle, 'bio', p.bio,
    'avatar_key', p.avatar_key, 'public_profile_enabled', p.public_profile_enabled,
    'show_posts', p.show_posts, 'featured_campaign_ids', p.featured_campaign_ids,
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title, c.id)
      from public.ifund_campaigns c
      where c.status = 'active' and (
        c.owner_id = p.id or exists (
          select 1 from public.ifund_follows f
          where f.owner_id = p.id and f.campaign_id = c.id and not f.archived
        )
      )
    ), '[]'::jsonb)
  )
  from public.ifund_profiles p
  join auth.users u on u.id = p.id and u.email_confirmed_at is not null
  where p.id = auth.uid() and not u.is_anonymous and p.account_status = 'active' and not p.account_deletion_pending
    and public.ifund_current_user_has_current_terms()
$$;

create or replace function public.ifund_save_my_profile(
  p_display_name text, p_handle text, p_bio text, p_public boolean, p_show_posts boolean,
  p_featured_campaign_ids uuid[]
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  settings jsonb := public.ifund_my_profile_settings();
  member_id uuid := auth.uid();
  selected uuid[] := coalesce(p_featured_campaign_ids, '{}'::uuid[]);
begin
  if settings is null then
    raise exception 'Verified active account required' using errcode = '42501';
  end if;
  if p_public is null or p_show_posts is null
    or length(coalesce(p_display_name, '')) > 100
    or (nullif(p_handle, '') is not null and p_handle !~ '^[A-Za-z0-9_-]{3,32}$')
    or length(coalesce(p_bio, '')) > 900
    or (p_public and nullif(trim(p_display_name), '') is null)
    or cardinality(selected) > 6
    or cardinality(selected) <> (select count(distinct id) from unnest(selected) as ids(id))
    or exists (
      select 1 from unnest(selected) as ids(id)
      where not exists (
        select 1 from jsonb_array_elements(settings->'campaigns') c
        where c->>'id' = ids.id::text
      )
    )
  then
    raise exception 'Invalid profile settings' using errcode = '22023';
  end if;

  update public.ifund_profiles p
  set display_name = nullif(trim(p_display_name), ''), handle = nullif(p_handle, ''),
      bio = trim(coalesce(p_bio, '')), public_profile_enabled = p_public,
      show_posts = p_show_posts, featured_campaign_ids = selected
  where p.id = member_id and p.account_status = 'active' and not p.account_deletion_pending;
  return public.ifund_my_profile_settings();
end;
$$;

-- The media handler writes the object before setting this owner-scoped pointer.
create or replace function public.ifund_set_my_avatar(p_key text, p_previous_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if public.ifund_my_profile_settings() is null
    or (p_key is not null and p_key !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')
  then
    raise exception 'Verified active account required' using errcode = '42501';
  end if;
  update public.ifund_profiles set avatar_key = p_key
  where id = auth.uid() and account_status = 'active' and not account_deletion_pending
    and avatar_key is not distinct from p_previous_key;
  return found;
end;
$$;

create or replace function public.ifund_public_member_profile(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'handle', p.handle, 'bio', p.bio,
    'avatar_key', p.avatar_key, 'show_posts', p.show_posts,
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'summary', c.summary) order by chosen.position)
      from unnest(p.featured_campaign_ids) with ordinality as chosen(id, position)
      join public.ifund_campaigns c on c.id = chosen.id and c.status = 'active'
      where c.owner_id = p.id or exists (
        select 1 from public.ifund_follows f
        where f.owner_id = p.id and f.campaign_id = c.id and not f.archived
      )
    ), '[]'::jsonb)
  )
  from public.ifund_profiles p
  where p.id = p_id and p.public_profile_enabled
    and p.account_status = 'active' and not p.account_deletion_pending
$$;

-- The legacy entity table remains private. Only explicitly imported public
-- archive rows contribute to this projection. Legacy author IDs stay private.
create or replace function public.ifund_public_social_feed(
  p_before timestamptz default null, p_before_id text default null, p_author uuid default null
)
returns table (
  id text, body text, posted_at timestamptz, display_name text,
  profile_id uuid, source_platform text, external_url text, media_url text
)
language sql stable security definer set search_path = ''
as $$
  with feed as (
    select 'post-' || s.id::text as id, s.body, s.created_at as posted_at,
      case when p.public_profile_enabled and p.account_status = 'active'
        and not p.account_deletion_pending then p.display_name end as display_name,
      case when p.public_profile_enabled and p.account_status = 'active'
        and not p.account_deletion_pending then p.id end as profile_id,
      null::text as source_platform, null::text as external_url, null::text as media_url
    from public.ifund_posts s
    left join public.ifund_profiles p on p.id = s.author_id
    where p_author is null or (
      s.author_id = p_author and p.public_profile_enabled and p.show_posts
      and p.account_status = 'active' and not p.account_deletion_pending
    )
    union all
    select 'archive-' || s.id, s.content, coalesce(s.created_date, s.created_at),
      s.author_name, null::uuid, s.source_platform, s.external_url, s.media_url
    from public.ifund_social_post s
    where p_author is null and s.source_system = 'base44_public_social_archive'
  )
  select f.id, f.body, f.posted_at, f.display_name, f.profile_id,
         f.source_platform, f.external_url, f.media_url
  from feed f
  where p_before is null or (f.posted_at, f.id) < (p_before, p_before_id)
  order by f.posted_at desc, f.id desc
  limit 24
$$;

revoke all on function public.ifund_my_profile_settings() from public, anon, authenticated;
revoke all on function public.ifund_save_my_profile(text,text,text,boolean,boolean,uuid[]) from public, anon, authenticated;
revoke all on function public.ifund_set_my_avatar(text,text) from public, anon, authenticated;
revoke all on function public.ifund_public_member_profile(uuid) from public, anon, authenticated;
revoke all on function public.ifund_public_social_feed(timestamptz,text,uuid) from public, anon, authenticated;
grant execute on function public.ifund_my_profile_settings(),
  public.ifund_save_my_profile(text,text,text,boolean,boolean,uuid[]),
  public.ifund_set_my_avatar(text,text) to authenticated;
grant execute on function public.ifund_public_member_profile(uuid),
  public.ifund_public_social_feed(timestamptz,text,uuid) to anon, authenticated;

-- Keep editorial owner and draft data behind an authenticated owner lookup.
create or replace function public.ifund_my_blog_workspace()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'can_create', public.ifund_blog_author_entitled(auth.uid()) and not exists (
      select 1 from public.ifund_blogs b where b.owner_auth_user_id = auth.uid() and b.type = 'member'
    ),
    'blogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'type', b.type,
        'can_write', case when b.type = 'official' then public.ifund_current_user_is_verified_super_admin()
          else public.ifund_blog_author_entitled(auth.uid()) end,
        'entries', coalesce((
          select jsonb_agg(to_jsonb(e) order by e.updated_at desc, e.id)
          from (
            select e.id, e.title, e.summary, e.body, e.status, e.updated_at, e.published_at
            from public.ifund_blog_entries e
            where e.blog_id = b.id and e.owner_auth_user_id = auth.uid()
            order by e.updated_at desc, e.id limit 200
          ) e
        ), '[]'::jsonb)
      ) order by b.type, b.title, b.id)
      from public.ifund_blogs b where b.owner_auth_user_id = auth.uid() and b.status = 'active'
    ), '[]'::jsonb)
  )
  where public.ifund_my_profile_settings() is not null
$$;

create or replace function public.ifund_create_member_blog(p_title text, p_description text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  member_id uuid := auth.uid();
  blog_id text := gen_random_uuid()::text;
begin
  if public.ifund_my_profile_settings() is null or not public.ifund_blog_author_entitled(member_id) then
    raise exception 'An active blog subscription is required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 3 and 90
    or length(coalesce(p_description, '')) > 500 then
    raise exception 'Invalid blog details' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(member_id::text, 641));
  if exists (select 1 from public.ifund_blogs where owner_auth_user_id = member_id and type = 'member') then
    raise exception 'This account already has a member blog' using errcode = '23505';
  end if;
  insert into public.ifund_blogs (id, owner_auth_user_id, type, title, description, slug, status, created_at, updated_at)
  values (blog_id, member_id, 'member', trim(p_title), trim(coalesce(p_description, '')), blog_id, 'active', now(), now());
  return blog_id;
end;
$$;

create or replace function public.ifund_save_blog_story(
  p_blog_id text, p_entry_id text, p_title text, p_summary text, p_body text, p_status text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  member_id uuid := auth.uid();
  blog public.ifund_blogs%rowtype;
  entry public.ifund_blog_entries%rowtype;
  next_status text := p_status;
begin
  select b.* into blog from public.ifund_blogs b
  where b.id = p_blog_id and b.owner_auth_user_id = member_id and b.status = 'active'
  for share;
  if public.ifund_my_profile_settings() is null or blog.id is null
    or not (case when blog.type = 'official' then public.ifund_current_user_is_verified_super_admin()
      else public.ifund_blog_author_entitled(member_id) end)
  then
    raise exception 'You do not have publishing access to this blog' using errcode = '42501';
  end if;
  if coalesce(p_status, '') not in ('draft', 'published')
    or length(trim(coalesce(p_title, ''))) not between 1 and 160
    or length(coalesce(p_summary, '')) > 400
    or nullif(trim(p_body), '') is null or length(p_body) > 40000
    or (p_status = 'published' and nullif(trim(coalesce(p_summary, '')), '') is null)
  then
    raise exception 'Invalid story details' using errcode = '22023';
  end if;

  if nullif(p_entry_id, '') is null then
    insert into public.ifund_blog_entries (
      id, blog_id, owner_auth_user_id, legacy_owner_user_id, type, title, summary,
      body, status, featured, published_at, created_at, updated_at
    ) values (
      gen_random_uuid()::text, blog.id, member_id, blog.legacy_owner_user_id,
      case when blog.type = 'official' then 'newsletter' else 'article' end,
      trim(p_title), trim(coalesce(p_summary, '')), p_body, next_status,
      blog.type = 'official' and next_status = 'published',
      case when next_status = 'published' then now() end, now(), now()
    ) returning * into entry;
  else
    update public.ifund_blog_entries e set
      title = trim(p_title), summary = trim(coalesce(p_summary, '')), body = p_body,
      status = next_status,
      featured = next_status = 'published' and (e.featured or blog.type = 'official'),
      published_at = case when next_status = 'published' then coalesce(e.published_at, now()) end,
      updated_at = now()
    where e.id = p_entry_id and e.blog_id = blog.id and e.owner_auth_user_id = member_id
    returning * into entry;
    if not found then
      raise exception 'Story not found' using errcode = '42501';
    end if;
  end if;
  return jsonb_build_object('id', entry.id, 'blog_id', entry.blog_id, 'status', entry.status);
end;
$$;

revoke all on function public.ifund_my_blog_workspace() from public, anon, authenticated;
revoke all on function public.ifund_create_member_blog(text,text) from public, anon, authenticated;
revoke all on function public.ifund_save_blog_story(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ifund_my_blog_workspace(), public.ifund_create_member_blog(text,text),
  public.ifund_save_blog_story(text,text,text,text,text,text) to authenticated;
