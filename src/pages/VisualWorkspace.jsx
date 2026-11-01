import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft, LockKeyhole } from "lucide-react";
const pages = {
  "/agents": ["AI Team", "Your fundraising agents", "Coordinate content creation and outreach from your AI workspace."],
  "/mission": ["Mission Control", "Campaign mission control", "Plan campaign outreach and review activity across your connected channels."],
  "/ai-images": ["Cosmic Image Studio", "Create campaign visuals", "Generate and refine campaign imagery for your fundraising story."],
  "/inbox": ["Inbox", "One place for conversations", "Messages, donor inquiries, and campaign updates belong here."],
  "/following": ["Orbiting Causes", "Campaigns you follow", "Keep track of the campaigns you follow."],
  "/giving": ["My Impact", "Your giving history", "See your contributions and the campaigns you support."],
  "/ledger": ["Mission Ledger", "Campaign finances", "Review verified campaign transactions and withdrawal activity."],
  "/withdrawals": ["Payout Dock", "Manage withdrawals", "Track withdrawal requests for campaigns you own."],
  "/notifications": ["Signal Alerts", "Your updates", "See campaign activity and important alerts."],
  "/communications": ["Comms Center", "Campaign communications", "Organize the conversations that matter to your campaigns."],
  "/institutions": ["Alliance Network", "Fundraising communities", "Discover and manage institution-supported fundraising."],
  "/subscriptions": ["Mission Plans", "Fundraising plans", "Explore available capabilities for your campaign."],
  "/donors": ["Mission Supporters", "Your supporters", "Recognize the people helping your campaigns succeed."],
  "/analytics": ["Command Center", "Campaign insights", "Understand fundraising activity across your platform."],
  "/ops": ["Ops Center", "Operations", "Review operational health and connected services."],
  "/platform": ["Platform", "Platform administration", "Manage platform configuration and access."],
};
export default function VisualWorkspace({ path }) {
 const [title, subtitle, description] = pages[path] || ["Workspace", "Coming into view", "This part of the original application is being restored."];
 return <main className="ifund-visual-workspace">
  <Link className="ifund-back-link" to="/dashboard"><ArrowLeft size={16}/> Dashboard</Link>
  <section className="ifund-workspace-hero"><div className="ifund-workspace-mark"><Sparkles size={28}/></div>
    <p className="eyebrow">INTERPLANETARY FUND</p><h1>{title}</h1><h2>{subtitle}</h2><p>{description}</p>
  </section>
  <section className="card ifund-workspace-notice"><LockKeyhole size={20}/>
    <div><strong>Visual preview</strong><p>This screen is a design preview. Its original features and live data have not yet been migrated. No financial or AI action is available here.</p></div>
  </section>
 </main>;
}
