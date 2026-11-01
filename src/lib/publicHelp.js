// Independent read-only help guides. Do not treat unported Base44 workflows as live.
// The topic taxonomy and stable slug convention follow interplanetary-fund2/main.
export const PUBLIC_HELP_ARTICLES = Object.freeze([
  {
    slug: "start-a-fundraiser",
    category: "Campaigns",
    question: "How do I start a fundraiser?",
    description: "Start with a draft and review before publishing.",
    answer: "1. Sign in to your Interplanetary Fund account.\n2. Open Start a campaign.\n3. Describe the goal, beneficiaries, and story accurately.\n4. Save a draft, then review its details before publication.\n\nSome publishing and automated outreach functions are still being migrated. A saved draft does not mean donations are enabled. Never share sensitive financial details in a public story.",
  },
  {
    slug: "connection-status",
    category: "Connections & Publishing",
    question: "Does a saved external connection mean it is active?",
    description: "Understand what connected and pending actually mean.",
    answer: "No. A saved connection record or provider name is not proof that an external account is authorized, synchronized, or ready for automated publishing. Verify the provider response and granted permissions first. IFund must not represent a pending or unverified connection as working. External publishing and replies are not guaranteed to be available during this migration.",
  },
  {
    slug: "donation-totals",
    category: "Donations",
    question: "Why might a fundraising total be unavailable?",
    description: "Verified totals and unavailable totals are different from zero.",
    answer: "A displayed total should come from verified financial records. If a campaign has no independently verified funding total, IFund should show the amount as unavailable rather than claiming zero. Pending gifts, manually entered observations, and external platform balances do not automatically become available or withdrawable funds. Payment migration and payout activation remain separate release steps.",
  },
  {
    slug: "contact-support",
    category: "Getting Started",
    question: "How can I contact Interplanetary Fund?",
    description: "Use the public contact page while the form is being migrated.",
    answer: "Open the Contact page and use its email link. Your email application will compose a message; the website does not confirm delivery. Do not include passwords, one-time codes, payment card information, or secret recovery tokens in a support message. The web contact form and private support-ticket workflow are not active in this independent build.",
  },
]);
export const publicHelpArticle = (slug) => PUBLIC_HELP_ARTICLES.find((entry) => entry.slug === slug) || null;
