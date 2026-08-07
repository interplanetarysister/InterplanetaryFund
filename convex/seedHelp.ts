import { mutation } from "./_generated/server";

export const seedHelpArticles = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("helpArticles").collect();
    if (existing.length > 0) return { status: "already_seeded", count: existing.length };

    const articles = [
      {
        category: "Getting Started",
        question: "How do I create a campaign?",
        answer: "Click 'Start Your Mission' on the home page, sign in, and use the AI Campaign Wizard. Enter what happened, who it's for, your goal amount, and our AI will generate your title, story, FAQ, social captions, and cover image automatically.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Getting Started",
        question: "How does the AI Campaign Wizard work?",
        answer: "Our AI Campaign Wizard uses template-based generation to create professional campaign content from your inputs. It generates a compelling title, summary, story, FAQ, social media captions, press release, donor thank-you message, and SEO content — all tailored to your campaign category.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Donations",
        question: "What payment methods are supported?",
        answer: "We support PayPal for credit/debit card donations and CashApp for direct transfers. When a donor clicks 'Fuel This Mission', they can choose PayPal (redirects to PayPal checkout) or CashApp (shows your $cashtag for direct payment).",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Donations",
        question: "What are the platform fees?",
        answer: "Interplanetary Fund charges a 5% platform fee plus standard processing fees (2.9% + $0.30 per transaction for PayPal). The remaining amount goes directly to your campaign. You can see the full fee breakdown in your Treasury dashboard.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Donations",
        question: "How do I receive my funds?",
        answer: "Once your campaign reaches its goal or you request a payout, funds are transferred from the holding account to your linked payment method. You can request a payout from the Treasury page. All payouts require admin approval for fraud protection.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Campaigns",
        question: "What is the Campaign Protocol?",
        answer: "The Campaign Protocol (P-1 through P-8) ensures every campaign meets quality standards: outreach enabled, AI profile complete, story present, payment active, required fields filled, agent assigned, platform sync, and fee breakdown. Our system auto-fixes violations daily at 6am PT.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Campaigns",
        question: "How do AI agents help my campaign?",
        answer: "Five AI agents work 24/7 on your campaign: Atlas manages Facebook outreach, Post Production creates content, Donor Relations handles thank-yous and milestones, Scout finds new donors, and the Coordinator ensures everything runs smoothly. All credit-free, all automatic.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Campaigns",
        question: "Can I post updates to my campaign?",
        answer: "Yes! Once logged in, go to your campaign page and click 'Post Update'. Your followers will receive a notification automatically. Updates help keep donors engaged and can boost sharing.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Community",
        question: "How do I follow a campaign?",
        answer: "Click the 'Follow' button on any campaign page. You'll receive notifications when the campaign posts updates, reaches milestones, or needs support. You can manage your followed campaigns in your dashboard.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Community",
        question: "Can I comment on campaigns?",
        answer: "Yes! Every campaign has a comments section. You can leave words of encouragement, ask questions, or share the campaign with your network. Other users can like your comments too.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Security",
        question: "How do you protect against fraud?",
        answer: "We use multiple layers of protection: holding accounts with freeze capability, admin approval for all payouts, spam blocklists, PayPal payment verification, and automated fraud detection. All transactions are logged and auditable.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
      {
        category: "Institutions",
        question: "Can organizations use Interplanetary Fund?",
        answer: "Yes! Organizations can apply through the Institution Apply page. Verified organizations receive a badge on their campaigns and access to enhanced features including batch payout processing and priority agent support.",
        helpfulYes: 0,
        helpfulNo: 0,
      },
    ];

    for (const article of articles) {
      await ctx.db.insert("helpArticles", article);
    }

    return { status: "success", count: articles.length };
  },
});
