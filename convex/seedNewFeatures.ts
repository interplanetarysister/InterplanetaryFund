import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Seed community groups, volunteer opportunities, and feature flags
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const results: string[] = [];

    // 1. Seed community groups
    const groups = [
      { name: "Fundraising Strategies", description: "Share tips, successes, and learn from fellow fundraisers", category: "Fundraising", createdBy: "system" },
      { name: "Medical Campaign Support", description: "Support and resources for medical fundraisers", category: "Medical", createdBy: "system" },
      { name: "Education Advocates", description: "Connect with others funding educational initiatives", category: "Education", createdBy: "system" },
      { name: "Animal Rescue Network", description: "Coordinate rescue efforts and share resources for animal campaigns", category: "Animals", createdBy: "system" },
      { name: "Environmental Action", description: "Discuss climate, conservation, and green fundraising", category: "Environment", createdBy: "system" },
      { name: "General Discussion", description: "Open community for all Interplanetary Fund members", category: "General", createdBy: "system" },
    ];

    for (const g of groups) {
      const groupId = await ctx.db.insert("communityGroups", {
        ...g,
        memberCount: 1,
        createdAt: now,
      });
      results.push(`Group: ${g.name}`);
    }

    // 2. Seed feature flags
    const flags = [
      { name: "community_enabled", description: "Community groups and discussions", enabled: true },
      { name: "volunteer_enabled", description: "Volunteer opportunities board", enabled: true },
      { name: "institutions_enabled", description: "Institution and grant applications", enabled: true },
      { name: "ai_recommendations", description: "AI-powered campaign recommendations", enabled: true },
      { name: "agent_activity_log", description: "Agent activity logging in admin", enabled: true },
      { name: "mission_briefs", description: "Mission briefs and executive reports", enabled: true },
      { name: "treasury_snapshots", description: "Historical treasury snapshots", enabled: true },
      { name: "paypal_checkout", description: "PayPal checkout for donations", enabled: false },
      { name: "withdrawal_system", description: "Payout and withdrawal system", enabled: true },
    ];

    for (const f of flags) {
      await ctx.db.insert("featureFlags", {
        ...f,
        rolloutPercent: 100,
        createdAt: now,
        updatedAt: now,
      });
      results.push(`Flag: ${f.name} = ${f.enabled}`);
    }

    // 3. Seed initial treasury snapshot
    await ctx.db.insert("treasurySnapshots", {
      totalRaised: 9907,
      totalDistributed: 0,
      totalFees: 0,
      totalHeld: 9907,
      campaignCount: 4,
      donorCount: 8,
      snapshotDate: now,
      breakdown: JSON.stringify({ active: 9907, pending: 0, distributed: 0 }),
    });
    results.push("Treasury snapshot created");

    // 4. Log Solene's first activity
    await ctx.db.insert("agentActivityLog", {
      agentName: "Solene",
      action: "Platform initialization",
      category: "protocol",
      description: "Seeded community groups, feature flags, treasury snapshot, and agent activity log",
      creditCost: 0,
      timestamp: now,
    });
    results.push("Agent activity logged");


    // 5. Seed help articles
    const articles = [
      { category: "Getting Started", question: "How do I create a campaign?", answer: "Click 'Start a Campaign' on your dashboard. Fill in your campaign title, goal amount, category, and story. You can add a cover image and set an end date. Once published, your campaign will be visible on the Explore page." },
      { category: "Getting Started", question: "How long does it take to set up a campaign?", answer: "Setting up a campaign takes about 5-10 minutes. You'll need a title, a goal amount, a category, and a compelling story. Adding a cover image and updates helps attract more supporters." },
      { category: "Creating Campaigns", question: "What categories are available?", answer: "We support: Medical, Education, Disaster Relief, Animals, Community, Memorial, Business, Creative, Charity, and Other. Choose the category that best fits your campaign." },
      { category: "Creating Campaigns", question: "Can I edit my campaign after publishing?", answer: "Yes! Go to your Dashboard, find the campaign, and click Edit. You can update the title, story, goal, and images at any time. The goal amount can only be increased, not decreased." },
      { category: "Donating", question: "How do I donate to a campaign?", answer: "Visit any campaign page and click the Donate button. You can choose a preset amount or enter a custom amount. We support CashApp and PayPal for secure donations." },
      { category: "Donating", question: "Is my donation secure?", answer: "Yes. All donations are processed through secure payment gateways (PayPal and CashApp). Your payment information is never stored on our servers." },
      { category: "Donating", question: "Can I donate anonymously?", answer: "Yes! When making a donation, you can choose to remain anonymous. Your name will not be displayed on the campaign's supporter list." },
      { category: "Payouts", question: "How do I receive funds from my campaign?", answer: "Go to your Dashboard, find your campaign, and click 'Request Payout'. Funds are transferred after a 5% platform fee and 2.9% + $0.30 processing fee are deducted. You'll see the full breakdown before confirming." },
      { category: "Payouts", question: "How long do payouts take?", answer: "Payouts are typically processed within 3-5 business days. You'll receive a notification when your payout is approved and transferred." },
      { category: "Account & Security", question: "How do I reset my password?", answer: "We use passwordless authentication. Simply enter your email on the login page and we'll authenticate you. No password needed!" },
      { category: "Account & Security", question: "Is my personal information safe?", answer: "Yes. We take privacy seriously. Your email and personal information are encrypted and never shared with third parties. See our Privacy Policy for details." },
    ];

    for (const a of articles) {
      await ctx.db.insert("helpArticles", {
        ...a,
        helpfulYes: 0,
        helpfulNo: 0,
      });
      results.push(`Article: ${a.question}`);
    }

    return { success: true, seeded: results };
  },
});
