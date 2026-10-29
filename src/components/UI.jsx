import { Link } from "react-router-dom";
export function Planet() {
  return (
    <svg width="42" height="42" viewBox="0 0 60 60" aria-hidden="true">
      <defs>
        <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#41ddff" />
          <stop offset="1" stopColor="#9a64f2" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="17" fill="url(#orb)" />
      <ellipse
        cx="30"
        cy="30"
        rx="28"
        ry="9"
        fill="none"
        stroke="#e5deff"
        strokeWidth="4"
        transform="rotate(-24 30 30)"
      />
    </svg>
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

const categoryLabels = {
  medical: "Medical", emergency: "Emergency", education: "Education",
  community: "Community", animals: "Animals", business: "Business",
  memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", environment: "Planet & Environment", other: "Other",
};
export function CampaignCard({ c }) {
  return (
    <Link className="card campaign" to={c.status === "draft" ? "/create?draft=" + encodeURIComponent(c.id) : "/campaign/" + c.id}>
      {c.cover_image_url
        ? <img src={c.cover_image_url} alt={c.title || "Campaign cover"} loading="lazy" />
        : <div className="campaign-placeholder" aria-hidden="true"><Planet /></div>}
      <small>
        {categoryLabels[c.category] || "Other"} · {c.status === "active" ? "Published" : c.status === "paused" ? "Paused" : "Draft"}
      </small>
      <h3>{c.title || "Untitled campaign"}</h3>
      <p>{c.status === "draft" ? "Private draft · Continue where you left off" : c.summary || "No summary yet"}</p>
      <strong>{"Goal: $" + Number(c.goal_amount || 0).toLocaleString()}</strong>
      {c.raised_amount != null && c.status !== "draft" &&
        <p>{"Raised: $" + Number(c.raised_amount).toLocaleString()}</p>}
    </Link>
  );
}
