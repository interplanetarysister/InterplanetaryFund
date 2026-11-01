// Independently bundled, public guidance for the migration build.
// These are explanatory articles, not proof that unfinished services are enabled.
export const helpArticles = Object.freeze([
  {
    slug: "find-your-way-around-ifund",
    category: "Getting Started",
    question: "How do I find pages in IFund?",
    description: "Find your way through the same sidebar and mobile navigation.",
    answer: "1. On a phone, open the menu at the top of the page.\n2. Choose Discover to view campaigns, or Help Center for assistance.\n3. On a larger screen, use the navigation on the left.\n4. You can switch between light and dark themes in the navigation.\n\nSome account, community and assistant pages are still being restored on the independent platform. A page appearing in the menu does not mean its service is active."
  },
  {
    slug: "create-a-campaign",
    category: "Campaigns",
    question: "How do I create a campaign?",
    description: "Campaign editing and publication during the migration.",
    answer: "Campaign creation, editing, publishing and agent-assisted artwork are being reconnected to the independent account and data system. Do not assume a campaign has been saved or published unless IFund shows a confirmed result from its independent backend. Until account migration and ownership checks finish, the new site does not offer live campaign creation."
  },
  {
    slug: "campaign-donations",
    category: "Donations",
    question: "Can I donate to a campaign right now?",
    description: "Why campaign donation controls are paused.",
    answer: "Campaign donations are paused on this migration build. Only provider-confirmed, reconciled gifts will appear in a campaign's raised totals. A separate platform-support payment, if offered, does not count toward any individual campaign. No payment is initiated from this help article."
  },
  {
    slug: "payment-holding-and-withdrawals",
    category: "Money & Withdrawals",
    question: "When can I withdraw campaign funds?",
    description: "Payout authorization, balance verification and platform fees.",
    answer: "Withdrawals require a verified eligible account, reconciled campaign balance, provider-approved payout capability and a recorded transaction. IFund's planned 3% platform fee applies at withdrawal, with processor fees separately disclosed. Withdrawal is not currently enabled on the new migration site; no funds can be released from this article."
  },
  {
    slug: "connect-another-platform",
    category: "Connections & Publishing",
    question: "How do I connect another app?",
    description: "Connection permissions and verification.",
    answer: "After independent account access and external provider connections are restored, open Connections, choose a provider, complete its sign-in and consent process, and check the verified connection status. Saving credentials or seeing a provider icon is not a completed connection. Publishing, messaging and external synchronization are not active on this migration build."
  },
  {
    slug: "ai-platform-permissions",
    category: "AI Assistance",
    question: "What can IFund AI do with my connected accounts?",
    description: "Chief of Staff, specialists and permission controls.",
    answer: "The original design includes a user-facing Chief of Staff and Support agent, with specialist agents working behind the scenes. Their identities and schedules have been inventoried but their replacement executors are not yet active. The independent platform must verify provider grants, consent, access boundaries and audit records before any agent acts on an outside account. An AI switch never authorizes payments or bypasses provider approval."
  },
  {
    slug: "account-access",
    category: "Account & Security",
    question: "How do I access my original account?",
    description: "Independent sign-in and existing account migration.",
    answer: "Original account identities and ownership permissions must be reconciled before migration sign-in can be considered equivalent. Do not create a duplicate account to work around missing campaigns. Never send passwords, API keys or payment card information in a help request."
  },
  {
    slug: "subscriptions",
    category: "Subscriptions",
    question: "Are subscriptions active?",
    description: "Subscriptions and membership entitlements.",
    answer: "Subscription controls and PayPal entitlement events have not yet passed independent migration verification. The new site must confirm real provider events and recorded membership before presenting an active subscription. No subscription purchase can be completed from this article."
  },
  {
    slug: "community",
    category: "Community",
    question: "Where are community discussions?",
    description: "Public posts, publishing and private messages.",
    answer: "Community routes are part of the original IFund experience. Public posts, member comments, notifications and direct messages require migrated records plus independent authorization and moderation checks. Do not infer that an empty new feed means earlier content was deleted."
  },
  {
    slug: "copyright-and-intellectual-property",
    category: "Legal & Policies",
    question: "Where are the legal and privacy documents?",
    description: "Public agreements, privacy and content permissions.",
    answer: "Read the current Terms of Service at /terms and Privacy Policy at /privacy. Earlier help-center legal articles are being transferred and must not be replaced with invented contract language. Contact the platform for questions about particular content licenses or permissions."
  }
]);
export const helpArticleBySlug = (slug) => helpArticles.find((article) => article.slug === slug) || null;
