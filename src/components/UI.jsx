import { Link } from "react-router-dom";
// Independent lightweight derivative of the original official 1024px JPG logo.
export function Planet() {
  return (
    <img
      src="/ifund-logo-small.jpg"
      width="42"
      height="42"
      alt=""
      aria-hidden="true"
    />
  );
}

export function Message({ children, error }) {
  return children ? (
    <p role="status" className={error ? "notice error" : "notice"}>
      {children}
    </p>
  ) : null;
}

export function Loading() {
  return <p>Loading…</p>;
}

export function CampaignCard({ c }) {
  return (
    <Link className="card campaign" to={"/campaign/" + c.id}>
      {c.cover_image_url && (
        <img src={c.cover_image_url} alt="" loading="lazy" />
      )}
      <small>
        {c.category} · {c.status === "active" ? "Published" : "Draft"}
      </small>
      <h3>{c.title || "Untitled campaign"}</h3>
      <p>{c.summary || "No summary yet"}</p>
      <strong>Goal: ${Number(c.goal_amount || 0).toLocaleString()}</strong>
    </Link>
  );
}
