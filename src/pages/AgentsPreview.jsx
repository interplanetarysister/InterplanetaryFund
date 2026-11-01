import { Link } from "react-router-dom";
import { ArrowLeft, Crown, Lightbulb, TrendingUp, MessagesSquare, BookOpenText, Wallet, Megaphone, Compass, PlugZap, LockKeyhole } from "lucide-react";
const SPECIALISTS = [
  { name: "Chief of Staff", role: "Team coordination", Icon: Crown, detail: "Coordinates fundraising specialists and keeps your campaign priorities organized.", tone: "gold" },
  { name: "Strategy", role: "Campaign strategy", Icon: Lightbulb, detail: "Plans next steps and identifies practical ways to strengthen a campaign.", tone: "violet" },
  { name: "Growth", role: "Audience growth", Icon: TrendingUp, detail: "Focuses on supporter growth, outreach opportunities, and campaign momentum.", tone: "cyan" },
  { name: "Communications", role: "Donor conversations", Icon: MessagesSquare, detail: "Helps draft thoughtful updates, replies, and supporter communications.", tone: "blue" },
  { name: "Story", role: "Campaign storytelling", Icon: BookOpenText, detail: "Helps shape authentic stories that explain the cause and its impact.", tone: "pink" },
  { name: "Finance", role: "Campaign finances", Icon: Wallet, detail: "Organizes financial questions, verified totals, fees, and payouts.", tone: "green" },
  { name: "Outreach", role: "Campaign promotion", Icon: Megaphone, detail: "Plans promotional messages and outreach across approved destinations.", tone: "orange" },
  { name: "Discovery", role: "Platform research", Icon: Compass, detail: "Researches fundraising channels and their connection capabilities.", tone: "indigo" },
  { name: "Managed Connections", role: "Account integrations", Icon: PlugZap, detail: "Guides account connections and helps identify integration issues.", tone: "teal" },
];
export default function AgentsPreview() {
 return <main className="ifund-agents">
   <Link className="ifund-back-link" to="/dashboard"><ArrowLeft size={16}/> Dashboard</Link>
   <section className="ifund-agents-heading"><p className="eyebrow">YOUR FUNDRAISING OPERATING SYSTEM</p>
     <h1>Your AI Team</h1><p>Meet the specialists behind every stage of your fundraising journey.</p>
   </section>
   <div className="ifund-agent-grid">
     {SPECIALISTS.map(({name,role,Icon,detail,tone}) => <article className="ifund-agent-card" key={name}>
       <div className={`ifund-agent-icon ifund-agent-icon--${tone}`} aria-hidden="true"><Icon size={29} strokeWidth={1.8}/></div>
       <div><p className="ifund-agent-role">{role}</p><h2>{name}</h2><p>{detail}</p></div>
       <span className="ifund-agent-preview-label"><LockKeyhole size={13}/> Preview only</span>
     </article>)}
   </div>
   <p className="ifund-agent-disclaimer">These are visual representations of the original specialist roles. Agent conversations and automated actions are not connected in this preview.</p>
 </main>;
}
