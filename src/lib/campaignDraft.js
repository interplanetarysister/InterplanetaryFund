// Client-side contract for the deployed authenticated Supabase drafting function.
// Nothing in this helper writes campaign data or invokes paid AI providers.
const clean = (value, max = 1500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function campaignDraftRequest({ details, beneficiary, need, cause, goal }) {
  const description = clean(details, 1500);
  if (description.length < 12) {
    throw new Error("Describe your campaign in at least 12 characters.");
  }
  return {
    details: description,
    goal: Number(goal) > 0 ? Number(goal) : null,
    answers: {
      beneficiary: clean(beneficiary, 100),
      need: clean(need, 100),
      cause: clean(cause, 100),
    },
  };
}

export function normalizeCampaignDraft(data) {
  if (!data || !Array.isArray(data.titles) || !Array.isArray(data.summaries) ||
      typeof data.story !== "string") {
    throw new Error("Campaign draft service returned an unexpected response.");
  }
  const titles = data.titles.filter((s) => typeof s === "string" && s.trim()).slice(0, 5);
  const summaries = data.summaries.filter((s) => typeof s === "string" && s.trim()).slice(0, 2);
  if (!titles.length || !summaries.length || !data.story.trim()) {
    throw new Error("Campaign draft service returned an incomplete draft.");
  }
  return {
    titles,
    summaries,
    story: data.story,
    imagePrompt: clean(data.image_prompt, 2400),
    aiInference: data.ai_inference === true,
  };
}

export async function generateCampaignDraft(db, request) {
  if (!db) throw new Error("Account services are unavailable.");
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error("Sign in before generating a campaign draft.");
  }
  const { data, error } = await db.functions.invoke("ifund-campaign-draft-preview", {
    body: campaignDraftRequest(request),
  });
  if (error) throw new Error("Campaign drafting is temporarily unavailable.");
  return normalizeCampaignDraft(data);
}
