import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import InstitutionProfile from "@/components/institutions/InstitutionProfile";
import OpportunitiesTab from "@/components/institutions/OpportunitiesTab";
import ApplicationsTab from "@/components/institutions/ApplicationsTab";
import { Building2, MapPin, BadgeCheck, Loader2 } from "lucide-react";
import { institutionTypes } from "@/components/institutions/institutionTypes";
import PageError from "@/components/PageError";

export default function InstitutionDetail() {
  const { id } = useParams();
  const [institution, setInstitution] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, inst] = await Promise.all([base44.auth.me().catch(() => null), base44.entities.Institution.get(id)]);
        if (cancelled) return;
        setInstitution(inst);
        setIsOwner(!!me && inst?.created_by_id === me.id);
      } catch {
        if (!cancelled) setError("We couldn't load this institution. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  if (error) return <PageError message={error} onRetry={() => { setError(""); setLoading(true); setInstitution(null); setReloadKey((key) => key + 1); }} />;
  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!institution) {
    return <p className="text-center text-stone-400 py-20">Institution not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-start gap-4 mb-6">
        <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-600 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-white" />
        </span>
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900 flex items-center gap-2">
            {institution.name}
            {institution.verification_status === "verified" && <BadgeCheck className="w-6 h-6 text-emerald-600" />}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-stone-500">
            <Badge variant="secondary">{institutionTypes[institution.type] || institution.type}</Badge>
            {institution.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {institution.location}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          {isOwner && <TabsTrigger value="applications">Applications</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <InstitutionProfile institution={institution} />
        </TabsContent>
        <TabsContent value="opportunities">
          <OpportunitiesTab institution={institution} isOwner={isOwner} />
        </TabsContent>
        {isOwner && (
          <TabsContent value="applications">
            <ApplicationsTab institution={institution} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}