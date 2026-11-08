// Existing Supabase draft generator transport; no paid AI and no automatic persistence.
export function makeDraftRequest({ details, beneficiary, need, cause, goal }) {
  const text = String(details || "").trim();
  if (text.length < 12) throw new Error("Provide at least 12 characters about your campaign.");
  if (text.length > 1500) throw new Error("Keep campaign writing details to 1,500 characters. Your text was not shortened.");
  const tidy = (v) => String(v || "").trim().slice(0, 100);
  const goalAmount = Number(goal);
  return {
    details: text,
    answers: { beneficiary: tidy(beneficiary), need: tidy(need), cause: tidy(cause) },
    goal: Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount : null,
  };
}

export function validateDraftSuggestion(data) {
  const validStrings = (values, count, max) =>
    Array.isArray(values) &&
    values.length === count &&
    values.every((value) =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= max &&
      !/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/.test(value),
    );
  if (
    !data ||
    !validStrings(data.titles, 5, 150) ||
    !validStrings(data.summaries, 2, 600) ||
    typeof data.story !== "string" ||
    !data.story.trim() ||
    data.story.length > 15000
  ) {
    throw new Error("Drafting returned an incomplete suggestion. Please generate the five titles, two descriptions and complete story again.");
  }
  return {
    titles: data.titles.map((value) => value.trim()),
    summaries: data.summaries.map((value) => value.trim()),
    story: data.story.trim(),
    imagePrompt: typeof data.image_prompt === "string" ? data.image_prompt.slice(0, 2000) : "",
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
