-- Phase 1 "Attach & Play": a social post may reference one item from the
-- author's own R2 member-media library (public.ifund_member_media).
--
-- Storage stays single-copy: the bytes remain under the private
-- `private/member-media/` prefix and no public object URL is minted. The
-- the companion migration 20261126200100 makes the public feed RPCs
-- project an opaque same-origin path,
-- `/api/media/public/file/<media-id>.<ext>`, and the media worker serves
-- the bytes only while the media is attached to at least one publicly
-- visible post (no open/removed report) and is not pending deletion.
-- Detaching (post delete), moderation (report) or deleting the library
-- item therefore revokes public playback without copying bytes.
--
-- Attachment is enforced at the database boundary, like the existing
-- social post guards: a BEFORE trigger rejects any media_id that is not
-- the author's own active image/video library item. This covers both the
-- Worker create route and the browser's direct PostgREST insert, whose
-- column grant is extended to the new column only.

alter table public.ifund_posts
 add column if not exists media_id uuid
 references public.ifund_member_media(id) on delete set null;

create index if not exists ifund_posts_media_id
 on public.ifund_posts(media_id) where media_id is not null;

-- The initial schema grants INSERT by column; extend it to the new column.
grant insert(media_id) on public.ifund_posts to authenticated;

create or replace function public.ifund_guard_social_post_media()
returns trigger language plpgsql security invoker set search_path = '' as $ifund$
begin
 if new.media_id is not null and not exists(
   select 1 from public.ifund_member_media m
   where m.id=new.media_id and m.owner_id=new.author_id
     and m.content_kind in ('video','image')
     and m.deletion_requested_at is null)
 then
  raise exception 'Attached media must be your own image or video'
   using errcode='42501';
 end if;
 return new;
end $ifund$;
revoke all on function public.ifund_guard_social_post_media()
 from public,anon,authenticated;
drop trigger if exists ifund_guard_social_post_media_trigger on public.ifund_posts;
create trigger ifund_guard_social_post_media_trigger
 before insert or update of media_id on public.ifund_posts
 for each row execute function public.ifund_guard_social_post_media();

