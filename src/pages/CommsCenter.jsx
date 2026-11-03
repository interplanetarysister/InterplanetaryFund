import { Link } from "react-router-dom";
import { MessageCircle, ShieldCheck, Mail, Radio } from "lucide-react";

export default function CommsCenter() {
 return <main className="ifund-comms">
  <section className="ifund-workspace-hero"><MessageCircle size={30} aria-hidden="true"/><p className="eyebrow">YOUR COMMUNICATIONS BRIDGE</p><h1>Comms Center</h1><p>Keep campaign conversations, community updates, and connected channels easy to find.</p></section>
  <section className="card"><h2><ShieldCheck size={20} aria-hidden="true"/> Connection status</h2><p>External provider messages cannot be sent or synchronized here until those integrations are configured and authorized. No messages will be fabricated.</p></section>
  <div className="ifund-dashboard-feature-grid">
   <section className="card"><Mail size={25} aria-hidden="true"/><h2>Signal Inbox</h2><p>Review your campaign messaging workspace and incoming conversation status.</p><Link to="/inbox">Open inbox</Link></section>
   <section className="card"><Radio size={25} aria-hidden="true"/><h2>Community Hub</h2><p>Share updates with the Interplanetary Fund community.</p><Link to="/community">Visit community</Link></section>
   <section className="card"><MessageCircle size={25} aria-hidden="true"/><h2>Mission Links</h2><p>Review social and fundraising providers before enabling communication.</p><Link to="/connections">Manage connections</Link></section>
   <section className="card"><ShieldCheck size={25} aria-hidden="true"/><h2>Signal Alerts</h2><p>Review account-specific notifications.</p><Link to="/notifications">See alerts</Link></section>
  </div>
 </main>;
}
