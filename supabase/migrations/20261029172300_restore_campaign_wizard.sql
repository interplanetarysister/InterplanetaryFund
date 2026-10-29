-- Offline proposal only. Apply with explicit migration authorization before enabling this UI.
-- Adds the original campaign wizard's persisted fields, without touching financial data.
alter table public.ifund_campaigns
  add column if not exists ai_profile jsonb not null default '{}'::jsonb,
  add column if not exists story_versions jsonb not null default '[]'::jsonb,
  add column if not exists draft_step smallint not null default 0,
  add column if not exists end_date date,
  add column if not exists location text not null default '',
  add column if not exists cover_image_is_ai boolean not null default false,
  add column if not exists accept_crypto_donations boolean not null default false;

-- Original UX: summary is optional when a story exists; public summary is derived
-- from the story at save time. A text-only description can be the full account.
alter table public.ifund_campaigns
  drop constraint if exists ifund_publish_complete;
alter table public.ifund_campaigns
  add constraint ifund_publish_complete check (
    status <> 'active' or
    (length(trim(title)) > 0 and length(trim(summary)) > 0 and goal_amount > 0)
  );
alter table public.ifund_campaigns
  add constraint ifund_draft_step_range check (draft_step between 0 and 3);
alter table public.ifund_campaigns
  add constraint ifund_ai_profile_object check (jsonb_typeof(ai_profile) = 'object');
alter table public.ifund_campaigns
  add constraint ifund_story_versions_array check (jsonb_typeof(story_versions) = 'array');

-- Allow private authenticated uploads only under the uploader's auth UUID folder.
-- Public-read cover art is required on public campaign cards, not private drafts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ifund-campaign-covers', 'ifund-campaign-covers', true, 8388608,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;
create policy ifund_campaign_cover_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ifund-campaign-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Storage is a public media bucket, but users cannot list other people's drafts.
-- Only the creator can remove media in their own UUID folder.
create policy ifund_campaign_cover_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'ifund-campaign-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
