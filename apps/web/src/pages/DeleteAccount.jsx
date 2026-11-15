import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
export default function DeleteAccount() {
  const {user}=useAuthSession();
  return <main className="mx-auto min-h-dvh max-w-3xl space-y-6 px-5 py-12 text-foreground">
    <h1 className="text-3xl font-bold">Delete your Interplanetary Fund account</h1>
    <p>This is the public account-deletion resource for the IFund website, iPhone app and Android app. You can request permanent deletion even if you have uninstalled the mobile app.</p>
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Start a deletion request</h2>
      <p>Deleting an account means removing the account and associated personal data and published user-generated content, except records that must lawfully be retained for financial, tax, fraud-prevention, legal disputes or other applicable obligations.</p>
      {user&&<Link className="inline-flex min-h-11 items-center rounded-xl border border-red-500/40 px-5 py-3 font-semibold" to="/support?request=delete-account">Submit a tracked signed-in deletion request</Link>}
      {!user&&<Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 py-3 font-semibold" to="/login?returnTo=%2Fsupport%3Frequest%3Ddelete-account">Sign in for a tracked request</Link>}
      <p>Without an account session, use this email resource instead. Include your IFund account email so ownership can be verified; do not include passwords, authentication codes or card numbers.</p>
      <a className="inline-flex min-h-11 items-center break-all text-primary underline" href="mailto:hello@interplanetaryfund.com?subject=Interplanetary%20Fund%20account%20deletion%20request">hello@interplanetaryfund.com — request account deletion</a>
      <p>Requests are reviewed and fulfilled through IFund's account privacy process; sending a request does not immediately erase financial or campaign records. You may be asked to verify account ownership, and IFund will confirm the outcome after processing.</p>
    </section>
    <p>Read the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> or visit <Link to="/contact" className="text-primary underline">Contact</Link> for support.</p>
    <Link to="/" className="text-primary underline">Return to Interplanetary Fund</Link>
  </main>;
}
