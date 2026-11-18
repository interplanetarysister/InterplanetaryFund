import { Link } from "react-router-dom";
const STEPS = [
  { title: "Make your goal specific", detail: "Describe what funding will cover and separate confirmed costs from estimates. If the full budget is unknown, explain what you still need to verify." },
  { title: "Tell a story in your own voice", detail: "Explain what happened, whom the fundraiser helps, and what receiving support could change. Keep details truthful and respect other people's privacy." },
  { title: "Use a clear image", detail: "Choose an authentic, relevant cover image you are allowed to share. Include image descriptions, and get permission before showing other people." },
  { title: "Invite, don't pressure", detail: "Ask supporters to donate or share if they wish. Avoid misleading urgency, guilt, fabricated milestones or promises about results." },
  { title: "Share updates consistently", detail: "Tell supporters what is changing, which milestones are verified, and how contributions are used. Thank people without exposing private donor information." },
  { title: "Make sharing easy", detail: "Use a working campaign link, a short accurate introduction and appropriate social destinations. Check each provider's posting rules before sharing." },
];
export default function FundraisingTips() {
  return <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">IFund / Fundraising Guide</p>
      <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Build a fundraiser people can understand and trust</h1>
      <p className="mt-3 text-muted-foreground">Practical steps for clearer campaigns, stronger communication and respectful supporter outreach. These ideas improve campaign quality; they cannot guarantee donations.</p>
    </header>
    <ol className="grid gap-4 sm:grid-cols-2">
      {STEPS.map((step,i)=><li key={step.title} className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-primary">Step {i+1}</p>
        <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
      </li>)}
    </ol>
    <nav aria-label="Fundraising next steps" className="flex flex-wrap gap-5 text-primary underline">
      <Link to="/create">Start a campaign</Link>
      <Link to="/discover">Explore fundraisers</Link>
      <Link to="/blogs">Read community stories</Link>
      <Link to="/live">Explore IFund Live</Link>
    </nav>
  </main>;
}
