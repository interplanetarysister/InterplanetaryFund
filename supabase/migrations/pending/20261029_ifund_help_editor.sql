-- STAGED ONLY. Restore original HelpDraft and HelpArticle workflows after
-- owner approval, exact account-role verification, and cross-account RLS tests.
-- This migration is intentionally not applied automatically.
begin;
create table public.ifund_help_articles (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug)<=100),
 category text not null check (char_length(category) between 1 and 64),
 question text not null check (char_length(question) between 1 and 160),
 description text not null default '' check (char_length(description)<=300),
 answer text not null check (char_length(trim(answer))>0 and char_length(answer)<=20000),
 keywords text[] not null default '{}',
 helpful_yes integer not null default 0 check (helpful_yes>=0),
 helpful_no integer not null default 0 check (helpful_no>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.ifund_help_drafts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete restrict,
 article_id uuid references public.ifund_help_articles(id) on delete restrict,
 slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug)<=100),
 category text not null check (char_length(category) between 1 and 64),
 question text not null check (char_length(question) between 1 and 160),
 description text not null default '' check (char_length(description)<=300),
 answer text not null default '' check (char_length(answer)<=20000),
 keywords text[] not null default '{}',
 stage text not null default 'draft' check (stage in ('draft','in_review')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ifund_help_drafts_recent on public.ifund_help_drafts(created_at desc);
create index ifund_help_articles_recent on public.ifund_help_articles(created_at desc);
alter table public.ifund_help_drafts enable row level security;
alter table public.ifund_help_articles enable row level security;

revoke all on public.ifund_help_drafts,public.ifund_help_articles from public,anon,authenticated;
grant select on public.ifund_help_articles to anon,authenticated;
grant select,insert,update on public.ifund_help_drafts to authenticated;
grant insert,update on public.ifund_help_articles to authenticated;

-- Auth JWT app_metadata is only set by the trusted Auth service. Never
-- authorize administrators from browser-stored role or user_metadata.
create policy ifund_help_public_articles on public.ifund_help_articles
 for select to anon,authenticated using (true);
create policy ifund_help_admin_insert on public.ifund_help_articles
 for insert to authenticated with check (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 );
create policy ifund_help_admin_update on public.ifund_help_articles
 for update to authenticated using (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 ) with check (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 );
create policy ifund_help_drafts_admin_read on public.ifund_help_drafts
 for select to authenticated using (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 );
create policy ifund_help_drafts_admin_create on public.ifund_help_drafts
 for insert to authenticated with check (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
  and author_id=(select auth.uid())
 );
create policy ifund_help_drafts_admin_update on public.ifund_help_drafts
 for update to authenticated using (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 ) with check (
  (select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin')
 );

-- Atomic source-equivalent Publish: validate a private draft, create or
-- update a public article without changing existing permanent URLs, link the
-- draft, or rollback all changes on any error. SECURITY INVOKER respects RLS.
create or replace function public.ifund_publish_help_draft(p_draft_id uuid)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare
 d public.ifund_help_drafts%rowtype;
 live public.ifund_help_articles%rowtype;
 published uuid;
begin
 if (select auth.jwt()->'app_metadata'->>'role') not in ('admin','super_admin')
   then raise exception 'Administrator access required' using errcode='42501';
 end if;
 select * into d from public.ifund_help_drafts where id=p_draft_id for update;
 if not found then raise exception 'Help draft not found' using errcode='P0002'; end if;
 if char_length(trim(d.answer))=0 then
   raise exception 'Article text required' using errcode='22023';
 end if;
 if d.article_id is not null then
   select * into live from public.ifund_help_articles where id=d.article_id for update;
   if not found then raise exception 'Linked article missing' using errcode='P0002'; end if;
   if live.slug<>d.slug then
     raise exception 'Published help article URLs cannot be changed' using errcode='22023';
   end if;
   update public.ifund_help_articles
      set category=d.category,question=d.question,description=d.description,
          answer=d.answer,keywords=d.keywords,updated_at=now()
      where id=live.id returning id into published;
 else
   insert into public.ifund_help_articles(slug,category,question,description,answer,keywords)
     values(d.slug,d.category,d.question,d.description,d.answer,d.keywords)
     returning id into published;
 end if;
 update public.ifund_help_drafts set article_id=published,updated_at=now()
   where id=p_draft_id;
 return published;
end;
$$;
revoke execute on function public.ifund_publish_help_draft(uuid) from public,anon;
grant execute on function public.ifund_publish_help_draft(uuid) to authenticated;
commit;
-- No browser service-role privileges; no admin role creation; no fake help
-- data inserted. Existing static Help Center articles must be independently
-- reconciled before publishing duplicate slugs from the database.
