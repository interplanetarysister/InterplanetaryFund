# Campaign creator preview status — 2026-11-10

Canonical UI: apps/web/src/pages/CreateCampaign.jsx, four Base44-style stages.
Independent Cloudflare Story Agent text drafting retained; no Base44 client calls.
Campaign persistence: public.ifund_campaigns with owner RLS. Private extended
creation settings: public.ifund_campaign_creation_state, owner-scoped RLS and
FK to campaign; migration applied to Supabase ssibsfmtodgximseeqsv.

Media: authenticated JPEG/PNG/WEBP/GIF uploads (5 MB max) to existing Cloudflare
R2 bucket ifund-media, accessible from Pages Functions via preview-only binding
IFUND_CAMPAIGN_MEDIA. Server checks Supabase Auth, account active, magic bytes,
and saved R2 size before success; production binding remains absent.
New preview images are kept under preview/campaigns/ and their URLs are preview
URLs; these must be made stable before production rollout.

Acceptance gates: Cloudflare Pages preview build/tests and deploy on exact branch
head, anonymous and signed-in mobile browser walkthrough, account-change tests,
real R2 image roundtrip, cross-owner RLS negative case, persisted metadata and
story revisions, independent AI art generation, source media copy, the remaining
Base44 functions/workflows/triggers and production-domain parity. Never claim
completion merely because tests compile. TinyFish and credit purchases prohibited.
No live payment, DNS, or Base44 retirement change in this increment.
