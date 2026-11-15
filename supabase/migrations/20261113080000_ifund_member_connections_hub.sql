-- Owner-controlled public profile/fundraiser links and sharing preferences.
-- Link records are NOT OAuth authorizations, financial balances or publishing grants.
-- Never accept passwords, provider tokens, or donor data.
create table if not exists public.ifund_member_public_links (
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(char_length(provider) between 1 and 48),
  page_url text not null check(char_length(page_url) between 10 and 1500),
  label text not null default '' check(char_length(label)<=100),
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id,provider)
);
create index if not exists ifund_member_public_links_campaign_idx on public.ifund_member_public_links(campaign_id) where campaign_id is not null;
alter table public.ifund_member_public_links enable row level security;
revoke all on public.ifund_member_public_links from public, anon, authenticated;

create table if not exists public.ifund_member_share_choices (
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(char_length(provider) between 1 and 48),
  choice text not null default 'manual' check(choice in ('manual','draft','review','off')),
  updated_at timestamptz not null default now(),
  primary key(owner_id,provider)
);
alter table public.ifund_member_share_choices enable row level security;
revoke all on public.ifund_member_share_choices from public,anon,authenticated;

create or replace function public.ifund_member_connection_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and coalesce(public.ifund_current_account_is_active(),false)
   and exists(select 1 from auth.users u where u.id=auth.uid()
     and u.is_anonymous is false and u.email_confirmed_at is not null)
$$;
revoke all on function public.ifund_member_connection_allowed() from public,anon;
grant execute on function public.ifund_member_connection_allowed() to authenticated;

create or replace function public.ifund_my_public_links()
returns table(provider text,page_url text,label text,campaign_id uuid,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path = '' set row_security = 'off' as $$
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode = '42501';
 end if;
 return query select l.provider,l.page_url,l.label,l.campaign_id,l.created_at,l.updated_at
 from public.ifund_member_public_links l where l.owner_id=auth.uid() order by l.updated_at desc limit 100;
end $$;

create or replace function public.ifund_save_public_link(
 p_provider text,p_url text,p_label text default null,p_campaign_id uuid default null
) returns boolean language plpgsql volatile security definer set search_path = '' set row_security = 'off' as $$
declare v_url text:=btrim(coalesce(p_url,''));v_host text;v_allow boolean;
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode = '42501';
 end if;
 if p_provider is null or char_length(p_provider)>48
   or p_provider !~ '^[a-z][a-z0-9_]*$'
   or char_length(v_url) not between 10 and 1500
   or char_length(btrim(coalesce(p_label,'')))>100 then
   raise exception 'Invalid link information' using errcode='22023';
 end if;
 if v_url !~* '^https://[^/?#]+([/?#]|$)' then
   raise exception 'Use a secure public page address' using errcode='22023';
 end if;
 v_host:=lower(split_part(split_part(split_part(substring(v_url from 9), '/', 1), '?', 1),'#',1));
 if v_host !~ '^([a-z0-9-]+[.])+[a-z]{2,}$'
    or v_host like '%.local' or v_host like '%.internal' or v_host like '%.localhost' then
   raise exception 'Use a public website address' using errcode='22023';
 end if;
 if p_provider='custom' or p_provider='mastodon' then
   v_allow:=true;
 else
   select exists(select 1 from (values
 ('justgiving','justgiving.com'),
 ('gofundme','gofundme.com'),
 ('kickstarter','kickstarter.com'),
 ('indiegogo','indiegogo.com'),
 ('fundrazr','fundrazr.com'),
 ('fundly','fundly.com'),
 ('givesendgo','givesendgo.com'),
 ('kofi','ko-fi.com'),
 ('buymeacoffee','buymeacoffee.com'),
 ('patreon','patreon.com'),
 ('spotfund','spotfund.com'),
 ('eventbrite','eventbrite.com'),
 ('gumroad','gumroad.com'),
 ('givebutter','givebutter.com'),
 ('donorbox','donorbox.org'),
 ('wordpress_com','wordpress.com'),
 ('bluesky','bsky.app'),
 ('mastodon','joinmastodon.org'),
 ('facebook','facebook.com'),
 ('instagram','instagram.com'),
 ('threads','threads.net'),
 ('x','x.com'),
 ('linkedin','linkedin.com'),
 ('tiktok','tiktok.com'),
 ('pinterest','pinterest.com'),
 ('reddit','reddit.com'),
 ('youtube','youtube.com'),
 ('discord','discord.com'),
 ('x','twitter.com'),
 ('threads','threads.com'),
 ('kofi','ko-fi.com'),
 ('bluesky','bsky.social'),
 ('buymeacoffee','buymeacoffee.com'),
 ('discord','discord.gg'),
 ('mastodon','mastodon.social')
   ) as sites(provider,host)
   where sites.provider=p_provider and
     (v_host=sites.host or v_host like '%.'||sites.host)) into v_allow;
 end if;
 if not coalesce(v_allow,false) then
   raise exception 'Use the public page address for the selected platform' using errcode='22023';
 end if;
 -- Save only the public page; strip marketing and authorization query data.
 v_url:=split_part(split_part(v_url,'?',1),'#',1);
 if p_campaign_id is not null and not exists(
   select 1 from public.ifund_campaigns c where c.id=p_campaign_id and c.owner_id=auth.uid()
 ) then raise exception 'Choose a campaign you manage' using errcode='42501'; end if;
 insert into public.ifund_member_public_links(owner_id,provider,page_url,label,campaign_id)
 values(auth.uid(),p_provider,v_url,btrim(coalesce(p_label,'')),p_campaign_id)
 on conflict(owner_id,provider) do update set
 page_url=excluded.page_url,label=excluded.label,campaign_id=excluded.campaign_id,
 updated_at=now();
 return true;
end $$;
create or replace function public.ifund_remove_public_link(p_provider text)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off' as $$
declare v_deleted integer;
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode='42501';
 end if;
 delete from public.ifund_member_public_links where owner_id=auth.uid() and provider=p_provider;
 get diagnostics v_deleted=row_count;
 return v_deleted>0;
end $$;

create or replace function public.ifund_my_share_choices()
returns table(provider text,choice text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off' as $$
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode='42501';
 end if;
 return query select p.provider,p.choice,p.updated_at from public.ifund_member_share_choices p
 where p.owner_id=auth.uid() order by p.provider limit 100;
end $$;
create or replace function public.ifund_set_share_choice(p_provider text,p_choice text)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off' as $$
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode='42501';
 end if;
 if p_provider is null or p_provider not in ('justgiving','gofundme','kickstarter','indiegogo','fundrazr','fundly','givesendgo','kofi','buymeacoffee','patreon','spotfund','eventbrite','gumroad','custom','givebutter','donorbox','wordpress_com','bluesky','mastodon','facebook','instagram','threads','x','linkedin','tiktok','pinterest','reddit','youtube','discord','gmail','googledrive','googlecalendar','google_contacts','google_photos','googlesheets','googledocs','googleforms','googletasks','slack','notion','outlook','microsoft_teams','one_drive','dropbox','github','gitlab','google')
   or p_choice not in ('manual','draft','review','off') then
   raise exception 'Invalid sharing preference' using errcode='22023';
 end if;
 insert into public.ifund_member_share_choices(owner_id,provider,choice)
 values(auth.uid(),p_provider,p_choice)
 on conflict(owner_id,provider) do update set choice=excluded.choice,updated_at=now();
 return true;
end $$;
revoke all on function public.ifund_my_public_links() from public,anon;
revoke all on function public.ifund_save_public_link(text,text,text,uuid) from public,anon;
revoke all on function public.ifund_remove_public_link(text) from public,anon;
revoke all on function public.ifund_my_share_choices() from public,anon;
revoke all on function public.ifund_set_share_choice(text,text) from public,anon;
grant execute on function public.ifund_my_public_links() to authenticated;
grant execute on function public.ifund_save_public_link(text,text,text,uuid) to authenticated;
grant execute on function public.ifund_remove_public_link(text) to authenticated;
grant execute on function public.ifund_my_share_choices() to authenticated;
grant execute on function public.ifund_set_share_choice(text,text) to authenticated;

-- Revocable, private owner choice for optional iFund connection assistance.
-- This permits only member-requested guidance and draft suggestions.
-- It is not OAuth consent, provider posting permission, or agent execution.
create table if not exists public.ifund_member_connection_assistance (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  decided_at timestamptz not null default now()
);
alter table public.ifund_member_connection_assistance enable row level security;
revoke all on public.ifund_member_connection_assistance from public,anon,authenticated;

create or replace function public.ifund_my_connection_assistance()
returns table(enabled boolean,decided_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security='off' as $$
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode='42501';
 end if;
 return query select a.enabled,a.decided_at
 from public.ifund_member_connection_assistance a where a.owner_id=auth.uid();
end $$;
create or replace function public.ifund_set_connection_assistance(p_enabled boolean)
returns boolean language plpgsql volatile security definer set search_path='' set row_security='off' as $$
begin
 if not public.ifund_member_connection_allowed() then
   raise exception 'Verified active account required' using errcode='42501';
 end if;
 if p_enabled is null then
   raise exception 'Choose whether connection guidance is enabled' using errcode='22023';
 end if;
 insert into public.ifund_member_connection_assistance(owner_id,enabled,decided_at)
 values(auth.uid(),p_enabled,now())
 on conflict(owner_id) do update
 set enabled=excluded.enabled,decided_at=excluded.decided_at;
 return true;
end $$;
revoke all on function public.ifund_my_connection_assistance() from public,anon;
revoke all on function public.ifund_set_connection_assistance(boolean) from public,anon;
grant execute on function public.ifund_my_connection_assistance() to authenticated;
grant execute on function public.ifund_set_connection_assistance(boolean) to authenticated;
