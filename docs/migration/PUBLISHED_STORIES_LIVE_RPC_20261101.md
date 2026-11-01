# Independent published editorial migration — 2026-11-01

**Canonical source:** `interplanetarysister/interplanetary-fund2/main` and the retained styled views on the existing draft `migration/build-completeness-gates-20261029`; no new design concept has been introduced.

**Live database:** Supabase `ssibsfmtodgximseeqsv`. Verified `public.ifund_blog_entries` and `public.ifund_blogs` have **text** legacy IDs, not UUIDs. The draft branch incorrectly queries nonexistent `ifund_user_blogs`. The corrected code uses the already-deployed `public.ifund_public_blog_entries_read(p_author_ref text,p_blog_id text,p_entry_id text,p_limit integer)` SECURITY DEFINER read RPC, which only returns published entries belonging to active blogs. The function explicitly projects public article fields and public parent blog fields. Anonymous EXECUTE permission was checked. A direct count returned **21** public entries at the audit checkpoint; this is not a pledge about future record counts.

**Recreated UI:** `/blogs` with IFund Reporter and member story sections; `/blogs/:id` with article and sanitized campaign embeds; `/publications/:id` with finalized-only document viewing. The original React layout and typographic class patterns are retained. This is a read-only restoration. Draft authoring, subscription gates and publication approval are intentionally not enabled, and no unpublished data is exposed.

**Privacy and identity differences:** Original Base44 member owner IDs do not yet all map to verified Supabase users. The public RPC deliberately omits owner/user PII and author profile joins; the independent Article page therefore does not create a nonfunctional author-profile link. Preserve original IDs and mappings until separately verified.

**Release gates remaining:** CI root/web tests and bundle; browser visual parity at desktop/mobile/Android; authenticated user/editor roles; actual external PDF open; campaign embedded cards and media; complete original route acceptance. No Cloudflare DNS change and no payment or mail migration in this change. All old history, source records and Base44 platform remain intact.
