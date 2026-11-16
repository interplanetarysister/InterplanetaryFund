-- Administrative approval for the private-document substep of account erasure.
-- Never marks a deletion request completed and never deletes payment ledgers.
begin;

alter table public.ifund_account_deletion_requests
  add column if not exists document_cleanup_review_note text,
  add column if not exists document_cleanup_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists document_cleanup_reviewed_at timestamptz;

create or replace function public.ifund_super_admin_review_private_document_cleanup(
 p_request_id uuid,p_review_note text
) returns boolean
language plpgsql security definer set search_path='' as $ifund$
declare actor uuid:=auth.uid(); affected integer;
begin
  if not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
    or actor is null then
    raise exception 'Verified super administrator required' using errcode='42501';
  end if;
  if p_request_id is null or p_review_note is null
    or length(btrim(p_review_note)) not between 30 and 1000 then
    raise exception 'Document cleanup review evidence is required' using errcode='22023';
  end if;
  -- Approval of the file substep requires manually checking dependent finance,
  -- retention and legal obligations, and recording that decision.
  update public.ifund_account_deletion_requests r set
    status='reviewing',
    document_cleanup_review_note=btrim(p_review_note),
    document_cleanup_reviewed_by=actor,
    document_cleanup_reviewed_at=now(),
    updated_at=now()
  where r.id=p_request_id and r.status='requested'
    and r.user_id is not null and r.user_id<>actor;
  get diagnostics affected=row_count;
  if affected<>1 then
    raise exception 'Only an outstanding other-user request can be reviewed' using errcode='42501';
  end if;
  return true;
end
$ifund$;
revoke all on function public.ifund_super_admin_review_private_document_cleanup(uuid,text) from public,anon;
grant execute on function public.ifund_super_admin_review_private_document_cleanup(uuid,text) to authenticated;

-- Review status is not proof that private file erasure finished, nor is it
-- permission to mark the full user deletion completed without other evidence.
comment on function public.ifund_super_admin_review_private_document_cleanup(uuid,text) is
 'Audited approval to execute private campaign-document file cleanup only; never completes identity or financial erasure.';

-- The only privileged listing surface for document cleanup. It includes
-- unfinished uploads (Storage object without metadata) and stale metadata
-- (object missing) so account erasure cannot silently leave either behind.
create or replace function public.ifund_super_admin_private_document_inventory(
 p_request_id uuid,p_limit integer default 100
) returns table(document_id uuid,storage_path text,
  deletion_requested_at timestamptz,storage_present boolean,metadata_present boolean)
language plpgsql security definer set search_path='' as $ifund$
declare v_owner uuid;
begin
 if not coalesce(public.ifund_current_user_is_verified_super_admin(),false)
   or p_request_id is null or p_limit is null or p_limit not between 1 and 100 then
   raise exception 'Verified administrator and bounded request required' using errcode='42501';
 end if;
 select r.user_id into v_owner from public.ifund_account_deletion_requests r
  where r.id=p_request_id and r.status='reviewing'
    and r.document_cleanup_reviewed_by is not null
    and r.document_cleanup_reviewed_at is not null;
 if v_owner is null then
   raise exception 'Reviewed account deletion request required' using errcode='42501';
 end if;
 return query
 select d.id,coalesce(d.storage_path,o.name),d.deletion_requested_at,
   (o.id is not null),(d.id is not null)
 from public.ifund_campaign_documents d
 full outer join storage.objects o
   on o.bucket_id='ifund-campaign-documents' and o.name=d.storage_path
 where d.owner_id=v_owner or
   (o.bucket_id='ifund-campaign-documents'
     and o.name like v_owner::text || '/%')
 order by coalesce(d.storage_path,o.name) asc limit p_limit;
end
$ifund$;
revoke all on function public.ifund_super_admin_private_document_inventory(uuid,integer) from public,anon;
grant execute on function public.ifund_super_admin_private_document_inventory(uuid,integer) to authenticated;


commit;
