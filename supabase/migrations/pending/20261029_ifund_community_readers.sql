-- STAGED ONLY. Source Community/CommunityMember read-only migration.
-- No user, moderator, join/leave, post, discussion or volunteer writes.
BEGIN;
CREATE TABLE public.ifund_communities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 160),
 description text,
 type text NOT NULL DEFAULT 'interest' CHECK(type IN (
 'neighborhood','city','school','faith','volunteer','business',
 'organization','professional','interest','emergency','other')),
 location text, cover_image_url text,
 public_approved boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ifund_community_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES public.ifund_communities(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner','moderator','member')),
 public_display_name text,
 public_listing_opt_in boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(community_id,user_id)
);
CREATE INDEX ifund_communities_public_idx ON public.ifund_communities(created_at DESC)
 WHERE public_approved=true;
CREATE INDEX ifund_community_membership_group_idx ON public.ifund_community_memberships(community_id);
CREATE INDEX ifund_community_membership_user_idx ON public.ifund_community_memberships(user_id);
ALTER TABLE public.ifund_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ifund_community_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ifund_communities, public.ifund_community_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ifund_communities,public.ifund_community_memberships TO anon,authenticated;
CREATE POLICY ifund_public_communities ON public.ifund_communities
 FOR SELECT TO anon,authenticated USING(public_approved=true);
CREATE POLICY ifund_public_or_self_membership ON public.ifund_community_memberships
 FOR SELECT TO anon,authenticated USING(
   (public_listing_opt_in=true OR user_id=(select auth.uid()))
   AND EXISTS(SELECT 1 FROM public.ifund_communities c WHERE c.id=community_id AND c.public_approved=true)
 );
-- Trustworthy membership totals require a separate, audited aggregate
-- that counts all group members without exposing private user identities.
-- No fake member_count is stored or shown to the public.
COMMIT;
