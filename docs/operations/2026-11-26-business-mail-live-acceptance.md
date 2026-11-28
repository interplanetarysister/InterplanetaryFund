# Business mail transport acceptance — 2026-11-26

Cloudflare domain interplanetaryfund.com is active, Email Routing ready/synced, three provider MX records match the routing DNS configuration. Explicit user@ rule and catch-all remain enabled on ifund-email-ingress. Both backup destinations verified. No DNS or routing-rule change needed.

Prior three failed synthetic support messages recovered at 13:35:04–13:35:08 UTC, verified as three actual Supabase admin_inbound_email rows. Fresh synthetic support@ and user@ messages sent at ~13:46 UTC, persisted at 13:46:06.541608 and 13:46:08.765243 UTC respectively. Both R2 receipts report state=persisted, backup_forwarded=true, no recovered marker. Five total inbox rows. Five-minute recovery cron remains configured. No new code or DNS mutation required for transport in this pass.

Important separate UI gap: current main Inbox.jsx does not include AdminBusinessMailbox; repair branch does. Production Pages deployment 2cbe0ee1-2a8a-4c42-b0af-4e0c621fa9c0 still uses b5aaadb7e0d9ad5a5a26707f27152fe24d0cf242. Only one explicit admin mailbox grant exists; do not claim every administrator can see the inbox. Preserve restricted mailbox permissions and deliver the reviewed UI through normal prebuild validation. Actual authenticated UI acceptance not completed. Optional paid email billing remains separate and is not attested by these tests.
