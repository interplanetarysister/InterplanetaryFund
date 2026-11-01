// Existing Supabase draft generator transport; no paid AI and no automatic persistence.
export function makeDraftRequest({ details, beneficiary, need, cause, goal }) {
  const text = String(details || "").trim().slice(0, 1500);
  if (text.length < 12) throw new Error("Provide at least 12 characters about your campaign.");
  const tidy = (v) => String(v || "").trim().slice(0, 100);
  const goalAmount = Number(goal);
  return {
    details: text,
    answers: { beneficiary: tidy(beneficiary), need: tidy(need), cause: tidy(cause) },
    goal: Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount : null,
  };
}

export function validateDraftSuggestion(data) {
  if (!data || !Array.isArray(data.titles) || !Array.isArray(data.summaries) ||
      typeof data.story !== "string" || !data.story.trim()) {
    throw new Error("Drafting returned an incomplete suggestion.");
  }
  return {
    titles: data.titles.filter(v => typeof v === "string" && v.trim()).slice(0, 5),
    summaries: data.summaries.filter(v => typeof v === "string" && v.trim()).slice(0, 2),
    story: data.story,
    imagePrompt: typeof data.image_prompt === "string" ? data.image_prompt : "",
  };
}

export async function requestCampaignDraft(client, input) {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth?.session?.access_token)
    throw new Error("Please sign in to prepare campaign suggestions.");
  const { data, error } = await client.functions.invoke("ifund-campaign-draft-preview", {
    body: makeDraftRequest(input),
  });
  if (error) throw new Error("Campaign suggestions are unavailable. Your current text was not changed.");
  return validateDraftSuggestion(data);
}
