import { Link, useLocation } from "react-router-dom";
import "@/styles-publishing-workflow.css";

/**
 * A single connected workflow for agents, campaign messaging, artwork,
 * consent and reviewed delivery. "Approvals" is an in-page destination
 * within Communications, deliberately not a new route or publishing engine.
 */
export const PUBLISHING_WORKFLOW = Object.freeze([
  { id: "agents", title: "AI Team", href: "/agents" },
  { id: "draft", title: "Messages", href: "/communications" },
  { id: "creative", title: "Artwork", href: "/media-studio?tab=generator" },
  { id: "review", title: "Review & approvals", href: "/communications#reviewed-delivery" },
  { id: "connections", title: "Connections", href: "/connections" },
]);

export default function PublishingWorkflowNav({ current, campaignId }) {
  const location = useLocation();
  const activeId = location.pathname === "/communications" && location.hash === "#reviewed-delivery" ? "review" : current;
  const urlFor = item => {
    if (!campaignId || !["draft", "review"].includes(item.id)) return item.href;
    const suffix = item.id === "review" ? "#reviewed-delivery" : "";
    return "/communications?campaign=" + encodeURIComponent(campaignId) + suffix;
  };
  return <nav aria-label="Campaign creation and publishing workflow"
    className="ifund-workflow-nav" data-ifund-publishing-workflow>
    <p className="ifund-workflow-heading">Your campaign toolkit</p>
    <div className="ifund-workflow-items">
      {PUBLISHING_WORKFLOW.map(item => {
        const active = item.id === activeId;
        return <Link key={item.id} to={urlFor(item)}
          aria-current={active ? "page" : undefined}
          className={"ifund-workflow-link ifund-interactive"+(active ? " is-current" : "")}>
          {item.title}
        </Link>;
      })}
    </div>
    <p className="ifund-workflow-note">Draft, review and approve content before sharing. Connected accounts never authorize publishing by themselves.</p>
  </nav>;
}
