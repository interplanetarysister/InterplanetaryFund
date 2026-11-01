import { authClient } from "@/api/auth";

// Connect only to isolated preview function; authenticated Supabase session required.
// This does not activate live AI inference, image rendering, payments or posting.
export async function requestCampaignDraft({ answers, details, goal }) {
  const client = authClient();
  const { data, error } = await client.functions.invoke("ifund-campaign-draft-preview", {
    body: { answers, details, goal },
  });
  if (error) throw new Error("The campaign preview service is unavailable. Your answers are unchanged.");
  if (!data || !Array.isArray(data.titles) || data.titles.length !== 5 ||
      !Array.isArray(data.summaries) || data.summaries.length !== 2 ||
      typeof data.story !== "string" || data.ai_inference !== false ||
      data.image_rendered !== false) {
    throw new Error("The campaign preview returned an invalid response.");
  }
  return { titles: data.titles, summaries: data.summaries, story: data.story,
           imagePrompt: typeof data.image_prompt === "string" ? data.image_prompt : "" };
}
