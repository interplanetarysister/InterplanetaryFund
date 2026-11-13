-- Reconcile the server story-length guard with frontend whitespace trimming.
-- Does not rewrite or unpublish the 26 legacy active campaigns reported in audit.
-- Only direct INSERT as active or transition from draft/paused to active is gated.
create or replace function public.ifund_prepublication_story_gate()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  v_story text;
begin
  -- PostgreSQL btrim() strips only spaces by default. For publication,
  -- trim line breaks, tabs and other whitespace that contribute no story.
  v_story:=pg_catalog.regexp_replace(coalesce(new.story,''),'^[[:space:]]+|[[:space:]]+$','','g');
  if new.status='active' and pg_catalog.char_length(v_story)<3500 then
    if tg_op='INSERT' or old.status is distinct from 'active' then
      raise exception 'Publishing requires a full-length story of at least 3500 characters.'
        using errcode='23514',constraint='ifund_prepublication_story_min_3500';
    end if;
  end if;
  return new;
end
$$;
