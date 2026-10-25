import { Link } from 'react-router-dom';
import {
  PRIVACY_SECTIONS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_CONTACT,
} from '../lib/legalPolicy';

/** Preserve existing policy copy while privacy controls are audited. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/">Interplanetary Fund home</Link>
      <h1>Privacy Policy</h1>
      <p>Last revised {LEGAL_EFFECTIVE_DATE}</p>
      <p>
        This notice describes IFund's use of information. Provider retention,
        access, and independent-host behavior require verification before launch.
      </p>
      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p>
        <Link to="/terms">Terms of Service</Link> ·{' '}
        <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
      </p>
    </main>
  );
}
