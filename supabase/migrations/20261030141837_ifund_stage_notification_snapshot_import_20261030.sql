
begin;

do $preflight$
declare n integer; bad integer;
begin
  select count(*) into n
  from ifund_transfer.content_snapshots
  where entity_type='Notification'
    and origin_project_ref='tzehxfikoslihnclhxuz';
  if n <> 96 then
    raise exception 'Expected 96 Notification source snapshots; found %.', n;
  end if;

  select count(*) into bad
  from ifund_transfer.content_snapshots
  where entity_type='Notification'
    and origin_project_ref='tzehxfikoslihnclhxuz'
    and (
      source_payload->>'id' is null
      or source_payload->>'user_id' is null
      or nullif(source_payload->>'title','') is null
      or source_payload->>'type' not in ('donation','update','thank_you','announcement','milestone','system')
      or source_payload->>'read' not in ('true','false')
      or nullif(source_payload->>'created_date','') is null
      or nullif(source_payload->>'updated_date','') is null
      or source_digest_sha256 <> encode(digest(source_payload::text,'sha256'),'hex')
    );
  if bad <> 0 then
    raise exception 'Notification source snapshot validation failed for % rows.', bad;
  end if;

  if exists (
    select 1 from ifund_stage.notification n
    join ifund_transfer.content_snapshots s
      on s.entity_type='Notification' and s.source_id=n.legacy_id
    where n.user_id is distinct from s.source_payload->>'user_id'
       or n.title is distinct from s.source_payload->>'title'
       or n.body is distinct from s.source_payload->>'body'
       or n.type is distinct from s.source_payload->>'type'
       or n.link is distinct from s.source_payload->>'link'
       or n.read is distinct from (s.source_payload->>'read')::boolean
       or n.source_created_at is distinct from (s.source_payload->>'created_date')::timestamptz
       or n.source_updated_at is distinct from (s.source_payload->>'updated_date')::timestamptz
       or n.source_digest_sha256 is distinct from s.source_digest_sha256
  ) then
    raise exception 'Existing normalized Notification stage row differs from its source snapshot.';
  end if;
end
$preflight$;

insert into ifund_stage.notification
  (legacy_id,owner_auth_uid,user_id,title,body,type,link,read,
   canonical_operation_id,source_created_at,source_updated_at,
   source_created_by_id,source_is_sample,source_digest_sha256)
select
  s.source_payload->>'id',
  null,
  s.source_payload->>'user_id',
  s.source_payload->>'title',
  s.source_payload->>'body',
  s.source_payload->>'type',
  s.source_payload->>'link',
  (s.source_payload->>'read')::boolean,
  s.source_payload->>'canonical_operation_id',
  (s.source_payload->>'created_date')::timestamptz,
  (s.source_payload->>'updated_date')::timestamptz,
  s.source_payload->>'created_by_id',
  coalesce((s.source_payload->>'is_sample')::boolean,false),
  s.source_digest_sha256
from ifund_transfer.content_snapshots s
where s.entity_type='Notification'
  and s.origin_project_ref='tzehxfikoslihnclhxuz'
on conflict (legacy_id) do nothing;

insert into ifund_transfer.source_inventory
  (origin_project_ref,source_relation,entity_type,observed_source_rows,
   staged_target_rows,source_export_verified,notes)
values
  ('tzehxfikoslihnclhxuz','ifund_stage.notification','Notification',96,96,false,
   '96 Base44 Notification records staged privately from exact SHA-256-validated content snapshots. Original timestamps, source creator ID, sample flag, legacy owner ID, read state, and source digest preserved. owner_auth_uid intentionally NULL pending verified account mapping. No public notification rows created.')
on conflict (origin_project_ref,source_relation,entity_type)
do update set observed_source_rows=excluded.observed_source_rows,
              staged_target_rows=excluded.staged_target_rows,
              source_export_verified=false,
              notes=excluded.notes;

do $verify$
declare n integer; bad integer; mapped integer;
begin
  select count(*) into n from ifund_stage.notification;
  select count(*) into bad
  from ifund_stage.notification
  where source_created_at is null
     or source_updated_at is null
     or source_digest_sha256 is null
     or source_digest_sha256 !~ '^[0-9a-f]{64}$';
  select count(*) into mapped from ifund_stage.notification where owner_auth_uid is not null;
  if n <> 96 or bad <> 0 or mapped <> 0 then
    raise exception 'Notification stage verification failed: rows %, invalid %, mapped %.', n,bad,mapped;
  end if;
end
$verify$;

commit;
