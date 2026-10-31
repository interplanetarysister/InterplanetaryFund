# Reporter blog migration

Status: merged to `main` in commit `d3b4a7975ee0e62000a630d7c347fbbbd0690bfe`. Cloudflare production deployment and runtime verification are pending. The original Base44 publication remains intact until cutover checks pass.

## Source identity

- Base44 app: `6a67a778342a8fe05ee79cba`
- Blog ID: `6ac9c315a7434f25c88834b5`
- Publication: The Interplanetary Fund Reporter
- Legacy owner ID: `6a6d1657d8d9878096a21f63`
- Owner email match: confirmed against the original Base44 User record and a confirmed Supabase Auth email.
- Supabase Auth owner UUID: `387e9270-b68d-46cb-ae4e-ba89f4a74bf7`

The legacy owner ID and each entry's original `created_by_id` are retained independently. Entries created by the Base44 service identity remain attributed to that service ID; they are not rewritten as human-authored.

## Imported records

- 1 publication
- 32 entries total
- 21 published entries
- 11 drafts
- 0 empty article bodies
- Original blog and article IDs preserved as text primary keys.
- Original title, summary, body, type, featured flag, status, publication timestamp, created/updated timestamps, and Base44 system created/updated dates retained.
- Re-runnable import uses ID-based upserts and does not create duplicate entries.
- Source Base44 records were not modified or deleted.

The source app does not define a `BlogComment` entity, so no comments table or fabricated comments were created.

## Destination access

Project: `ssibsfmtodgximseeqsv` (`InterplanetaryFund`).

Tables: `public.ifund_blogs`, `public.ifund_blog_entries`. RLS is enabled. Anonymous readers can see only active publication metadata and published entries. The authenticated owner can manage the publication and its entries using the explicitly matched Supabase Auth identity. Drafts are not public. A second migration separates SELECT/UPDATE/DELETE policies and adds the missing foreign-key indexes.

No Base44 password hash, OAuth grant, or session was migrated. The owner signs in using the destination's existing verified Supabase Auth account.

## Application

Merged routes and capabilities:
- Public Reporter index at `/blogs`
- Published article route at `/blogs/:id`
- Owner-only Reporter Studio at `/my-blog`
- Draft saving and publishing through owner-scoped Supabase RLS
- Route regression coverage

## Verification status

- Node 22.23.2 / npm 10.9.8 CI: passed.
- Test suite: 79 passed, 0 failed.
- Vite production bundle: built successfully.
- Cloudflare Pages production deploy: pending.
- Browser verification of public routes and owner sign-in/editor/publishing: pending.
- Verify `interplanetaryfund.com` routing after release.
- Keep the original Base44 publication intact until runtime and owner publishing checks pass.
