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
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,campaign_id,id),
  check(storage_path=owner_id::text||'/'||campaign_id::text||'/'||id::text||'.'||
    case media_type when 'application/pdf' then 'pdf'
      when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx'
      when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then 'xlsx'
      when 'text/plain' then 'txt' when 'text/markdown' then 'md' when 'text/csv' then 'csv' end),
  check(not allow_agent_use or length(btrim(agent_summary))>=20),
  check(deletion_requested_at is null or allow_agent_use=false)
);
create index if not exists ifund_campaign_documents_owner_campaign_idx
  on public.ifund_campaign_documents(owner_id,campaign_id,created_at desc);
alter table public.ifund_campaign_documents enable row level security;
revoke all on public.ifund_campaign_documents from public,anon,authenticated;
grant select,insert,delete on public.ifund_campaign_documents to authenticated;
grant update(allow_agent_use,agent_summary,purpose,owner_excerpt,deletion_requested_at) on public.ifund_campaign_documents to authenticated;

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
    -- An upload that succeeds before metadata registration must remain
    -- readable/deletable by its authenticated owner for rollback. Ownership
    -- comes from the exact UUID path and verified campaign membership, not
    -- from public Storage access or from a client-provided owner field.
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

-- Enforce limits at Storage ingress, including files whose metadata row has not
-- yet been registered. A metadata-only quota can be bypassed by orphan uploads.
-- Serialize all owner uploads on the existing profile row. No client-supplied
-- size or user id is trusted; unknown finalized size fails closed.
-- Reserve the full 8 MiB while Storage size metadata is pending. This prevents
-- concurrent orphan uploads bypassing quotas; final size is checked on UPDATE.
create or replace function public.ifund_private_document_storage_ingress_guard()
returns trigger language plpgsql security definer set search_path='' as $storage_guard$
declare
  v_owner uuid;
  v_campaign uuid;
  v_size bigint;
  v_total bigint;
  v_count bigint;
begin
  if new.bucket_id is distinct from 'ifund-campaign-documents' then return new; end if;
  if tg_op='UPDATE' and (new.name is distinct from old.name or new.bucket_id is distinct from old.bucket_id) then
    raise exception 'Private document object relocation is forbidden' using errcode='23514';
  end if;
  if new.name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|docx|xlsx|txt|md|csv)$' then
    raise exception 'Invalid private document path' using errcode='23514';
  end if;
  v_owner:=split_part(new.name,'/',1)::uuid;
  v_campaign:=split_part(new.name,'/',2)::uuid;
  if not public.ifund_owns_campaign_document_context(v_owner,v_campaign) then
    raise exception 'Verified campaign owner required' using errcode='42501';
  end if;
  perform 1 from public.ifund_profiles p where p.id=v_owner for update;
  if not found then raise exception 'Active owner required' using errcode='42501'; end if;
  if new.metadata ? 'size' and coalesce(new.metadata->>'size','') !~ '^[0-9]{1,10}$' then
    raise exception 'Invalid private upload size' using errcode='23514';
  end if;
  v_size:=case when coalesce(new.metadata->>'size','') ~ '^[0-9]{1,10}$'
    then (new.metadata->>'size')::bigint else 8388608 end;
  if v_size not between 1 and 8388608 then
    raise exception 'Private document exceeds 8 MB limit' using errcode='23514';
  end if;
  select coalesce(sum(case when coalesce(o.metadata->>'size','') ~ '^[0-9]{1,10}$'
    then (o.metadata->>'size')::bigint else 8388608 end),0),
    count(*) filter (where split_part(o.name,'/',2)=v_campaign::text)
    into v_total,v_count
    from storage.objects o where o.bucket_id='ifund-campaign-documents'
      and split_part(o.name,'/',1)=v_owner::text
      and (tg_op='INSERT' or o.id<>old.id);
  if v_total+v_size>209715200 or v_count>=15 then
    raise exception 'Private Storage allowance reached' using errcode='23514';
  end if;
  return new;
end $storage_guard$;
revoke all on function public.ifund_private_document_storage_ingress_guard() from public,anon,authenticated;
drop trigger if exists ifund_private_document_storage_ingress on storage.objects;
create trigger ifund_private_document_storage_ingress before insert or update on storage.objects
  for each row execute function public.ifund_private_document_storage_ingress_guard();

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
        and deletion_requested_at is null and allow_agent_use=true order by created_at desc limit 6) d;
$$;
revoke all on function public.ifund_campaign_agent_document_briefs(uuid) from public,anon;
grant execute on function public.ifund_campaign_agent_document_briefs(uuid) to authenticated;

-- Atomic owner-wide revocation used by My Account. Return an actual affected-row
-- count without PostgREST's default response cap; security invoker preserves
-- the table's active-account and ownership RLS. No file bytes are affected.
create or replace function public.ifund_campaign_documents_revoke_all_agent_use()
returns integer language plpgsql security invoker set search_path='' as $revoke$
declare
  v_owner uuid:=(select auth.uid());
  v_count integer;
begin
  if v_owner is null then raise exception 'Verified campaign owner required' using errcode='42501'; end if;
  update public.ifund_campaign_documents d
    set allow_agent_use=false
    where d.owner_id=v_owner and d.allow_agent_use=true
      and d.deletion_requested_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end $revoke$;
revoke all on function public.ifund_campaign_documents_revoke_all_agent_use() from public,anon;
grant execute on function public.ifund_campaign_documents_revoke_all_agent_use() to authenticated;

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

-- A deletion request is irreversible through the browser. An owner may
-- finish cleaning up Storage or an authorized erasure worker may do so.
create or replace function public.ifund_campaign_document_deletion_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.deletion_requested_at is not null then
    if new.deletion_requested_at is distinct from old.deletion_requested_at
      or new.allow_agent_use is distinct from false
      or new.owner_excerpt is distinct from old.owner_excerpt
      or new.agent_summary is distinct from old.agent_summary
      or new.purpose is distinct from old.purpose then
      raise exception 'Document deletion already requested' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.ifund_campaign_document_deletion_guard() from public,anon,authenticated;
drop trigger if exists ifund_campaign_document_deletion_guard on public.ifund_campaign_documents;
create trigger ifund_campaign_document_deletion_guard before update on public.ifund_campaign_documents
  for each row execute function public.ifund_campaign_document_deletion_guard();

-- Metadata may only disappear after the private object is absent. This
-- applies to privileged deletion as well as owner DELETE, preventing silent
-- orphan creation by direct table deletes or cascade operations.
create or replace function public.ifund_campaign_document_metadata_delete_guard()
returns trigger language plpgsql security definer set search_path='' as $guard$
begin
  if exists (select 1 from storage.objects o
    where o.bucket_id='ifund-campaign-documents' and o.name=old.storage_path) then
    raise exception 'Remove private Storage object before document metadata'
      using errcode='23514';
  end if;
  return old;
end $guard$;
revoke all on function public.ifund_campaign_document_metadata_delete_guard()
  from public,anon,authenticated;
drop trigger if exists ifund_campaign_document_metadata_delete_guard
  on public.ifund_campaign_documents;
create trigger ifund_campaign_document_metadata_delete_guard
  before delete on public.ifund_campaign_documents
  for each row execute function public.ifund_campaign_document_metadata_delete_guard();

create or replace function public.ifund_campaign_documents_prevent_orphans()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- This must also apply to privileged jobs and cascaded account deletion:
  -- metadata may not disappear while its private Storage bytes remain. The
  -- reviewed file-erasure workflow must remove documents before deleting the
  -- campaign or the owning Auth user.
  if exists(select 1 from public.ifund_campaign_documents d where d.campaign_id=old.id)
    or exists(select 1 from storage.objects o
      where o.bucket_id='ifund-campaign-documents'
        and o.name like old.owner_id::text || '/' || old.id::text || '/%')
  then raise exception 'Remove private campaign documents before deleting this campaign' using errcode='23514'; end if;
  return old;
end $$;
revoke all on function public.ifund_campaign_documents_prevent_orphans() from public,anon,authenticated;
drop trigger if exists ifund_campaign_documents_no_orphans on public.ifund_campaigns;
create trigger ifund_campaign_documents_no_orphans before delete on public.ifund_campaigns
  for each row execute function public.ifund_campaign_documents_prevent_orphans();

