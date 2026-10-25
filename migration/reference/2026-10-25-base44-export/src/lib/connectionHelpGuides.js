// Reviewed alongside the actual connection, vault, and verification-mail
// workflows. These guides are bundled so they appear even before an admin
// creates a database HelpArticle. Keep language simple and steps concrete.
const reviewed = "2026-10-16";
const entries = [
  {
    slug: "connect-another-platform", category: "Connections & Publishing",
    question: "How do I connect another app?", description: "Pick an app, sign in, and check if it works.",
    answer: `1. Open Connections.
2. Find the app you want and tap its picture or name.
3. To use AI, make sure the big IFund AI switch is on. Then switch AI on for this app.
4. Choose what AI can do. Full supported access is the usual choice.
5. Tap Connect to sign in on the app's own page. Your phone may offer a saved password. Some apps ask you to say Yes to sharing access.
6. If the app does not have a sign-in button here, follow the steps in its connection window. You may need to paste your public page link or use a special app token.
7. If you change an already-linked fundraiser's page address, currency, or connection details, IFund may need to clear the old amount and donor count.
8. If the numbers shown still belong to the NEW connection, check the confirmation box before saving. If you cannot confirm them, do not keep the old numbers; IFund clears them until you enter or verify new amounts.
9. Come back to IFund. Tap Check connection. Only a verified connection says it is working.

You can link a page without letting AI use the account. Saving a password does not mean an account is connected. If you are stuck, use IFund connection help. If saving fails, IFund shows a short error and asks you to try again. Your connection is not marked as working without proof.
Updated: ${reviewed}.`,
    keywords: ["connect","platform","account","provider","sign in","oauth"]
  },
  {
    slug: "ai-platform-permissions", category: "AI Assistance",
    question: "What can IFund AI do with my connected accounts?", description: "One big AI switch, and one switch for each app.",
    answer: `IFund has ONE big AI help switch for your IFund account. It turns IFund-wide AI help on or off.

Each outside app also has ONE AI switch. You choose On or Off for that app. A saved password does not turn the switch on.

When you first connect an app, pick how much help you want:
• Full supported access: IFund AI may help with posting, sharing, comments, replies, messages, photos, videos, streams, groups, pages, events, auctions, campaign updates, donation records and connection care, where the app allows it.
• Posts and outreach: IFund AI may help share posts, pictures, comments and campaign updates.
• Read and help me plan: IFund AI may look at supported information and offer ideas, but will not post.

The outside app still decides which actions it allows. Your choice never unlocks a feature the app does not offer. The AI cannot move money, make payouts, buy things, or skip security checks using this switch.

You do not need to say Yes again for each normal action inside your chosen scope, although a provider may ask you to sign in, confirm its permissions or finish a safety step. Actions that move money still need their own approval.

To turn AI OFF for one app: Connections → Your platforms → find the app → tap its AI switch to Off. You do not need to disconnect.
To change the type of AI help: disconnect the app, connect it again, and choose the new scope.
Updated: ${reviewed}.`,
    keywords: ["ai","permissions","scope","allow","one switch","posting"]
  },
  {
    slug: "change-connection-permissions", category: "Connections & Publishing",
    question: "How do I change what AI is allowed to do?", description: "Turn AI off any time. Reconnect for a different scope.",
    answer: `To STOP AI for one app:
1. Open Connections.
2. Find the app in Your platforms.
3. Tap its AI switch until it says Off.
4. Your app stays linked, but IFund AI stops using it.

To change the KIND of AI help:
1. Find the same app.
2. Tap Disconnect. This ends IFund's connection to that app.
3. Find the app again in Explore connections.
4. Choose Full supported access, Posts and outreach, or Read and help me plan.
5. Turn on that app's AI switch if you want AI help.
6. Sign in on the app's own page again.
7. Return to IFund and check that the connection works.

The big IFund AI switch must also be On. Each app still has its own rules.
Updated: ${reviewed}.`,
    keywords: ["change scope","disconnect","reconnect","revoke","turn off"]
  },
  {
    slug: "save-platform-password", category: "Account & Security",
    question: "How do I save or use a password?", description: "Use your phone password manager, or the private IFund vault.",
    answer: `1. Open Connections and choose an app.
2. Try the Connect button first. Your phone may offer a saved password from Google Password Manager or another password manager.
3. If you do not have a saved password, use Private IFund password vault.
4. Type the app username and password.
5. Make a long vault passphrase you can remember. Do not give it to anyone.
6. Tap Encrypt and save.
7. To see the saved password later, type your vault passphrase and tap Unlock. Tap Show password only when you are somewhere private.
8. When you finish, tap Lock now.

IFund encrypts this password before it is sent to storage. AI agents cannot open the vault and cannot see your passphrase. If you lose the passphrase, IFund cannot recover it.

A vault entry is not a live account connection. Use the provider's sign-in or special app token to give IFund approved access. If the passphrase is too short or wrong, IFund tells you. If saving fails, try again without sharing your password.
Updated: ${reviewed}.`,
    keywords: ["password","vault","google password manager","autofill"]
  },
  {
    slug: "receive-verification-email", category: "Account & Security",
    question: "Where do my sign-up codes and verification emails go?", description: "Your private verification inbox, when email routing is ready.",
    answer: `1. Open your IFund Inbox or the Connections window for the app.
2. Find Private verification mail.
3. Tap Prepare a verification email address.
4. If IFund says the address is not ready, STOP. Do not use it to sign up yet.
5. When IFund says Ready to receive email, copy the address.
6. Use it to sign up for the outside app, if that app accepts the address.
7. Return to Private verification mail and tap Check new mail.
8. Tap Reveal verification email to read your code or link.
9. Use the code on the real app's sign-in page. Hide the message when done.

The mail can be read only by your IFund account. IFund's AI agents cannot read verification messages. Codes do not go to the admin inbox. Administrators may open the independent organization mailbox from IFund Notifications or /admin/organization-mail and sign in with their verified Supabase administrator credentials. IFund organization addresses ending in @interplanetaryfund.com are separate from eligible member mailboxes ending in @mail.interplanetaryfund.com. Verification codes stay isolated from both. Email routing is not live until the service and DNS are tested. If a message will not open or an address cannot be made, try again later. Do not share your code with anyone.
Updated: ${reviewed}.`,
    keywords: ["verification","2fa","two factor","email","signup","sign-up"]
  }
];
export const CONNECTION_HELP_GUIDES = Object.freeze(entries.map((x, i) => Object.freeze({
  ...x, id: "built-in-connection-help-" + i, updated_at: reviewed
})));
export const connectionHelpGuide = (slug) => CONNECTION_HELP_GUIDES.find(x => x.slug === slug);
