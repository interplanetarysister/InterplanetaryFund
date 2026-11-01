# Founding Members waitlist

## For visitors
1. Open https://interplanetaryfund.com/founding-members.
2. Enter your email. Your screen name is optional.
3. Pick whether you want to support, fundraise, or both.
4. Decide separately whether to receive optional marketing announcements.
5. Accept the signup privacy notice, then press **Join the founding community**.
6. If a sharing link appears, you can send it to friends. It gives no guaranteed rank or reward.
7. The waitlist is free. It does not create an account or enable fundraising.

For questions about your data or removal, use the site's Contact page. Privacy notices must reflect actual data retention and deletion procedures.

## For IFund administrators
1. Sign in with an administrator account.
2. Open **Administration → Founding Members** (or /admin/founding-members).
3. Search and filter the queue. Only the first 500 records are loaded per view.
4. Change status to waiting, invited, or approved when appropriate. These are tracking labels only.
5. This admin view does **not** send email or change account privileges. Do not describe a member as invited before sending a separate legitimate invitation.
6. Do not publish identifiable waitlist records, expose referral tokens, or claim that a position guarantees access.

## Go-live verification
- Build the current main branch and deploy it to the actual production host.
- Verify GET /founding-members serves the current SPA build, not an old asset.
- Test signup with an authorized test mailbox; confirm a private FoundingWaitlist row is created.
- Retry the same email: it must not create another row or reveal the original referral code.
- Check the public page, light/dark contrast, narrow mobile layout, admin-only queue, and status update.
- Confirm no live-email invitations are represented as sent until an email provider has sent and recorded them.
- Confirm the public/privacy policies state how prospective member information is processed.
