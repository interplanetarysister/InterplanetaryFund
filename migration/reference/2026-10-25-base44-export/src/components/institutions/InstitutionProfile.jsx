import React from "react";
import { Badge } from "@/components/ui/badge";
import { Globe, Mail, Heart, Factory, BadgeCheck } from "lucide-react";

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-stone-700">{value}</p>
      </div>
    </div>
  );
}

export default function InstitutionProfile({ institution }) {
  const programs = [
    institution.offers_grants && "Grants & funding programs",
    institution.offers_matching_gifts && "Matching gifts",
    institution.offers_volunteer_program && "Employee volunteer program",
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {institution.mission && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
          <h3 className="font-semibold text-sm text-stone-900 mb-2">Mission</h3>
          <p className="text-sm text-stone-600 whitespace-pre-line">{institution.mission}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 grid sm:grid-cols-2 gap-4">
        <Row icon={Factory} label="Industry" value={institution.industry} />
        <Row icon={Heart} label="Causes supported" value={institution.causes_supported} />
        <Row
          icon={Globe}
          label="Website"
          value={institution.website ? (
            <a href={institution.website} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 break-all">
              {institution.website}
            </a>
          ) : null}
        />
        <Row icon={Mail} label="Contact" value={institution.contact_email} />
      </div>

      {programs.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
          <h3 className="font-semibold text-sm text-stone-900 mb-3">Programs offered</h3>
          <div className="flex flex-wrap gap-2">
            {programs.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-stone-900 mb-2 flex items-center gap-1.5">
          <BadgeCheck className="w-4 h-4 text-stone-400" /> Transparency
        </h3>
        <p className="text-sm text-stone-600 capitalize">
          Verification status: <span className="font-medium">{institution.verification_status?.replace("_", " ") || "unverified"}</span>
        </p>
        <p className="text-xs text-stone-400 mt-1">
          Verification reflects only confirmed facts and is not an endorsement.
        </p>
      </div>
    </div>
  );
}