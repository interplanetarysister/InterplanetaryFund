-- Prevent member media and campaign document records from exhausting the
-- free-tier R2 bucket. This reserves at least 4 GiB of a nominal 10 GiB R2
-- allowance for public covers, profile avatars, and operational headroom.
-- The limit is a deliberate, fail-closed platform policy, not a measurement
-- of R2 usage outside these two registered private stores.
create or replace function ifund_private.ifund_r2_private_global_reserve()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  used_bytes bigint;
  cap_bytes constant bigint:=6442450944;
begin
  -- One global lock serializes concurrent inserts from different owners and
  -- both private tables; otherwise each user's quota can pass while the
  -- combined bucket exceeds its nominal budget.
  perform pg_catalog.pg_advisory_xact_lock(26112026);
  select
    (select coalesce(sum(file_size::bigint),0) from public.ifund_member_media)
   +(select coalesce(sum(file_size::bigint),0) from public.ifund_campaign_documents)
  into used_bytes;
  if used_bytes + new.file_size::bigint > cap_bytes then
    raise exception 'IFund shared private R2 storage reserve reached'
      using errcode='54000';
  end if;
  return new;
end $$;
drop trigger if exists ifund_r2_private_reserve_member on public.ifund_member_media;
create trigger ifund_r2_private_reserve_member
 before insert on public.ifund_member_media
 for each row execute function ifund_private.ifund_r2_private_global_reserve();
drop trigger if exists ifund_r2_private_reserve_document on public.ifund_campaign_documents;
create trigger ifund_r2_private_reserve_document
 before insert on public.ifund_campaign_documents
 for each row execute function ifund_private.ifund_r2_private_global_reserve();
revoke all on function ifund_private.ifund_r2_private_global_reserve() from public,anon,authenticated;
