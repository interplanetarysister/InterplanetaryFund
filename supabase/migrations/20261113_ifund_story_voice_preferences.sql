-- STORY: explicit private owner voice preference. Does not authorize AI inference.
create table if not exists public.ifund_story_voice_preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 voice_instructions text not null check(char_length(voice_instructions) between 4 and 400),
 updated_at timestamptz not null default now()
);
alter table public.ifund_story_voice_preferences enable row level security;
revoke all on public.ifund_story_voice_preferences from public,anon,authenticated;
create or replace function public.ifund_my_story_voice_preferences()
returns table(voice_instructions text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
 then raise exception 'Active owner required' using errcode='42501'; end if;
 return query select p.voice_instructions,p.updated_at
 from public.ifund_story_voice_preferences p where p.owner_id=v_owner;
end $$;
create or replace function public.ifund_set_story_voice_preferences(p_instructions text)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off'
as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not coalesce(public.ifund_current_account_is_active(),false)
   or not exists(select 1 from auth.users u where u.id=v_owner and u.email_confirmed_at is not null and u.is_anonymous is false)
 then raise exception 'Confirmed active owner required' using errcode='42501'; end if;
 if p_instructions is null or char_length(btrim(p_instructions)) not between 4 and 400
 then raise exception 'Voice preference must contain 4–400 characters' using errcode='22023';end if;
 insert into public.ifund_story_voice_preferences(owner_id,voice_instructions)
 values(v_owner,btrim(p_instructions))
 on conflict(owner_id) do update set voice_instructions=excluded.voice_instructions,updated_at=now();
 return true;
end $$;
revoke all on function public.ifund_my_story_voice_preferences() from public,anon;
revoke all on function public.ifund_set_story_voice_preferences(text) from public,anon;
grant execute on function public.ifund_my_story_voice_preferences() to authenticated;
grant execute on function public.ifund_set_story_voice_preferences(text) to authenticated;
