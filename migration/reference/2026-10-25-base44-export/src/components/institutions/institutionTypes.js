export const institutionTypes = {
  business: "Business",
  nonprofit: "Nonprofit",
  foundation: "Foundation",
  corporate_foundation: "Corporate Foundation",
  school: "School",
  university: "University",
  hospital: "Hospital",
  faith: "Faith-Based",
  community_org: "Community Organization",
  government: "Government",
  association: "Association",
  research: "Research Institution",
  ngo: "International NGO",
  other: "Other",
};

export const opportunityCategories = {
  grant: "Grant",
  funding_program: "Funding Program",
  matching_gift: "Matching Gift",
  in_kind: "In-Kind Donation",
  professional_services: "Professional Services",
  facility: "Facility",
  equipment: "Equipment",
  volunteers: "Volunteers",
  mentorship: "Mentorship",
  training: "Training",
  research: "Research",
  other: "Other",
};

export const applicationStatuses = {
  submitted: { label: "Submitted", className: "bg-stone-100 text-stone-600 hover:bg-stone-100" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  awarded: { label: "Awarded", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  declined: { label: "Declined", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  withdrawn: { label: "Withdrawn", className: "bg-stone-100 text-stone-500 hover:bg-stone-100" },
};