begin;
-- Public sponsor endpoint intentionally filters state=published in addition to
-- the RLS gate. PostgREST requires SELECT on filter columns even when every
-- returned row is already restricted by RLS.
grant select (state) on public.ifund_sponsor_opportunities to anon,authenticated;
-- No new INSERT, UPDATE, DELETE grants or sponsor data; RLS remains authoritative.
commit;
