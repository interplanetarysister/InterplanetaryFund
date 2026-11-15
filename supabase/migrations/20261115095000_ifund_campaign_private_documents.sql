-- Source-only: private owner-authenticated fundraising document library.
-- Never reuse the public cover bucket; no public URLs; no automatic publication.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ifund-campaign-documents','ifund-campaign-documents',false,8388608,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
     'text/plain','text/markdown','text/csv')),
  file_size integer not null check(file_size between 1 and 8388608),
  purpose text not null default 'general' check(purpose in
    ('general','budget','proof','research','planning','outreach','media')),
  agent_summary text not null default '' check(length(agent_summary)<=3000),
  extracted_text text not null default '' check(length(extracted_text)<=6000),
  allow_agent_use boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id,campaign_id,id),
  check(storage_path=owner_id::text||'/'||campaign_id::text||'/'||id::text||'.'||
    case media_type when 'application/pdf' then 'pdf'
      when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
      when 'text/plain' then 'txt' when 'text/markdown' then 'md' when 'text/csv' then 'csv' end),
  check(not allow_agent_use or length(btrim(agent_summary))>=20)
);
create index if not exists ifund_campaign_documents_owner_campaign_idx
  on public.ifund_campaign_documents(owner_id,campaign_id,created_at desc);
alter table public.ifund_campaign_documents enable row level security;
revoke all on public.ifund_campaign_documents from public,anon,authenticated;
grant select,insert,delete on public.ifund_campaign_documents to authenticated;
grant update(allow_agent_use,agent_summary,purpose) on public.ifund_campaign_documents to authenticated;

create or replace function public.ifund_owns_campaign_document_context(p_owner uuid,p_campaign uuid)
returns boolean language sql stable security invoker set search_path='' as $$
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
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|docx|txt|md|csv)$'
    and public.ifund_owns_campaign_document_context(
      (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
  );
drop policy if exists ifund_campaign_documents_storage_read on storage.objects;
create policy ifund_campaign_documents_storage_read on storage.objects
  for select to authenticated using (
    bucket_id='ifund-campaign-documents' and
    public.ifund_owns_campaign_document_context(
      (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
  );
drop policy if exists ifund_campaign_documents_storage_delete on storage.objects;
create policy ifund_campaign_documents_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id='ifund-campaign-documents' and
    public.ifund_owns_campaign_document_context(
      (storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
  );

-- Private, agent-consented summary retrieval. Never sends raw files to LLMs.
-- Reads are owner-scoped through RLS, with no privileged bypass.
create or replace function public.ifund_campaign_agent_document_briefs(p_campaign_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'document_id',d.id,'purpose',d.purpose,'summary',left(d.agent_summary,3000),
  'owner_supplied',true,'source_type','uploaded_private_document_summary',
  'extracted_excerpt',case when d.media_type in ('text/plain','text/markdown','text/csv')
    then left(d.extracted_text,2000) else '' end
) order by d.created_at desc),'[]'::jsonb)
from (select * from public.ifund_campaign_documents
      where campaign_id=p_campaign_id and owner_id=(select auth.uid())
        and allow_agent_use=true order by created_at desc limit 6) d;
$$;
revoke all on function public.ifund_campaign_agent_document_briefs(uuid) from public,anon;
grant execute on function public.ifund_campaign_agent_document_briefs(uuid) to authenticated;
commit;
