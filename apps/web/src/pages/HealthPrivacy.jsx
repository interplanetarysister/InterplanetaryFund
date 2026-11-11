import { Link } from "react-router-dom";
import LegalFooter from "@/components/LegalFooter";
import { LEGAL_CONTACT, LEGAL_EFFECTIVE_DATE } from "@/lib/legalPolicy";

// Separate notice for Washington consumer health data. Do not use this
// document as a substitute for feature-specific affirmative consent.
const sections = [
  { title: "Health information and sources", paragraphs: [
    "IFund does not request health information to create an ordinary member account. If you choose to create or share a campaign about medical costs, injuries, disabilities, pregnancy, treatment or other physical or mental health matters, your text, uploaded images, documents and campaign context may reveal health conditions, diagnoses, treatment, care, related expenses, or information about another person.",
    "We receive these details when you or an authorized campaign organizer provide them directly in campaign forms, public posts, images, or support messages. We may also receive related context from authorized campaign contributors or from external services only when a relevant connection is actively enabled. Do not include someone else's private health information unless you have appropriate permission."
  ]},
  { title: "Purposes and limits", paragraphs: [
    "Depending on the feature you actively choose, submitted health-related content may be stored as your campaign draft, shown on the published campaign, moderated for safety and fraud, used to respond to your support request, and processed for a campaign-description or image-assistance request that you initiate. Account signup itself does not require medical details.",
    "IFund must obtain separate affirmative consent where the Washington My Health My Data Act or other applicable laws require it before collecting, using or sharing consumer health data for a particular purpose. Agreeing to the general Terms does not grant that separate permission. Avoid submitting sensitive health details if a feature does not provide the required controls."
  ]},
  { title: "What is shared and with whom", paragraphs: [
    "If you publish a campaign, the health details you choose to include in its public story, images, or comments become visible to site visitors and may be copied or shared by others. Publication on a separately connected third-party platform requires the authorization and functionality of that platform. You are responsible for securing permission from anyone else you identify.",
    "Service categories potentially processing health-related content include Cloudflare (application hosting, Workers, security and media storage), Supabase (identity and application data), AI service providers used for an optional generation request, and authorized publishing channels you select. PayPal and other payment providers may process necessary donation or fraud metadata but should not receive private medical narratives unless necessary for an enabled service and lawfully authorized. Specific active vendors and data flows must be verified against deployed configuration. IFund does not authorize sale of consumer health data."
  ]},
  { title: "Your rights and choices", paragraphs: [
    "Where Washington law applies, you may ask us to confirm whether we collect or share your consumer health data, obtain access, withdraw consent, and request deletion, subject to the law's limits. Send requests to the contact address below or use /contact. We may need to verify requestor identity and preserve narrow legal or financial audit records where law permits. Withdrawing consent does not retroactively remove information already viewed or copied by third parties from a previously public campaign.",
    "We will assess requests under the applicable statutory time frames and explain any denial and appeal process. You may also pursue available remedies under applicable law. This notice can change prospectively; additional categories, recipients or purposes requiring fresh consent will not be silently added."
  ]}
];
export default function HealthPrivacy() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <article className="mx-auto max-w-3xl space-y-6">
        <Link to="/" className="text-sm font-semibold text-primary underline">Interplanetary Fund home</Link>
        <h1 className="text-3xl font-bold">Consumer Health Data Privacy Notice</h1>
        <p className="text-sm text-muted-foreground">Effective {LEGAL_EFFECTIVE_DATE} · Washington My Health My Data Act</p>
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          This separate notice covers health-related details voluntarily shared through campaigns. It does not replace
          the general <Link className="underline" to="/privacy">Privacy Policy</Link> or any feature-specific consent.
        </p>
        {sections.map((section) => <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph, i) => <p key={i} className="text-sm leading-7">{paragraph}</p>)}
        </section>)}
        <p className="border-t border-border pt-4 text-sm">
          Requests and questions: <a className="underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>. Read our <Link className="underline" to="/terms">Terms of Service</Link>.
        </p>
      </article>
      <LegalFooter />
    </main>
  );
}
