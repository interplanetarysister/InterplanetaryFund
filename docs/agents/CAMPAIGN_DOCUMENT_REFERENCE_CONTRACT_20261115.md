# Private campaign fundraising documents — source implementation checkpoint

Date: 2026-11-15. Canonical target: `interplanetarysister/InterplanetaryFund`, `apps/web`, existing Supabase project `ssibsfmtodgximseeqsv`. **Source-only** on the existing route-completion branch until the established site-wide acceptance/release gate is satisfied. The read-only Base44 project and APK remain unchanged.

## Owner workflow
1. A user creates or opens a campaign. Uploads require an authenticated, confirmed, active owner with a saved campaign/draft ID. Guest drafts remain browser-only; no sensitive files are uploaded before account verification.
2. **Campaign documents** appears in the creation editor after saving a draft and in each owned campaign's management entry. The same private library holds budgets, reports, outreach plans, research and reference documents.
3. Accept PDF, DOCX, XLSX, TXT, Markdown and CSV, with 8 MB single-file limit and 15 files per campaign. The browser verifies declared type/extension and initial PDF/Office signatures. A header check is preliminary—not malware scanning or full document validation.
4. Every file is stored under a new **private** Supabase Storage bucket, not the existing public cover bucket. Path format `owner_uuid/campaign_uuid/file_uuid.ext`. No public URL, public embed or automatic campaign publication. Documents remain private even when the campaign is published.
5. The owner labels each file's intended use and writes a summary. **Allow my iFund agent team to reference this document** is per-file and **off by default**. The user can change or revoke it; revocation removes the document from future agent-brief RPC reads but cannot retroactively rewrite already generated owner-reviewed drafts.
6. Plain TXT/MD/CSV provide a short bounded extract. PDF, DOCX and XLSX are privately stored, but their contents are **not claimed to have been parsed**. Agents use the owner's own summary until actual extraction is implemented, scanned, and verified. No hidden paid AI/OCR or external data processor is used.
7. Owners can download, update agent reference permissions and remove files. Draft campaign deletion refuses while private files remain so owners can remove them first; privileged account erasure must also invoke Storage API cleanup.

## Storage and database boundaries
- Migration: `supabase/migrations/20261115095000_ifund_campaign_private_documents.sql`.
- New bucket `ifund-campaign-documents`: private, 8 MB, MIME allowlist. Storage RLS checks the current JWT's owner UUID and the verified owned campaign in the path. No public object reads, no unscoped upsert/update.
- Metadata `public.ifund_campaign_documents`: owner/campaign FK; one stable UUID file ID; exact storage path/MIME mapping; size; category; short owner-authored summary; bounded supported plaintext extract; `allow_agent_use`. RLS SELECT/INSERT/limited UPDATE/DELETE require verified active owner. Per-campaign insert trigger serializes operations and caps records at 15.
- Supabase SQL RPC `ifund_campaign_agent_document_briefs(p_campaign_id)` is security invoker and uses existing owner RLS. Only documents with `allow_agent_use=true` appear; summaries and allowed text excerpts carry explicit user-provided, not verified, provenance. A user token in this backend does not authorize external publication.
- Client API `apps/web/src/api/campaignDocuments.js` re-verifies the authenticated owner, account lifecycle and campaign identity; validates file type/size, uploads with `upsert:false`, writes metadata, checks the receipt, and attempts object cleanup if metadata insertion fails. If cleanup fails, the user receives a clear exception rather than false success.
- Owner-facing creation and management UI: `CampaignDocuments.jsx`. Private reference read/selection UI: `AgentDocumentReferences.jsx`. Current uses: Story generation (server flag `IFUND_CAMPAIGN_DOCUMENTS_ENABLED=enabled`), ECHO local communications drafts, PULSE private outreach worksheets, POLARIS strategy notes and ORBIT finance reference review. ECHO/PULSE only insert details into editable drafts after an explicit click; no sending, provider application, or financial change occurs.
- The campaign creation preview endpoint now accepts a saved campaign ID and forwards it to the existing owner-scoped Story Agent service. Before saving, requests have no document context.
- Document text in model prompts is untrusted data, not instructions. The Story path applies credential-pattern redaction and a strict context byte budget; no uploaded file can override permissions or authorize social posts.

## Security, usability and release acceptance
1. Run `apps/web/tests/campaign-documents.test.js`, `tests/campaign-documents-db.test.js`, plus existing Story and campaign-owner tests. Confirm all file formats, 8MB and 15-file limits, path tampering rejection, other-owner/anonymous reads and inserts denied, owner revocation, invalid signature rejection, failed upload/metadata rollback, campaign deletion guard and account-switch clearing.
2. Check native Storage **download and delete** receipts with two separate verified test identities. Files must never be publicly readable. If production bucket names conflict, stop and reconcile; do not mutate the cover bucket.
3. Test campaign creation before and after saving, reopening a private draft, managing a published campaign, deleting the final document, followed by draft deletion. Verify PDF/DOCX/XLSX are not falsely reported as extracted.
4. Verify uploaded brief is used by Story only after owner opt-in, document permission revocation removes it from new prompts, and no agent quote treats the user's summary as a provider-verified receipt or verified evidence.
5. Account erasure must remove private Storage objects as well as DB metadata; review existing erasure paths before deployment. Keep secrets and third-party personal data outside agent summary fields. Do not assume file scanning or license clearance.
6. **No preview or production build, database schema application, or worker activation is included by these commits**. Keep existing release gate and use preview first once full route acceptance is independently certified.

## Source verification
- Targeted API source assertions (PDF accepted, disguised type rejected, PDF signature checked, valid owner path, private bucket, verified owner upload and per-document opt-in) passed **8/8** in an isolated mocked execution.
- SQL delimiter and source policy checks completed: 4 function openings/closings, four owner metadata policies, three private object policies. The full PostgreSQL/PGlite tests, deployed Storage API, real upload/download with separate users, bundle build and all-route release gate **remain unverified**.
