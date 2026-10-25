import { Link } from 'react-router-dom';

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1>About Interplanetary Fund</h1>
      <p>One place to start, share, and grow a fundraiser.</p>
      <section>
        <h2>What we do</h2>
        <p>
          Interplanetary Fund brings fundraising into one place: campaigns,
          updates, connections, and optional assistance with writing and outreach.
          People remain in control of what helpers are allowed to do.
        </p>
      </section>
      <section>
        <h2>Who it is for</h2>
        <p>
          The platform is designed for people, community organizers, small
          businesses, nonprofit groups, and institutions raising money for
          meaningful needs, projects, and ideas.
        </p>
      </section>
      <section>
        <h2>Who builds it</h2>
        <p>
          Interplanetary Fund is being built to make fundraising more connected,
          transparent, and trustworthy. What if a good idea had the tools it
          needed to become real?
        </p>
      </section>
      <p>
        <Link to="/discover">Explore campaigns</Link>
      </p>
    </main>
  );
}
