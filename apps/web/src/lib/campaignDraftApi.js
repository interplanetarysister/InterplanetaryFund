import { authClient } from "@/api/auth";

// Fail closed on malformed suggestions; never apply arbitrary provider payloads.
function validChoices(items, expected, maxLength) {
  return Array.isArray(items) && items.length === expected &&
    items.every(item => typeof item === "string" && item.trim().length > 0 && item.length <= maxLength) &&
    new Set(items.map(item => item.trim().toLowerCase())).size === expected;
}

// Connect only to isolated preview function; authenticated Supabase session required.
// This does not activate live AI inference, image rendering, payments or posting.
export async function requestCampaignDraft({ answers, details, goal, variation = 0 }) {
  if (!Number.isInteger(variation) || variation < 0 || variation > 4)
    throw new Error("Invalid campaign preview variation.");
  const client = authClient();
  const { data, error } = await client.functions.invoke("ifund-campaign-draft-preview", {
    body: { answers, details, goal, variation },
  });
  if (error) throw new Error("The campaign preview service is unavailable. Your answers are unchanged.");
  if (!data || !validChoices(data.titles, 5, 120) ||
      !validChoices(data.summaries, 2, 600) ||
      typeof data.story !== "string" || !data.story.trim() ||
      data.story.length > 15000 || data.ai_inference !== false ||
      data.image_rendered !== false) {
    throw new Error("The campaign preview returned an invalid response.");
  }
  // Older deployed previews cannot claim to regenerate a different set.
  if (variation !== 0 && data.variation !== variation)
    throw new Error("Alternative drafts are not yet available on this service. Your current draft is unchanged.");
  return { titles: data.titles, summaries: data.summaries, story: data.story,
           imagePrompt: typeof data.image_prompt === "string" ? data.image_prompt : "" };
}
