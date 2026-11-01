import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MetricsGrid from "@/components/analytics/MetricsGrid";
import RevenueChart from "@/components/analytics/RevenueChart";
import CampaignPerformance from "@/components/analytics/CampaignPerformance";
import AlertCenter from "@/components/analytics/AlertCenter";
import ReportsPanel from "@/components/analytics/ReportsPanel";
import { Loader2 } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import PageError from "@/components/PageError";

const SAFE_ANALYTICS_ERROR = "We couldn't load your analytics. Please try again.";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isEntityList = (value) => Array.isArray(value) && value.every((item) => isRecord(item) && isNonEmptyString(item.id));
const isDonationList = (value) => Array.isArray(value) && value.every((item) => isRecord(item) && isNonEmptyString(item.id) && Number.isFinite(Number(item.amount)));
const isFunctionDonationResponse = (value) => isRecord(value) && isDonationList(value.data?.donations);

function normalizeAnalyticsPayload({ campaigns, communities, institutions, volunteerOpps, applications, opportunities, donations, signups }) {
  if (!isEntityList(campaigns) || !isEntityList(communities) || !isEntityList(institutions) || !isEntityList(volunteerOpps) || !isEntityList(applications) || !isEntityList(opportunities) || !isDonationList(donations) || !isEntityList(signups)) {
    throw new Error("Malformed analytics response");
  }
  return { campaigns, communities, institutions, volunteerOpps, applications, opportunities, donations, signups };
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let mounted = true;
    const requestId = ++requestGeneration.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const me = await base44.auth.me();
        if (!isRecord(me) || !isNonEmptyString(me.id)) throw new Error("Malformed auth response");
        if (!mounted || requestId !== requestGeneration.current) return;

        const [campaigns, communities, institutions, volunteerOpps, applications, opportunities] = await Promise.all([
          base44.entities.Campaign.filter({ created_by_id: me.id }),
          base44.entities.Community.list("-created_date", 200),
          base44.entities.Institution.list("-created_date", 200),
          base44.entities.VolunteerOpportunity.list("-created_date", 200),
          base44.entities.GrantApplication.filter({ applicant_user_id: me.id }),
          base44.entities.InstitutionOpportunity.list("-created_date", 200),
        ]);

        if (!isEntityList(campaigns) || !isEntityList(communities) || !isEntityList(institutions) || !isEntityList(volunteerOpps) || !isEntityList(applications) || !isEntityList(opportunities)) {
          throw new Error("Malformed analytics entity response");
        }

        const dResults = await Promise.all(
          campaigns.map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))
        );
        if (!dResults.every(isFunctionDonationResponse)) throw new Error("Malformed donation response");
        const donationLists = dResults.map((r) => r.data.donations);

        const signupLists = await Promise.all(
          volunteerOpps.map((o) => base44.entities.VolunteerSignup.filter({ opportunity_id: o.id }))
        );
        if (!signupLists.every(isEntityList)) throw new Error("Malformed signup response");

        const nextData = normalizeAnalyticsPayload({
          campaigns,
          communities,
          institutions,
          volunteerOpps,
          applications,
          opportunities,
          donations: donationLists.flat(),
          signups: signupLists.flat(),
        });

        if (mounted && requestId === requestGeneration.current) {
          setData(nextData);
          setError(null);
        }
      } catch {
        if (mounted && requestId === requestGeneration.current) setError(SAFE_ANALYTICS_ERROR);
      } finally {
        if (mounted && requestId === requestGeneration.current) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (error && !data) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={SAFE_ANALYTICS_ERROR} onRetry={() => setRefreshKey((k) => k + 1)} /></div>;
  }
  if (!data && loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Loading analytics" /></div>;
  }
  if (!data) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={SAFE_ANALYTICS_ERROR} onRetry={() => setRefreshKey((k) => k + 1)} /></div>;
  }

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Command Center</h1>
      <p className="text-stone-500 mt-1 mb-6">
        What happened, why, what's likely next, and what to do about it.
      </p>
      {error && <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{SAFE_ANALYTICS_ERROR} <button type="button" className="underline" onClick={() => setRefreshKey((k) => k + 1)}>Retry</button></div>}

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <MetricsGrid data={data} />
          <RevenueChart donations={data.donations} />
          <CampaignPerformance campaigns={data.campaigns} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertCenter campaigns={data.campaigns} opportunities={data.opportunities} communities={data.communities} volunteerOpps={data.volunteerOpps} applications={data.applications} />
        </TabsContent>
        <TabsContent value="reports"><ReportsPanel data={data} /></TabsContent>
      </Tabs>
    </PullToRefresh>
  );
}
