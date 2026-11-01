// Built-in instructions for user-facing flows. Keep these in sync with UI changes.
// Available offline from the bundle and visible even if HelpArticle API is unavailable.
const updated = "2026-10-22";
const guides = [
  {
    slug: "create-campaign-by-voice", category: "Campaigns",
    question: "How do I make a campaign by voice?",
    description: "Speak or type to guide your campaign from an idea to a saved draft.",
    answer: `1. Sign in, choose New Campaign, then Create by voice. You can also open /create?voice=1.
2. Tap the microphone and say what you want to raise money for. Tap it again for each turn.
3. Tell IFund who the campaign helps when asked. Existing campaign answers are reused.
4. Say Show five titles, then Choose the second title, or tap your choice.
5. Say Write my story, then Create a picture. Review the text and artwork on screen.
6. Say Read my campaign to hear it. Edit any details in the normal campaign form.
7. Say Save as a draft. Wait for the saved confirmation. This saves privately and does not publish or take payment.
8. If speech is unavailable, type the same commands. If microphone access is denied, change your browser permission or keep typing.

This is a simulated Alexa+ experience using browser voice tools and IFund AI, not a connection to Amazon Alexa. Browser recognition may send audio to its speech provider. IFund does not save microphone recordings. AI generation requires the feature/provider to be available.`,
    keywords: ["voice", "alexa", "simulation", "microphone", "campaign", "speech"]
  },
  {
    slug: "find-your-way-around-ifund", category: "Getting Started",
    question: "How do I find pages in IFund?",
    description: "Open the small side menu to find what you want.",
    answer: `1. On your phone, tap the three lines at the top left.
2. Look in Explore for Discover, the Globe, and your Dashboard if signed in.
3. Look in Campaigns & Giving to make a campaign or check gifts and withdrawals.
4. Use Community for posts, stories, and messages. Use Account & Help for your settings and Help Center.
5. Tap a page name to go there. The menu closes by itself.
6. To close without choosing a page, tap X, tap outside the menu, or press Escape on a keyboard.
7. On a large screen, the small menu stays on the left.

The page behind the open menu gets a little darker and blurry, but your words are still there.
Updated: ${updated}.`,
    keywords: ["menu", "sidebar", "navigation", "pages", "help", "find", "drawer"]
  },
  {
    slug: "translate-a-campaign", category: "Campaigns",
    question: "How do I translate a campaign into another language?",
    description: "Read a campaign in another language, or publish a translation for your visitors.",
    answer: [
      "1. Open a campaign. Find Read campaign in, near the title.",
      "2. Tap the box and pick a language that is ready. To go back, pick Original language.",
      "3. If you made the campaign, you can see ten languages. Choose one and tap Generate translation.",
      "4. Read the translated title, short description, and story. AI may make mistakes, so compare important facts with your original words.",
      "5. Tap Publish translation if you want visitors to see it. Until you publish it, it is just your preview.",
      "6. Visitors can only select languages you have published. Your donation totals, checkout, and original story do not change.",
      "7. If you edit the original title, summary, or story, that translation becomes out of date. Generate and publish it again.",
      "8. If the translation says it cannot load, your original campaign is still safe.",
      "",
      "An AI translation may use processing credits when you generate it. Only campaign owners and admins can generate or publish translations.",
      "Updated: " + updated + "."
    ].join("\n"),
    keywords: ["translate", "translation", "languages", "spanish", "arabic", "chinese", "campaign"]
  },
  {
    slug: "choose-light-or-dark-mode", category: "Account & Security",
    question: "How do I make IFund light or dark?",
    description: "Change the whole screen, not just the menu.",
    answer: `1. Open IFund.
2. Tap the sun or moon button at the top, or in the side menu on a computer.
3. Light makes the page bright. Dark makes the page dark.
4. Your choice stays saved for next time.
5. The pages, boxes, words, and menus should all change. If a page does not change, tell us which page it is.
Updated: ${updated}.`,
    keywords: ["theme", "appearance", "dark", "light", "accessibility"]
  },
  {
    slug: "make-a-campaign-with-ai-ideas", category: "Campaigns",
    question: "How do I make a campaign with AI help?",
    description: "Pick from five titles, then five descriptions, then create your story.",
    answer: `1. Tap New Campaign.
2. Tell IFund what you want to do and who it helps. If you have supporter ideas, enter people, groups, or organizations once in the optional supporter box. AI reuses that answer and can research other likely supporters. You can leave it blank.
3. Tap Continue. Choose a kind of campaign and the amount you want to raise.
4. Tap Continue. Type a title, OR tap Show five AI options. Tap the one you like.
5. Type one line about your campaign, OR tap Show five AI options. Tap the one you like.
6. Tap Forge my story. The story appears in the box below. You can edit it yourself.
7. Upload a picture or tap Generate Image. The image is selected automatically. Generated pictures follow your campaign story and may use representative people; they are labeled AI-generated illustrations. Free accounts get an IFund watermark; active paid subscribers and admins receive a clean image automatically. There is no Use IFund version step. Then tap Continue and read everything.
8. Tap Launch campaign to publish, or Save draft to finish later.

Each set of five AI choices should sound different: some focus on people, some on hope, and some on what support can do. Tap Try five more for fresh ideas. AI must use only facts you provided, so check each suggestion before choosing it. You never need to type the same answer twice. AI suggestions only work when AI help is available. You can always use your own words.
Updated: ${updated}.`,
    keywords: ["ai", "campaign", "title", "five options", "story", "summary"]
  },
  {
    slug: "pay-with-paypal-on-a-phone", category: "Donations",
    question: "How do I donate with PayPal on my phone?",
    description: "Find the PayPal button and see the payment choices.",
    answer: `1. Open a campaign and tap Donate.
2. Type how much you want to give. The number is the whole gift to that campaign.
3. If you want, turn on the extra support for IFund. It is off at first.
4. Read the total. If PayPal is ready for this campaign, scroll down to Give with PayPal.
5. Tap the PayPal button. Follow PayPal's safe checkout steps.
6. Come back to IFund to see your result. If payment did not finish, do not try to count it as paid.

If you cannot see the button, scroll inside the donation window. It should fit your phone. If PayPal is not available, no PayPal payment begins.
Updated: ${updated}.`,
    keywords: ["donate", "paypal", "phone", "checkout", "button", "cropped"]
  },
  {
    slug: "crypto-wallet-donations", category: "Donations",
    question: "Can I give or get cryptocurrency?",
    description: "Crypto receiving is being prepared. It is not a live payment option yet.",
    answer: `1. Open your campaign settings.
2. Turn on Allow cryptocurrency donations if you want it when it is ready.
3. Save. This only saves your choice. It does not create a wallet or receive money yet.
4. Google Wallet and Google Pay do not provide a cryptocurrency receiving address.
5. Do not send coins to a random address or an address that does not match the coin and network.
6. Wait for IFund to clearly show that crypto receiving has been checked and is ready.

A connected wallet alone does not mean a payment was sent. No crypto gifts count toward your campaign until a real transaction is verified.
Updated: ${updated}.`,
    keywords: ["crypto", "wallet", "google", "bitcoin", "paypal", "donation"]
  },
];
export const WORKFLOW_HELP_GUIDES = Object.freeze(guides.map((entry, i) => Object.freeze({
  ...entry, id: "built-in-workflow-help-" + i, updated_at: updated
})));
export const workflowHelpGuide = (slug) => WORKFLOW_HELP_GUIDES.find((guide) => guide.slug === slug);
