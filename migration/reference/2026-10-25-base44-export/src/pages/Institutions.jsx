import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import InstitutionCard from "@/components/institutions/InstitutionCard";
import CreateInstitutionDialog from "@/components/institutions/CreateInstitutionDialog";
import MyApplications from "@/components/institutions/MyApplications";
import { Search, Loader2 } from "lucide-react";
import { institutionTypes } from "@/components/institutions/institutionTypes";
import PageError from "@/components/PageError";

const programFilters = [
  { value: "all", label: "All" },
  { value: "offers_grants", label: "Grants" },
  { value: "offers_matching_gifts", label: "Matching Gifts" },
  { value: "offers_volunteer_program", label: "Volunteer Programs" },
];

export default function Institutions() {
  const [institutions, setInstitutions] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    base44.entities.Institution.list("-created_date", 100)
      .then(setInstitutions)
      .catch((e) => { console.error("Institutions load failed:", e?.name || "UnknownError"); setError("We couldn't load institutions. Please try again."); });
  }, [reloadKey]);

  if (error) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setInstitutions(null); setReloadKey((key) => key + 1); }} /></div>;
  }
  if (!institutions) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const q = query.toLowerCase();
  const filtered = institutions.filter(
    (i) =>
      (typeFilter === "all" || i.type === typeFilter) &&
      (programFilter === "all" || i[programFilter]) &&
      (!q ||
        i.name?.toLowerCase().includes(q) ||
        i.mission?.toLowerCase().includes(q) ||
        i.industry?.toLowerCase().includes(q) ||
        i.causes_supported?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Institutions</h1>
          <p className="text-stone-500 mt-1">Businesses, foundations, and organizations partnering with campaigns.</p>
        </div>
        <CreateInstitutionDialog />
      </div>

      <MyApplications />

      <div className="relative mt-8 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, mission, industry, cause, or location…" className="pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {programFilters.map((f) => (
          <button key={f.value} onClick={() => setProgramFilter(f.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              programFilter === f.value ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {[["all", "All types"], ...Object.entries(institutionTypes)].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === v ? "bg-primary text-primary-foreground" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-16">
          {institutions.length === 0 ? "No institutions yet — register the first one." : "No institutions match your filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((i) => <InstitutionCard key={i.id} institution={i} />)}
        </div>
      )}
    </div>
  );
}