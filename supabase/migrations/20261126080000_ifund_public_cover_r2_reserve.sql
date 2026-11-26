-- Track new public campaign covers in the canonical iFund R2 bucket.
-- Existing legacy cover objects are not silently claimed by this ledger.
-- A 2 GiB lifetime live-cover cap protects at least 2 GiB more operational
-- headroom after the 6 GiB private-media reserve. The cap is not an estimate
-- of legacy covers, profile avatars, or other unregistered R2 objects.
create table if not exists public.ifund_public_cover_objects (
 object_key text primary key,
 owner_id uuid not null references auth.users(id) on delete restrict,
 content_type text not null check(content_type in
   ('image/png','image/jpeg','image/webp','image/gif','image/avif')),
 byte_count integer not null check(byte_count between 1 and 5242880),
 object_sha256 text not null check(object_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 constraint ifund_public_cover_object_key_check check
  (object_key ~ '^campaigns/public/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp|gif|avif)$')
);
create index if not exists ifund_public_cover_active_owner
 on public.ifund_public_cover_objects(owner_id,created_at desc)
 where deleted_at is null;
create or replace function public.ifund_cover_storage_reserve()
 returns trigger language plpgsql set search_path='' as $$
declare live_bytes bigint;
begin
 perform pg_catalog.pg_advisory_xact_lock(26112027);
 if tg_op='INSERT' then
   select coalesce(sum(byte_count::bigint),0) into live_bytes
    from public.ifund_public_cover_objects where deleted_at is null;
   if live_bytes+new.byte_count::bigint>2147483648 then
     raise exception 'IFund cover media reserve reached' using errcode='54000';
   end if;
 else
   if (new.object_key,new.owner_id,new.content_type,new.byte_count,
       new.object_sha256,new.created_at) is distinct from
      (old.object_key,old.owner_id,old.content_type,old.byte_count,
       old.object_sha256,old.created_at)
      or (old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at)
   then raise exception 'Cover object identity or deletion marker is immutable'
        using errcode='42501';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists ifund_cover_storage_reserve_trg on public.ifund_public_cover_objects;
create trigger ifund_cover_storage_reserve_trg before insert or update
 on public.ifund_public_cover_objects for each row
 execute function public.ifund_cover_storage_reserve();
alter table public.ifund_public_cover_objects enable row level security;
revoke all on public.ifund_public_cover_objects from anon,authenticated;
revoke all on function public.ifund_cover_storage_reserve() from public,anon,authenticated;
