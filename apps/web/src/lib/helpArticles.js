// Independently bundled, public guidance for the migration build.
// These are explanatory articles, not proof that unfinished services are enabled.
export const helpArticles = Object.freeze([
  {
    slug: "find-your-way-around-ifund",
    category: "Getting Started",
    question: "How do I find pages in IFund?",
    description: "Find your way through the same sidebar and mobile navigation.",
    answer: "1. On a phone, open the menu at the top of the page.\n2. Choose Discover to view campaigns, or Help Center for assistance.\n3. On a larger screen, use the navigation on the left.\n4. You can switch between light and dark themes in the navigation.\n\nChoose the destination that matches your task. Private actions ask you to sign in; the service confirms whether a save, connection, or payment completed before IFund reports success."
  },
  {
    slug: "create-a-campaign",
    category: "Campaigns",
    question: "How do I create a campaign?",
    description: "Campaign editing and publication during the migration.",
    answer: "Open New Campaign, describe your cause, add a fundraising goal and optional cover image, then save a draft. Review the full story and publication checks before selecting Publish. Only a confirmed saved draft or published campaign should be treated as complete; a preview is not a published fundraiser."
  },
  {
    slug: "campaign-donations",
    category: "Donations",
    question: "Can I donate to a campaign right now?",
    description: "How live campaign donations are verified.",
    answer: "Live PayPal campaign donations are enabled on published active campaigns. The Donate Now button follows the production payment-service health gate, and only provider-confirmed, reconciled gifts are recorded in campaign totals and receipts. Platform-support payments remain separate and do not fund individual campaigns. No payment starts from this help article."
  },
  {
    slug: "payment-holding-and-withdrawals",
    category: "Money & Withdrawals",
    question: "When can I withdraw campaign funds?",
    description: "Payout authorization, balance verification and platform fees.",
    answer: "Withdrawals require a verified eligible account, reconciled campaign balance, provider-approved payout capability and a recorded transaction. IFund's planned 7% platform fee applies at withdrawal, with processor fees separately disclosed. The Withdrawals page checks your account and provider eligibility; it does not guarantee that every account can withdraw. No withdrawal starts from this help article."
  },
  {
    slug: "connect-another-platform",
    category: "Connections & Publishing",
    question: "How do I connect another app?",
    description: "Connection permissions and verification.",
    answer: "Open Connections, select the platform you want to use, and follow that provider's sign-in and consent process. Check for an explicit verified connection result. A visible icon or unfinished authorization does not mean IFund can publish to that account. Publishing and messaging require each provider's approved permissions and your destination-specific choices."
  },
  {
    slug: "ai-platform-permissions",
    category: "AI Assistance",
    question: "What can IFund AI do with my connected accounts?",
    description: "Chief of Staff, specialists and permission controls.",
    answer: "The AI Team workspace provides guided campaign preparation and writing assistance where its service is available. Drafts and suggestions are not automatically posted. Any specialist action on a connected account requires that provider's approved scope and your consent; an AI switch never authorizes payments or bypasses provider approval."
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
    answer: "Signed-in members can open /subscriptions to view and manage PayPal recurring plans. The Basic monthly plan is currently available only after IFund verifies the live PayPal plan and recurring-billing webhook configuration. PayPal approval alone does not grant paid access: IFund records an active subscription only after provider-confirmed payment evidence is reconciled into the member-scoped subscription ledger. Other plan options remain unavailable until their PayPal plans are independently verified. No subscription purchase starts from this help article."
  },
  {
    slug: "community",
    category: "Community",
    question: "Where are community discussions?",
    description: "Public posts, publishing and private messages.",
    answer: "Open Community or Social Feed to read public posts. Signed-in members can save private drafts, publish their own posts, and participate in moderated discussions when their account is eligible. Historical posts from other systems may have a separate import status; an empty feed alone is not proof that earlier posts were deleted."
  },
  {
    slug: "copyright-and-intellectual-property",
    category: "Legal & Policies",
    question: "Where are the legal and privacy documents?",
    description: "Public agreements, privacy and content permissions.",
    answer: "Read the current Terms of Service at /terms and Privacy Policy at /privacy. Only the published, current legal documents control your rights; a help summary cannot replace their text. Contact the platform for questions about particular content licenses or permissions."
  }
]);
export const helpArticleBySlug = (slug) => helpArticles.find((article) => article.slug === slug) || null;
