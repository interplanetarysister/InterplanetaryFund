import { Link } from "react-router-dom";

// A route-specific, accessible fail-closed state. This is NOT feature parity.
export default function MissingFeaturePage({ page }) {
  return <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
    <h1 className="font-display text-3xl font-bold">{page.title}</h1>
    <p role="status" className="rounded-xl border border-border bg-card p-5">
      This feature's independent backend and original controls have not yet passed
      migration validation. Its URL is reserved, but no actions or historical
      records are being simulated.
    </p>
    <p className="text-sm text-muted-foreground">
      Original feature: {page.source_component}. Verification is required before
      this feature can be enabled.
    </p>
    <Link to="/dashboard" className="text-primary underline">Dashboard</Link>
  </main>;
}
