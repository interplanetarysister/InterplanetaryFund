import { Link } from "react-router-dom";
import {
  TERMS_SECTIONS,
  TERMS_VERSION,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_CONTACT,
} from "../lib/legalPolicy";

/** Faithful legal text migration; independent acceptance workflow remains pending. */
export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/">Interplanetary Fund home</Link>
      <h1>Terms of Service</h1>
      <p>
        Version {TERMS_VERSION} · Effective {LEGAL_EFFECTIVE_DATE}
      </p>
      <p>
        Read these terms before accepting. Payments, AI limitations,
        intellectual property and liability terms require legal review before
        broad release.
      </p>
      {TERMS_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p>
        <Link to="/privacy">Privacy Policy</Link> ·{" "}
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </p>
    </main>
  );
}
