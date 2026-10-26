import { Link } from "react-router-dom";
import { Planet } from "../components/UI";
const sections = [
  {
    title: "What we do",
    body: "Interplanetary Fund brings fundraising into one simple place. Create your fundraiser, accept support, share updates, connect the other places you use, talk with supporters, and see how things are going. Built-in helpers can suggest ideas and help with writing or outreach. You stay in control of what they are allowed to do.",
  },
  {
    title: "Who it is for",
    body: "Interplanetary Fund is designed for anyone who needs to raise money for a cause, a project, or a dream. That includes individuals fundraising for medical expenses, emergencies, memorials, or creative projects; small businesses seeking capital; nonprofits that want to operate more efficiently; communities organizing around local needs; and institutions looking for a simple fundraising home without juggling lots of different tools. We built it so that a family raising money for an important need can spend less time fighting technology and more time reaching people, and so that an organizer with a great idea and no marketing department can get help that once required a whole team. Our long-term vision extends to organizations, communities, institutions, and eventually businesses participating in a connected funding network.",
  },
  {
    title: "Who builds it",
    body: "Interplanetary Fund is built by Michelle Rogers and a team dedicated to making fundraising more connected, transparent, and trustworthy. The platform is engineered with scalability in mind — its ambition is global, and it is being built to help campaigns of every size. We believe fundraising is fundamentally about trust: when someone contributes their money, they are putting trust in the person asking for help. That is why every decision we make — from helpful tools to clear money records and account controls — is grounded in transparency, accountability, and keeping humans in control. We are actively looking for partners who see the potential to build a larger ecosystem around how people fund ideas, causes, projects, and possibilities. Every successful campaign begins with a question: What if? Interplanetary Fund exists to help turn that question into momentum.",
  },
  {
    title: "Fund a healthier planet",
    body: "Interplanetary Fund welcomes fundraising for environmental projects, from habitat restoration to waste reduction and cleaner energy. We are working to make our own software more efficient too. Our hosting energy use and overall emissions have not yet been independently verified, and campaign categories alone are not proof of environmental outcomes.",
  },
];
export default function About() {
  return (
    <main className="ifund-about stack">
      <section className="ifund-public-hero ifund-about-hero">
        <div className="ifund-hero-content">
          <div className="ifund-hero-brand">
            <Planet />
            <strong>Interplanetary Fund</strong>
          </div>
          <h1>
            About <span>Interplanetary Fund</span>
          </h1>
          <p className="ifund-home-subtitle">
            One place to start, share, and grow a fundraiser.
          </p>
        </div>
      </section>
      <div className="ifund-story-surface">
        {sections.map(({ title, body }) => (
          <section className="ifund-about-section" key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        <div className="ifund-home-ctas">
          <Link to="/discover" className="secondary">
            Explore causes
          </Link>
          <Link to="/create" className="primary">
            Start a campaign
          </Link>
        </div>
      </div>
    </main>
  );
}
