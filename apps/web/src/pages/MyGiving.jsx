import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, Flame, HandCoins, LoaderCircle, RefreshCw, Repeat } from "lucide-react";
import { authClient } from "@/api/auth";

const CAMPAIGN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = value => "$" + Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const paymentLabel = method => ({
  paypal: "PayPal",
  googlepay: "Google Pay",
  applepay: "Apple Pay",
  cashapp: "Cash App",
  stripe: "Card",
  stripe_crypto: "Crypto",
  other: "Other",
}[method] || "Other");
const dateLabel = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleDateString();
};

function CampaignName({ id, title }) {
  const label = title || "Campaign";
  return CAMPAIGN_UUID.test(String(id || ""))
    ? <Link to={"/campaign/" + encodeURIComponent(id)} className="block truncate text-sm font-medium hover:text-primary">{label}</Link>
    : <span className="block truncate text-sm font-medium">{label}</span>;
}

export default function MyGiving() {
  const [donations, setDonations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const client = authClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("Sign in to view your giving history.");
      const response = await fetch("/api/me/giving", {
        method: "GET", cache: "no-store",
        headers: { authorization: "Bearer " + session.access_token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.donations) ||
          data.donations.some(row => !row || typeof row.id !== "string" ||
            !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0 ||
            (row.created_date != null && !Number.isFinite(Date.parse(row.created_date))) ||
            typeof row.is_recurring !== "boolean")) {
        throw new Error(data.error || "Giving history could not be verified.");
      }
      setDonations(data.donations);
    } catch (cause) {
      setError(cause?.message || "We couldn't load your giving history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const rows = donations || [];
    return {
      lifetime: rows.reduce((sum, row) => sum + Number(row.amount), 0),
      support: rows.reduce((sum, row) => sum + Number(row.platform_support_amount || 0), 0),
      monthly: rows.filter(row => row.is_recurring && (row.recurring_status || "active") === "active")
        .reduce((sum, row) => sum + Number(row.amount), 0),
      campaigns: new Set(rows.map(row => row.campaign_id)).size,
    };
  }, [donations]);
  const recurring = useMemo(() => (donations || []).filter(row => row.is_recurring), [donations]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">My Giving</h1>
        <p className="mt-2 text-muted-foreground">Your generosity, all in one place.</p>
        <p className="mt-1 text-xs text-muted-foreground">Only verified donations are included. Pending, failed, or unverified gifts are excluded.</p>
      </header>

      {error && (
        <section role="alert" className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm">{error}</p>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </button>
        </section>
      )}

      {loading && donations === null ? (
        <div role="status" className="flex min-h-56 items-center justify-center">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading confirmed gifts…</span>
        </div>
      ) : error && donations === null ? null : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lifetime Giving</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></span>
              </div>
              <p className="font-display text-3xl">{money(totals.lifetime)}</p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Monthly Giving</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><Repeat className="h-4 w-4 text-primary" /></span>
              </div>
              <p className="font-display text-3xl">{money(totals.monthly)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Active recurring gifts</p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Campaigns Supported</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><Flame className="h-4 w-4 text-primary" /></span>
              </div>
              <p className="font-display text-3xl">{totals.campaigns}</p>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Optional IFund Support</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><HandCoins className="h-4 w-4 text-primary" /></span>
              </div>
              <p className="font-display text-3xl">{money(totals.support)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Recorded separately from campaign gifts</p>
            </section>
          </div>

          {recurring.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Recurring gifts</h2>
              <div className="space-y-3">
                {recurring.map(donation => (
                  <div key={donation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="min-w-0">
                      <CampaignName id={donation.campaign_id} title={donation.campaign_title} />
                      <p className="mt-1 text-sm text-muted-foreground">{money(donation.amount)} / month</p>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold capitalize text-muted-foreground">
                      {donation.recurring_status || "active"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Donation history</h2>
              <button type="button" onClick={() => void load()} disabled={loading}
                className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-50">
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </button>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 shadow-sm sm:px-5">
              {donations?.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No confirmed donations yet.</p>
                  <Link to="/discover" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Find a cause</Link>
                </div>
              ) : (
                donations?.map(donation => (
                  <div key={donation.id} className="flex items-center justify-between gap-3 border-b border-border/70 py-4 last:border-0">
                    <div className="min-w-0">
                      <CampaignName id={donation.campaign_id} title={donation.campaign_title} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateLabel(donation.created_date)} · {paymentLabel(donation.payment_method)} · Confirmed
                        {donation.is_recurring ? " · Recurring" : ""}
                      </p>
                      {Number(donation.platform_support_amount || 0) > 0 &&
                        <p className="mt-1 text-xs text-muted-foreground">Optional IFund support: {money(donation.platform_support_amount)}</p>}
                      {donation.processing_fee != null &&
                        <p className="mt-1 text-xs text-muted-foreground">Processor fee: {money(donation.processing_fee)}</p>}
                      {donation.total_charged != null &&
                        <p className="mt-1 text-xs text-muted-foreground">Total charged: {money(donation.total_charged)}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{money(donation.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
