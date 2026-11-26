-- Private member media in the existing IFund R2 bucket. No Storage bucket,
-- public object URL, or client-side service-role permission is needed.
create table if not exists public.ifund_member_media (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 content_kind text not null check (content_kind in ('image','audio','video')),
 content_type text not null check (content_type in (
  'image/png','image/jpeg','image/webp','image/gif',
  'video/mp4','video/webm',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4'
 )),
 file_name text not null check(length(file_name) between 1 and 160 and file_name !~ '[\\/[:cntrl:]]'),
 file_size integer not null check(file_size between 1 and 41943040),
 object_store text not null default 'r2' check(object_store='r2'),
 object_path text not null unique,
 object_etag text not null check(length(object_etag) between 1 and 200),
 object_sha256 text not null check(object_sha256 ~ '^[a-f0-9]{64}$'),
 object_verified_at timestamptz not null,
 deletion_requested_at timestamptz,
 created_at timestamptz not null default now(),
 constraint ifund_member_media_kind_matches_type check (
  (content_kind='image' and content_type like 'image/%' and file_size<=5242880)
  or (content_kind='audio' and content_type like 'audio/%' and file_size<=16777216)
  or (content_kind='video' and content_type like 'video/%' and file_size<=41943040)
 ),
 constraint ifund_member_media_object_key_check check (
  object_path='private/member-media/'||owner_id::text||'/'||id::text||'.'||
    case content_type
      when 'image/png' then 'png' when 'image/jpeg' then 'jpg'
      when 'image/webp' then 'webp' when 'image/gif' then 'gif'
      when 'video/mp4' then 'mp4' when 'video/webm' then 'webm'
      when 'audio/mpeg' then 'mp3' when 'audio/wav' then 'wav'
      when 'audio/ogg' then 'ogg' when 'audio/mp4' then 'm4a'
      else 'invalid' end
 )
);
create index if not exists ifund_member_media_owner_created
 on public.ifund_member_media(owner_id,created_at desc,id desc);

create or replace function public.ifund_member_media_guard()
returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('member-media:'||new.owner_id::text,0));
 if tg_op='INSERT' then
   if not exists (select 1 from public.ifund_profiles p
      where p.id=new.owner_id and p.account_status='active'
        and p.account_deletion_pending=false) then
      raise exception 'Active media owner required' using errcode='42501';
   end if;
   if (select count(*) from public.ifund_member_media where owner_id=new.owner_id)>=50
     or (select coalesce(sum(file_size),0) from public.ifund_member_media
          where owner_id=new.owner_id)+new.file_size>268435456 then
      raise exception 'Member media storage quota exceeded' using errcode='54000';
   end if;
 else
   if (new.id,new.owner_id,new.content_kind,new.content_type,new.file_name,
       new.file_size,new.object_store,new.object_path,new.object_etag,new.object_sha256,
       new.object_verified_at,new.created_at) is distinct from
      (old.id,old.owner_id,old.content_kind,old.content_type,old.file_name,
       old.file_size,old.object_store,old.object_path,old.object_etag,old.object_sha256,
       old.object_verified_at,old.created_at) then
       raise exception 'Member media identity is immutable' using errcode='42501';
   end if;
   if old.deletion_requested_at is not null
      and new.deletion_requested_at is distinct from old.deletion_requested_at then
       raise exception 'Pending media deletion cannot be undone' using errcode='42501';
   end if;
 end if;
 if new.object_verified_at>clock_timestamp() then
    raise exception 'R2 receipt cannot be future dated' using errcode='22023';
 end if;
 return new;
end $$;
drop trigger if exists ifund_member_media_guard_trg on public.ifund_member_media;
create trigger ifund_member_media_guard_trg
 before insert or update on public.ifund_member_media
 for each row execute function public.ifund_member_media_guard();

alter table public.ifund_member_media enable row level security;
drop policy if exists ifund_member_media_owner_read on public.ifund_member_media;
create policy ifund_member_media_owner_read on public.ifund_member_media
 for select to authenticated
 using(owner_id=(select auth.uid()) and
   (select public.ifund_member_connection_allowed()) and
   (select public.ifund_current_user_has_current_terms()));
revoke all on public.ifund_member_media from anon,authenticated;
grant select on public.ifund_member_media to authenticated;
revoke all on function public.ifund_member_media_guard() from public,anon,authenticated;
