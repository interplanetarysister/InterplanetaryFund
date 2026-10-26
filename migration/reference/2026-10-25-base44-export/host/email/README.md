# Interplanetary Fund — inbound email routing

## Current state
Code staged and Cloudflare Email Worker deployed. **Not live yet.**
Cloudflare domain remains pending Wix nameserver switch, and the current
remote Base44 function is an earlier deployed revision.

## Delivery flow
Cloudflare catch-all for all valid `*@interplanetaryfund.com` recipients
→ `ifund-email-ingress` dedicated Email Worker
→ verified owner forwarding destination `cuddlemeplatonically@gmail.com`
→ ECDSA P-256 signed HTTPS mirror to independent Supabase
`ifund-admin-mail-ingest` → private `admin_inbound_email` storage
→ Supabase-authenticated organizational mailbox in IFund Notifications.
Verification aliases retain a separate receiver. Paid member addresses use
`@mail.interplanetaryfund.com` and a separately signed member ingress.

Gmail forwarding is a fail-safe; the Worker attempts IFund mirroring even when
the forwarded email already succeeded. The signed mirror uses a **private key
stored only in Cloudflare Worker secrets** and a **public key** pinned in the
Supabase receiver's source code. No Base44 secret-management access is needed.

## Priority mailbox categories

Priority: `contact`, `support`, `admin`, `ifund`, `campaigns`, `help`,
`developer`, `partner`, `crowdfund` under `@interplanetaryfund.com`.

All other valid recipient local parts receive normal priority.
IFund's `InboxItem.mailbox_priority` and `recipient_address` are stored,
and the inbox displays Priority and the actual To address. These are not
nine separate mailbox accounts.

## Verified preparation
- Dedicated `ifund-email-ingress` Worker exists in Cloudflare.
- Cloudflare has encrypted `IFUND_EMAIL_SIGNING_PRIVATE_KEY`,
  `IFUND_EMAIL_RECEIVER_URL`, and `IFUND_MEMBER_EMAIL_RECEIVER_URL` bindings.
- `IFUND_ADMIN_EMAIL_RECEIVER_URL` is a public HTTPS binding for the independent
  organization receiver. The original secret URL remains for verification.
- Recipient destination `cuddlemeplatonically@gmail.com` is verified
  in Cloudflare Email Routing.
- Local compiled Worker in-memory signed-delivery and forwarding simulation
  passed. This is **not** evidence of external SMTP receipt.
- Cloudflare catch-all rule points to the Worker but is disabled.
- Cloudflare Email Routing activation returned `Active zone required`.
- Wix still serves authoritative DNS; Cloudflare zone status `pending`.
- The deployed Base44 `receiveCloudflareEmail` function returned 503
  `Email intake not configured` when probed, demonstrating that Base44's
  **older** HMAC/secret-based version is still deployed. The new public-key
  verifier is committed and checkpointed but must be deployed.
- Base44 CLI function deployment requested interactive device authentication.
  Do not interpret a saved checkpoint as proof of published backend updates.

## Required activation

1. Confirm `ifund-email-ingress` deploy contains the root-domain organization
   classifier, separate member subdomain and isolated verification rule.
   Check `IFUND_ADMIN_EMAIL_RECEIVER_URL` points at the Supabase
   `ifund-admin-mail-ingest` endpoint while existing signing and
   verification secrets remain bound. Never inspect or print secret values.
2. Verify the Supabase administrator account by Auth user ID, then confirm its
   `ifund_admin_mail_access` allowlist membership and mail tables' RLS.
   Test the standalone `/admin/organization-mail` route with a real authenticated
   administrator, including list, read/unread, audit, sign-out and denied users.
3. Test bad signatures and expired timestamps on both signed ingestion paths:
   both must reject with 401. Test an authorized signed synthetic message,
   persistence and deduplication without sending real email to users.
   Verification aliases must not enter organization or paid-member storage.
4. Independently publish and verify the website build at
   `interplanetaryfund.com` and its Cloudflare preview; verify Capacitor web
   assets and Android authentication/CORS parity. Keep Base44 operational.
5. Only after signed delivery, tenant isolation and web/APK checks pass, inventory
   existing DNS and mail records. Change Wix **registrar nameservers** (not
   DNS NS records) to `angelina.ns.cloudflare.com` and `ed.ns.cloudflare.com`;
   confirm rollback and MX/SPF/DKIM before changing delegation.
6. Wait for Cloudflare zone Active; only then enable Email Routing and the
   Worker catch-all. Send separate external messages to a priority root alias,
   an arbitrary root alias, a verification alias and an authorized member
   subdomain mailbox; verify destinations, signed persistence, privacy, Gmail
   forwarding and audit. Roll back Email Routing immediately on any failure.
7. Do not cancel Base44 or replace the final Android package until independent
   website, authentication, database, server functions and agent functions pass
   migration parity and a separate full release gate.

## Known limitations

- This is inbound plain-text mirroring, not an SMTP/IMAP mailbox.
- Email HTML and attachments are retained by the forwarding Gmail destination,
  but are not stored in Base44.
- Mirroring failures are logged and do not block forwarding.
- Email catch-all addresses are vulnerable to guessing/spam; use rate controls
  and filtering before marketing these addresses.
- The platform's existing notification/social inbox must not be disabled
  and DNS changes must preserve the apex A and www CNAME website records.

## Private verification aliases (staged)
The VerificationMailbox and VerificationMail tables support per-user encrypted account-verification messages. Random verify- aliases cannot be delivered until activated following deployment and end-to-end testing. A verification email must never be forwarded to the organization admin mailbox or exposed to the general agent inbox. Set IFUND_VERIFICATION_EMAIL_KEY as a random base64 32-byte AES key in Base44 secrets. No DNS migration or activation is included in this code change.
