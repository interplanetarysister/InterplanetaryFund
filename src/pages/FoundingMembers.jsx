import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";

const enrollmentEnabled =
  import.meta.env.VITE_IFUND_FOUNDING_ENROLLMENT_ENABLED === "true";

export default function FoundingMembers() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [screenName, setScreenName] = useState("");
  const [interest, setInterest] = useState("both");
  const [marketing, setMarketing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!db || !enrollmentEnabled || !consent || busy || completed) return;
    setBusy(true);
    setStatus("");
    try {
      // The RPC must reject bots, rate-limit IP/email, store consent version,
      // and return a referral code only after durable insert. Never use browser
      // service-role keys or assume a network response equals stored consent.
      const { data, error } = await db.rpc("ifund_join_founding_waitlist", {
        p_email: email.trim(),
        p_screen_name: screenName.trim(),
        p_interest: interest,
        p_marketing_opt_in: marketing,
        p_consent: consent,
        p_website: website,
        p_ref: params.get("ref") || "",
      });
      if (error || !data?.ok) throw error || new Error("Not confirmed");
      setCompleted(true);
      setStatus(data.message || "Your enrollment was confirmed.");
      if (
        typeof data.referral_code === "string" &&
        /^[a-zA-Z0-9_-]{4,64}$/.test(data.referral_code)
      ) {
        setReferralLink(
          window.location.origin +
            "/founding-members?ref=" +
            encodeURIComponent(data.referral_code),
        );
      }
    } catch {
      setStatus(
        "Your signup was not confirmed. No enrollment has been claimed. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ifund-founding-page">
      <div className="ifund-founding-header">
        <p className="ifund-editorial-eyebrow">
          Founding Members · Early access
        </p>
        <h1>What if you were here from the beginning?</h1>
        <p>
          Be part of the first InterplanetaryFund community. Joining is free.
          Tell us how you'd like to use IFund, and we'll share updates when
          registration opens.
        </p>
      </div>
      <div className="ifund-founding-form-card">
        {!enrollmentEnabled || !db ? (
          <p className="ifund-route-notice" role="status">
            Founding-member enrollment is temporarily paused while secure
            storage and consent logging are verified. This form cannot submit
            your details yet.
          </p>
        ) : null}
        {completed ? (
          <section role="status">
            <h2>Thanks for joining</h2>
            <p>{status}</p>
            {referralLink && (
              <div className="ifund-share-row">
                <label>
                  Your invitation link <input readOnly value={referralLink} />
                </label>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(referralLink)}
                >
                  Copy link
                </button>
              </div>
            )}
          </section>
        ) : (
          <form className="form" onSubmit={submit}>
            <label>
              Your email{" "}
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Screen name (optional){" "}
              <input
                autoComplete="nickname"
                maxLength={50}
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
              />
            </label>
            <label>
              What would you like to do?
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
              >
                <option value="both">Support and fundraise</option>
                <option value="support">Support causes and ideas</option>
                <option value="fundraise">Create a fundraiser</option>
              </select>
            </label>
            <div className="ifund-honeypot" aria-hidden="true">
              <label>
                Website{" "}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            <label className="ifund-consent-row">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
              Also email me optional news and platform announcements.
            </label>
            <label className="ifund-consent-row">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I consent to IFund storing this information for early-access
              administration. <Link to="/privacy">Privacy Policy</Link>.
            </label>
            <button
              type="submit"
              className="primary"
              disabled={busy || !enrollmentEnabled || !db || !consent}
            >
              {busy ? "Joining…" : "Join the founding community"}
            </button>
            {status && (
              <p role="status" className="ifund-route-notice">
                {status}
              </p>
            )}
          </form>
        )}
        <p>
          <Link to="/">Return to home</Link>
        </p>
      </div>
    </main>
  );
}
