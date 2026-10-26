# IFund Admin Inbox — Verified Completion Plan
**Snapshot:** 2026-10-11, Base44 authoritative app `6a67a778342a8fe05ee79cba` (main).  
**Scope:** The actual `/inbox` AdminApprovalQueue, associated PlatformOwnedAccount, PlatformConnection, AgentDelegation, SupportTicket, Notification, DistributedPost, and financial records. This is an implementation plan **not an approval or permission to transact**.

## Evidence and limitations
- **AdminApproval: 18 total** — 9 pending, 7 approved, 2 investigating, **zero executed**.
- **AgentDelegation: 19** — 13 waiting_external, 5 waiting_user, 1 requested. Repeated provider repair requests: Bluesky 5, GiveSendGo 4, GoFundMe 4.
- **SupportTicket: 1 open** — `6ac83e8328ee15244d096944`, subject `Platform connections`; customer reports connections not working.
- **InboxItem: 0.** The universal communications feed is not the admin approval queue.
- **PlatformConnection: 30** — 23 error, 6 connected, 1 disconnected. A `connected` or `verified` stored state can mean a reachable public link rather than authenticated permission to publish. At least some records have no current provider-backed capability proof.
- **PlatformOwnedAccount: 9** — 3 `planned`, 6 `setup_in_progress`; zero with a recorded external `profile_url` or `connection_id`. Approval alone never means an external account exists.
- **DistributedPost: 191** — 7 `published`, 48 `approved`, 122 `pending_approval`, 14 `draft`. Seven Bluesky public AT Protocol records were independently reachable on 2026-10-11; all seven stored published posts are Bluesky. The 48 approved posts have no published_at/external_post_url.
- **Notification: 71** — 54 unread. 17 scheduled-post notices; integration failure/reauthorization alerts repeated three times for many providers. `[stripe]`, `[convex]` old alerts may be obsolete; never use old notifications to assert *current* provider health.
- **Donation: 0, FinancialOperation: 0, HoldingLedgerEntry: 0, WebhookEvent: 0, Withdrawal: 0.** One PayPalBillingWebhook record exists (subscription billing is not donation accounting). This does NOT prove PayPal lacks the earlier test payments; only IFund canonical accounting lacks corresponding evidence in queried entities.
- **Release:** Public homepage HTTP 200, but its entry script `assets/index-D6pLO_so.js` differs from the local validated build `assets/index-BSO6pFsL.js` at audit. Base44 publishing credentials require separate authentication.
- **No modifications to the 18 approval decisions or payment records during this audit.** Resolutions must retain evidence, prior notes, and user intent.

## Priority 0: Launch-stopping correctness and accounting

### P0.1 Restore real PayPal-to-IFund financial reconciliation
**Owner/implementation:** Finance + backend, preserve the existing official IFund PayPal business account; no Stripe reintroduction or charges.

1. Verify the IFund **business** PayPal receiving account, API scope, sandbox/live setting and verified webhook subscriptions. Do not treat a PayPal billing/subscription event as a campaign donation.
2. Use existing server tools/functions: `listUntrackedPayPalReceipts`, `reconcileDirectPayPalCampaignDonation`, `capturePayPalOrder`, `recordDonation`, `getCampaignDonations`, and the canonical financial operation/holding ledger paths. Inspect exact transaction IDs **server-side**, never copy secrets or create speculative payments.
3. Match earlier real PayPal receipts to IFund campaigns **only when provider transaction, payment status, amount, receiver, and canonical campaign identity are proven**. Route ambiguous receipts to explicit admin review.
4. Enforce idempotency across webhook receipt, manual repair, retry, and PayPal subscription lifecycle. Ensure a successful donation updates campaign raised_amount/donor count **exactly once**, and reversal/refund updates totals correctly. Avoid charging anyone to test.
5. Integration tests: captured provider event -> verified financial operation -> one Donation -> one balanced ledger effect -> accurate campaign totals -> withdrawal eligibility. Compare read-only PayPal business report against IFund.
**Done only with:** authoritative provider transaction evidence and consistent canonical IFund records, including the two previously reported donations if those are confirmed.

### P0.2 Fix admin approval queue state machine
**Files:** `src/components/admin/AdminApprovalQueue.jsx`, `base44/entities/AdminApproval.jsonc`, server-authoritative admin actions, `AdminActionMessage`, `AuditLog`.

- Current bug: `items.filter(i=>!['executed','cancelled'].includes(i.status))` keeps `approved` **and `denied`** in the actionable queue. The client creates PlatformOwnedAccount `setup_in_progress` records and can mark actions approved without independent execution proof; publication attempts can catch-and-suppress provider errors.
- Split **Awaiting admin decision**: pending / needs_information / investigating; **Approved, awaiting execution**: approved; **Completed with proof**: executed; **Declined/cancelled**: denied/cancelled. Avoid calling approved items resolved or automatically re-approvable.
- Move sensitive transitions to authenticated admin server functions; enforce idempotency, expected prior status, existing target ownership and audit log. Never grant account ownership or publish content merely by client-side status update.
- For `publish_platform_weekly_update`, return provider post ID/URL and verified result; if the provider does not support writing, keep `manual_required` instead of swallowing errors.
- Handle network/role failures with readable errors, retry and filtering. Preserve previous notes and historical approvals. Add server tests for duplicate taps, unauthorized user, stale task, unverified publish, and approved->executed.
**Done only with:** queue shows each item in correct stage; approved is not confused with executed; no silent provider action failures.

### P0.3 Publish validated build and verify live
- Authenticate Base44 publisher through its supported account/device flow; no use of GitHub Actions minutes. Use Node 22.
- Run `npm run build`, typecheck, lint, staging integration tests, full `IFUND_VALIDATE_ONLY=1 bash scripts/publish-ifund-safe.sh`. Publish only after the gate succeeds.
- Compare live JS/release marker with the source build and smoke-test public routes, authenticated inbox, admin-only queue, campaign donation confirmation, and mobile scrolling/keyboard.
**Done only with:** live release marker matches local source and live tests pass. A local build/checkpoint is not a live deployment.

## Priority 1: Repair external accounts and publishing routes

### P1.1 Verify 3 new official social presences, in this order
| Inbox approval | Target entity | Requirement |
|---|---|---|
| `6ac9e2fbba2a8e64d01f6fdf` FB Business access (pending) | `6ac9bbadeaa6a00f561f7ab7` | Confirm actual provider business/Page identity, owner role and permitted Page write scope; record official URL and verified connection. |
| `6ac9e2fb743bfa7a8491869e` Instagram access (pending) | `6ac9bbadeaa6a00f561f7ab6` | Confirm creator/business identity and permitted Instagram publishing scope; record official profile URL and test permitted publish. |
| `6ac9e2fb2041b46868302bf0` FB Community group (pending) | `6ac9bbadeaa6a00f561f7ab5` | Confirm group owner and URL; distinguish group ownership from official API group-post rights; manual handoff where API permission unavailable. |

Existing 9 PlatformOwnedAccount records have no real account URL/connection ID. Reconcile duplicates (FB `6ac1337594f364ed6dc0bcc2` vs business/group records); never create extra accounts before confirming whether one already exists.

### P1.2 Resolve other 13 older account/finance approval tasks
| Approval ID | Task | Inbox state | Action and completion evidence |
|---|---|---|---|
| `6ab453bf2d3d83ecfd3af553` | Discord account | pending | Check existing official account; provider signup/login via authorized route, verify URL and permissions. |
| `6ab453be4499f20444956053` | YouTube account | pending | Check existing channel/brand account; verify ownership and video upload consent/permissions before publishing. |
| `6ab453be14b44ba0ad78d8df` | Pinterest account | pending | Verify business account and approved publishing access. |
| `6ab453beeb788e03f46a9545` | TikTok account | pending | Verify existing account and permitted video-posting API before automation. |
| `6ab453bebec817734e4db8d5` | X account | pending | Validate existing account, API pricing and write permissions; no unapproved charges. |
| `6ab453beda3720b9a62b5e94` | Instagram account | pending | Merge investigation with current priority Instagram business task; do not duplicate account. |
| `6ab453bf5eaa834a7a2f3047` | Mastodon account | investigating | User noted existing IFund account; check original URL/instance and ownership; do not create another without evidence. |
| `6ab453bf5794061be4982564` | Bluesky account | approved | Reuse verified public account; refresh current owner app-password authorization, write test, then mark executed with URL if proved. |
| `6ab453bece9456a1f190a06e` | Reddit account | approved | Approval is not creation. Verify real profile/account ownership and platform-approved posting route. |
| `6ab453be47a9429823365005` | LinkedIn account | approved | Verify owner OAuth and member/page permissions. Separate official brand presence from personal account and test a post. |
| `6ab453be0bf05fa08e9ebb60` | Threads account | approved | Linked connection alone lacks provider-backed write proof; verify write ability and external post URL. |
| `6ab453beaad1c7a707c71e76` | Facebook account | approved | Reconcile with FB Business/Page + group; confirm actual URL/permissions, avoid duplicate accounts. |
| `6ac76bb4345bcb52c358eec1` | Reown wallet project | approved | Keep as a separate crypto wallet compatibility investigation; do not activate crypto settlement without wallet/network/provider and transaction reconciliation tests. |

**Identity gate:** Refresh all approval target IDs before any task mutation. LinkedIn, X and Threads have distinct records; never assume neighboring records refer to the same platform.

### P1.3 Do not resurrect retired Stripe tasks
- `6ac76bb4345bcb52c358eebf` **Enable Stripe crypto acceptance** — approved.
- `6ac76bb4345bcb52c358eec0` **Verify Stripe donation webhook** — investigating.
- Per current platform policy, Stripe is not the desired IFund provider. Before modifying or closing these, verify the current business decision, then archive/cancel them with `superseded_by_paypal` reason and audit preservation. No charge, no new Stripe account/webhook. Preserve Reown wallet-neutral design for separate validation; do not count an approved obsolete task as work that should execute.
- Prioritize existing PayPal business payment rails and verified multi-chain crypto donation receiver, not an unrelated Stripe setup.

### P1.4 Resolve provider connection health and duplicate delegations
- Of 30 PlatformConnection records, 23 error, 6 connected, 1 disconnected; do not equate `connected` with publishable. For each provider record independently verify owner, official URL/profile, connection transport, OAuth scopes, provider read/write response, permission expiry, and resulting status.
- Consolidate 5 repeated Bluesky repair delegations (`waiting_user`), 4 GiveSendGo repairs and 4 GoFundMe repairs (`waiting_external`) **by provider + owner + campaign**. Keep one lead request and mark others superseded with cross-references and consent version intact after explicit reconciliation. Maintain pending Instagram/Gumroad/Discord/Reddit account creation and master 'connect all' task without claiming unsupported routes.
- Reuse Bluesky verified profile and its seven real posts as provider evidence, but resolve the newer errored `6ab87ab1108fa0439db62513` connection separately. Never copy credentials between owners/campaigns.
- For GoFundMe/Kickstarter/Indiegogo, distinguish import/public monitoring, draft posting, **creation of external fundraiser**, and direct API write. Unsupported writes must remain manual or partner-only; do not falsely mark completed.
- At least one actual public post or verified provider write must be recorded with provider URL/ID before a destination is marked `direct_publish_verified`.

### P1.5 Clear the 191-item distribution queue by proof, not bulk publishing
- Current: 7 provider-verified published Bluesky posts, 48 approved without publication URL, 122 pending approval, 14 drafts.
- Provide a review grid grouped by owner/campaign/provider/date/destination, detect stale and duplicate content, allow explicit `manual_required` copy/open flow for unsupported destinations, and protect the selected donation destination.
- Never auto-send aged posts from the backlog merely because a historical approved status exists. Get a fresh owner decision for public posting, avoid reposting duplicate campaigns and keep separate verified vs manual publishing receipts.
- Test Bluesky, then LinkedIn OAuth/permissions, then the other legitimately supported platform connectors one at a time.

## Priority 2: Clean and close the inbox

### P2.1 Reduce duplicate notifications without hiding real issues
- 54 unread Notification rows, including 17 `Scheduled post is ready` and triplicated provider disconnection notices (`wix`, `discord`, `linkedin`, `paypal`, `kofi`, `email`, etc.).
- Fix generation idempotency/dedupe by provider+state+event+observation window; represent fresh ongoing incidents once with last-confirmed status and timestamp.
- Distinguish historic alerts from current provider health; do not automatically clear evidence. Archive obsolete Convex/Stripe notices only if confirmed no longer part of IFund.
- Add a bulk **acknowledge/read** action restricted to the owner and keep alert/audit provenance.

### P2.2 Close the open user support ticket only after proof
- `6ac83e8328ee15244d096944`: 'Platform connections' (open).
- Tie to the P1 provider repair matrix. Report per-platform limitations and verified working functions plainly; retest as non-admin mobile user.
- Only close once the specific user-observed issue is resolved or an accurate supported/manual route is provided and validated.

### P2.3 Make backlog visible and actionably prioritized
- Show **Decisions needed**, **Approved awaiting execution**, **Investigating**, **Waiting on provider/user**, **Completed with proof**, and **History**, not a single undifferentiated count.
- Expose source evidence, provider health, last attempt time, assigned agent, blocker and exact recovery route. Avoid any 'Connected = working' or 'Approved = sent' shortcuts.
- First screen should show donation reconciliation + top-priority verified publishing failures, not low-value repeated notifications.
- Add read-only reconciliation between AdminApproval, AgentDelegation, PlatformOwnedAccount and PlatformConnection. Do not materialize false success or require admins to repeatedly reapprove the same pending request.

## Execution order and gates
1. **Freeze release evidence**: snapshot task IDs, provider URLs, donation/financial counts and current published artifact; protect production transactions.
2. **Financial correctness + admin approval state machine (P0)**. Test no-charge PayPal receipt observation and full server-side transition invariants.
3. **Deploy only through an authorized Base44 publishing session and verify live bundle**, then run non-admin user smoke tests.
4. **Repair official Facebook Business/Instagram and proven Bluesky route**, then branch into other legitimate provider write capabilities (no unauthorized account creation).
5. **Consolidate account/delegation duplicates; resolve 16 account/crypto inbox requests**, keeping task-level authorization.
6. **Triage 191 publishing records; bring real receipt coverage to each enabled platform**; never bulk-send obsolete material.
7. **Dedupe notifications, complete ticket, and mark executed only with provider-backed evidence.** Retire superseded Stripe records under an audited policy decision.

**Release criteria:** no unverified accounting claims, no false provider publishing success, all open AdminApproval requests have an evidence-backed owner/action/blocker, all approved requests either executed with proof or explicitly waiting, 0 unsafe automated retries, mobile/web admin inbox usable, live build matches validated source. External approvals may remain explicitly `waiting_external` rather than being fabricated as completed.
