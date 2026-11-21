import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogIn, UserRound, X } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

const HELP = Object.freeze({
  "/onboarding": ["Welcome to your workspace", "Your AI team helps with writing, budgets, outreach and strategy. Use the floating account button to sign in or open your profile. The nearby Ask IFund button opens your agent team on every page except Home."],
  "/dashboard": ["Your dashboard", "See your campaigns, followed updates and shortcuts. Ask IFund can stay open as you move around the site."],
  "/create": ["Build your campaign", "Start with a short idea. Add optional details if helpful, then use the icon steps to write, review and choose when to publish."],
  "/agents": ["Meet your AI team", "NEXUS coordinates specialists; STORY writes, ORBIT explains finances, POLARIS plans, PULSE finds appropriate opportunities, and the other agents help with growth, messages and connections. Recommendations never automatically spend or publish."],
  "/connections": ["Connect when you choose", "Review available services and authorize a connection only when you decide to connect it. You can disconnect later."],
  "/finances": ["Your financial center", "See verified receipts separately from pending amounts. Withdrawals and payments require their own security checks."],
  "/discover": ["Discover campaigns", "Browse published campaigns and learn about the people and causes behind them."],
  "/profile": ["Your profile", "Set your public information, privacy and account choices. Use the floating account shortcut anywhere."],
  "/permissions": ["Your permissions", "Choose what the agents may read or suggest. Posting, payments and outside services have separate controls."],
  "/social": ["Your community feed", "Follow updates and share what you choose. Nothing is posted by visiting this page."],
  "/community": ["Community discussions", "Join conversations, follow topics and report content when appropriate."],
  "/analytics": ["Campaign insights", "Review outcomes and recommendations using verified records and clearly labeled estimates."],
  "/campaigns": ["Your campaigns", "Return to saved drafts and published campaigns here."],
});
export const tourKey = id => "ifund-guided-tour-v1:" + id;
const pageKey = (id,route) => "ifund-guided-page-v1:" + id + ":" + route;

/** One-time, per-account and per-page walkthrough; local only, never a consent grant. */
export default function SiteTour() {
  const { user } = useAuthSession();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [route, setRoute] = useState("");
  const id = user?.id && !user.is_anonymous && user.email_confirmed_at ? user.id : null;
  const page = Object.keys(HELP).find(key => pathname === key || (key === "/campaigns" && pathname.startsWith("/campaigns/")));
  useEffect(() => {
    setVisible(false);
    if (!id || !page) return;
    try {
      // The registration onboarding screen is the sole activation point.
      if (pathname === "/onboarding") localStorage.setItem(tourKey(id), "enabled");
      if (localStorage.getItem(tourKey(id)) !== "enabled" ||
          localStorage.getItem(pageKey(id,page)) === "seen") return;
      setRoute(page);
      setVisible(true);
    } catch { /* Storage unavailable: no repeated tour or broken navigation. */ }
  }, [id, page, pathname]);
  function acknowledge() {
    try { if (id && route) localStorage.setItem(pageKey(id,route),"seen"); } catch {}
    setVisible(false);
  }
  if (!visible || !HELP[route]) return null;
  const [title, explanation] = HELP[route];
  return <aside aria-label="Your one-time site guide" role="dialog" aria-modal="false" className="ifund-tour-card">
    <button type="button" aria-label="Dismiss this page tour" onClick={acknowledge} className="absolute right-3 top-3 rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-cyan-300">Getting started · One-time tip</p>
    <h2 className="pr-7 text-lg font-bold">{title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">{explanation}</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={acknowledge} className="min-h-11 rounded-xl bg-cyan-300 px-4 font-semibold text-slate-950">Got it</button>
      <Link onClick={acknowledge} className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline" to="/agents">Meet the agents</Link>
    </div>
  </aside>;
}
