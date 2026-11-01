import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, BadgeCheck } from "lucide-react";
import { institutionTypes } from "./institutionTypes";

export default function InstitutionCard({ institution }) {
  return (
    <Link to={`/institutions/${institution.id}`} className="group bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-stone-800 to-stone-600 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-stone-900 group-hover:text-primary transition-colors flex items-center gap-1.5">
            <span className="truncate">{institution.name}</span>
            {institution.verification_status === "verified" && <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
          </p>
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{institution.mission || institution.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-stone-400">
        <Badge variant="secondary">{institutionTypes[institution.type] || institution.type}</Badge>
        {institution.offers_grants && <Badge variant="outline" className="text-emerald-700 border-emerald-200">Grants</Badge>}
        {institution.offers_matching_gifts && <Badge variant="outline" className="text-primary border-primary/20">Matching</Badge>}
        {institution.location && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {institution.location}</span>}
      </div>
    </Link>
  );
}