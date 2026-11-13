import { useState } from "react";

/** PULSE's free manual evidence checklist. No eligibility decisions or external submissions. */
export default function OpportunityEligibilityReview({opportunity}) {
  const [checked,setChecked]=useState({rules:false,region:false,deadline:false});
  const options=[
    ["rules","I have checked the official applicant-type and program eligibility requirements."],
    ["region","I have verified that my organization or campaign's region is permitted."],
    ["deadline","I checked the provider's current deadline or application window."],
  ];
  const complete=Object.values(checked).every(Boolean);
  return <details className="mt-3 rounded-xl border border-border p-3 text-sm">
    <summary className="cursor-pointer font-semibold">PULSE · Eligibility preparation checklist</summary>
    <p className="mt-2 text-muted-foreground">Read the current program requirements on the provider's official website. This preparation guide does not decide eligibility, submit an application, or disclose private campaign text.</p>
    <fieldset className="mt-3 space-y-2"><legend className="font-medium">Owner verification steps</legend>
      {options.map(([key,label])=><label key={key} className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={checked[key]}
          onChange={event=>setChecked(previous=>({...previous,[key]:event.target.checked}))}/>
        <span>{label}</span>
      </label>)}
    </fieldset>
    <p role="status" className="mt-3 font-medium">{complete
      ?"All three preparation checks acknowledged. Only the provider can confirm qualification."
      :"Review each requirement with the provider before applying."}</p>
    {opportunity?.deadline_date && <p className="mt-2 text-muted-foreground">Recorded deadline: {opportunity.deadline_date}. Verify updates on the official site.</p>}
  </details>;
}
