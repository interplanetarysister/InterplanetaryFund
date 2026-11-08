// Guidance for the original five-choice campaign starting experience.
// These are writing paths, not Supabase campaign categories.
export const CAMPAIGN_WRITING_PATHS = Object.freeze([
  { id: "creative", title: "Creative project", guidance: "a creative project or artistic idea" },
  { id: "community", title: "My community", guidance: "helping a community and the people in it" },
  { id: "launch", title: "Launching a project", guidance: "launching a new project and explaining its purpose" },
  { id: "inspiring", title: "Inspiring", guidance: "a personal or inspiring cause told with care" },
  { id: "write", title: "Write it for me", guidance: "writing the campaign from the facts supplied by the user" },
]);

export function guidedCampaignDetails(pathId, userDetails) {
  const details = String(userDetails || "").trim();
  if (!details) return "";
  const path = CAMPAIGN_WRITING_PATHS.find(item => item.id === pathId);
  const guidance = path?.guidance || "the supplied facts";
  // Keep the existing Edge Function's 1,500-character request contract.
  const prefix = `Campaign writing approach: ${guidance}. `;
  // Preserve the user’s facts: omit optional guidance if it would exceed the API limit.
  return prefix.length + details.length <= 1500 ? prefix + details : details;
}
