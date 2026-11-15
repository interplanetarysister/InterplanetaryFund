-- Source-only: private owner-authenticated fundraising document library.
-- Never reuse the public cover bucket; no public URLs; no automatic publication.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ifund-campaign-documents','ifund-campaign-documents',false,8388608,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/markdown','text/csv']::text[])
on conflict(id) do update set public=false,file_size_limit=8388608,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.ifund_campaign_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check(length(file_name) between 1 and 160),
  media_type text not null check(media_type in
    ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/plain','text/markdown','text/csv')),
  file_size integer not null check(file_size between 1 and 8388608),
  purpose text not null default 'general' check(purpose in
    ('general','budget','proof','research','planning','outreach','media')),
  agent_summary text not null default '' check(length(agent_summary)<=3000),
  extracted_text text not null default '' check(length(extracted_text)<=6000),
  owner_excerpt text not null default '' check(length(owner_excerpt)<=4000),
  allow_agent_use boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id,campaign_id,id),
  check(storage_path=owner_id::text||'/'||campaign_id::text||'/'||id::text||'.'||
    case media_type when 'application/pdf' then 'pdf'
      when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
      when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx'
      when 'text/plain' then 'txt' when 'text/markdown' then 'md' when 'text/csv' then 'csv' end),
  check(not allow_agent_use or length(btrim(agent_summary))>=20)
);
create index if not exists ifund_campaign_documents_owner_campaign_idx
  on public.ifund_campaign_documents(owner_id,campaign_id,created_at desc);
alter table public.ifund_campaign_documents enable row level security;
revoke all on public.ifund_campaign_documents from public,anon,authenticated;
grant select,insert,delete on public.ifund_campaign_documents to authenticated;
grant update(allow_agent_use,agent_summary,purpose,owner_excerpt) on public.ifund_campaign_documents to authenticated;

create or replace function public.ifund_owns_campaign_document_context(p_owner uuid,p_campaign uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_owner=(select auth.uid()) and exists (
   select 1 from public.ifund_campaigns c
   where c.id=p_campaign and c.owner_id=p_owner)
 and exists (select 1 from public.ifund_profiles p where p.id=p_owner
   and p.account_status='active' and p.account_deletion_pending=false)
 and exists (select 1 from auth.users u where u.id=p_owner and u.email_confirmed_at is not null)
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false;
$$;
revoke all on function public.ifund_owns_campaign_document_context(uuid,uuid) from public,anon;
grant execute on function public.ifund_owns_campaign_document_context(uuid,uuid) to authenticated;

drop policy if exists ifund_docs_owner_read on public.ifund_campaign_documents;
create policy ifund_docs_owner_read on public.ifund_campaign_documents
  for select to authenticated
  using(public.ifund_owns_campaign_document_context(owner_id,campaign_id));
drop policy if exists ifund_docs_owner_insert on public.ifund_campaign_documents;
create policy ifund_docs_owner_insert on public.ifund_campaign_documents
  for insert to authenticated
  with check(public.ifund_owns_campaign_document_context(owner_id,campaign_id));
drop policy if exists ifund_docs_owner_update on public.ifund_campaign_documents;
create policy ifund_docs_owner_update on public.ifund_campaign_documents
  for update to authenticated
  using(public.ifund_owns_campaign_document_context(owner_id,campaign_id))
  with check(public.ifund_owns_campaign_document_context(owner_id,campaign_id));
drop policy if exists ifund_docs_owner_delete on public.ifund_campaign_documents;
create policy ifund_docs_owner_delete on public.ifund_campaign_documents
  for delete to authenticated
  using(public.ifund_owns_campaign_document_context(owner_id,campaign_id));

-- Object path format: authenticated owner UUID / owned campaign UUID / file UUID.ext
-- Operations remain owner-scoped. Upserts and object replacement are disallowed.
drop policy if exists ifund_campaign_documents_storage_insert on storage.objects;
create policy ifund_campaign_documents_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id='ifund-campaign-documents'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|docx|xlsx|txt|md|csv)$'
    and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|docx|xlsx|txt|md|csv)$'
      then public.ifund_owns_campaign_document_context(
        (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
      else false end
  );
drop policy if exists ifund_campaign_documents_storage_read on storage.objects;
create policy ifund_campaign_documents_storage_read on storage.objects
  for select to authenticated using (
    bucket_id='ifund-campaign-documents' and
    case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|docx|xlsx|txt|md|csv)$'
      then public.ifund_owns_campaign_document_context(
        (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
      else false end
    -- An uploaded but not registered object must not be readable as a
    -- campaign reference. The owner may still delete a failed upload.
    and exists (select 1 from public.ifund_campaign_documents d
      where d.storage_path=storage.objects.name
        and d.owner_id=(select auth.uid()))
  );
drop policy if exists ifund_campaign_documents_storage_delete on storage.objects;
create policy ifund_campaign_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id='ifund-campaign-documents' and
    case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|docx|xlsx|txt|md|csv)$'
      then public.ifund_owns_campaign_document_context(
        (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
      else false end
  );

-- Private, agent-consented summary retrieval. Never sends raw files to LLMs.
-- Reads are owner-scoped through RLS, with no privileged bypass.
create or replace function public.ifund_campaign_agent_document_briefs(p_campaign_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'document_id',d.id,'purpose',d.purpose,'file_name',left(d.file_name,160),'summary',left(d.agent_summary,3000),
  'owner_supplied',true,'source_type','uploaded_private_document_summary',
  'owner_excerpt',left(d.owner_excerpt,1200),
  'extracted_excerpt',case when d.media_type in ('text/plain','text/markdown','text/csv')
    then left(d.extracted_text,2000) else '' end
) order by d.created_at desc),'[]'::jsonb)
from (select * from public.ifund_campaign_documents
      where campaign_id=p_campaign_id and owner_id=(select auth.uid())
        and allow_agent_use=true order by created_at desc limit 6) d;
$$;
revoke all on function public.ifund_campaign_agent_document_briefs(uuid) from public,anon;
grant execute on function public.ifund_campaign_agent_document_briefs(uuid) to authenticated;

-- Serialize per-campaign inserts so concurrent clients cannot exceed the free
-- storage allowance; do not let deleting a campaign orphan private Storage objects.
create or replace function public.ifund_campaign_documents_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare actual_bytes bigint;
begin
  if tg_op='INSERT' then
    -- Serialize all of this owner's campaigns under the same account lock.
    perform 1 from public.ifund_profiles p where p.id=new.owner_id for update;
    if not found then raise exception 'Active owner required' using errcode='42501'; end if;
    perform 1 from public.ifund_campaigns c where c.id=new.campaign_id
      and c.owner_id=new.owner_id for update;
    if not found then raise exception 'Owned campaign required' using errcode='42501'; end if;
    -- Storage's finalized size is the authority, never the browser request.
    select case when (o.metadata->>'size') ~ '^[0-9]{1,10}$'
      then (o.metadata->>'size')::bigint else null end
      into actual_bytes from storage.objects o
      where o.bucket_id='ifund-campaign-documents' and o.name=new.storage_path;
    if actual_bytes is null or actual_bytes not between 1 and 8388608
      or actual_bytes<>new.file_size then
      raise exception 'Verified private upload size is required' using errcode='23514';
    end if;
    if coalesce((select sum(d.file_size) from public.ifund_campaign_documents d
      where d.owner_id=new.owner_id),0)+actual_bytes>209715200 then
      raise exception 'Private document allowance reached (200 MB per account)' using errcode='23514';
    end if;
    if (select count(*) from public.ifund_campaign_documents d
      where d.owner_id=new.owner_id and d.campaign_id=new.campaign_id)>=15 then
      raise exception 'Campaign document limit reached' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ifund_campaign_documents_guard() from public,anon,authenticated;
drop trigger if exists ifund_campaign_documents_guard_insert on public.ifund_campaign_documents;
create trigger ifund_campaign_documents_guard_insert before insert on public.ifund_campaign_documents
  for each row execute function public.ifund_campaign_documents_guard();

create or replace function public.ifund_campaign_documents_prevent_orphans()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Interactive owner deletion must clean attachments before deleting the campaign.
  -- Privileged account erasure may proceed; its external Storage cleanup still
  -- needs to be executed separately by the account-deletion service.
  if auth.uid() is not null
    and exists(select 1 from public.ifund_campaign_documents d where d.campaign_id=old.id)
  then raise exception 'Remove private campaign documents before deleting this campaign' using errcode='23514'; end if;
  return old;
end $$;
revoke all on function public.ifund_campaign_documents_prevent_orphans() from public,anon,authenticated;
drop trigger if exists ifund_campaign_documents_no_orphans on public.ifund_campaigns;
create trigger ifund_campaign_documents_no_orphans before delete on public.ifund_campaigns
  for each row execute function public.ifund_campaign_documents_prevent_orphans();

commit;

      then (o.metadata->>'size')::bigint else null end
      into actual_bytes
      from storage.objects o
      where o.bucket_id='ifund-campaign-documents' and o.name=new.storage_path;
    if actual_bytes is null or actual_bytes not between 1 and 8388608
      or actual_bytes<>new.file_size
    then raise exception 'Verified private upload size is required' using errcode='23514'; end if;
    if coalesce((select sum(d.file_size) from public.ifund_campaign_documents d
      where d.owner_id=new.owner_id),0)+actual_bytes>209715200
    then raise exception 'Private document allowance reached (200 MB per account)' using errcode='23514'; end if;
    if (select count(*) from public.ifund_campaign_documents d
      where d.owner_id=new.owner_id and d.campaign_id=new.campaign_id)>=15 then
      raise exception 'Campaign document limit reached' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.ifund_campaign_documents_guard() from public,anon,authenticated;
drop trigger if exists ifund_campaign_documents_guard_insert on public.ifund_campaign_documents;
create trigger ifund_campaign_documents_guard_insert before insert on public.ifund_campaign_documents
  for each row execute function public.ifund_campaign_documents_guard();

create or replace function public.ifund_campaign_documents_prevent_orphans()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Interactive owner deletion must clean attachments before deleting the campaign.
  -- Privileged account erasure may proceed; its external Storage cleanup still
  -- needs to be executed separately by the account-deletion service.
  if auth.uid() is not null
    and exists(select 1 from public.ifund_campaign_documents d where d.campaign_id=old.id)
  then raise exception 'Remove private campaign documents before deleting this campaign' using errcode='23514'; end if;
  return old;
end $$;
revoke all on function public.ifund_campaign_documents_prevent_orphans() from public,anon,authenticated;
drop trigger if exists ifund_campaign_documents_no_orphans on public.ifund_campaigns;
create trigger ifund_campaign_documents_no_orphans before delete on public.ifund_campaigns
  for each row execute function public.ifund_campaign_documents_prevent_orphans();

commit;
