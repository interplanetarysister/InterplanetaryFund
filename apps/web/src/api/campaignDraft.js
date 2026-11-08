// Existing Supabase draft generator transport; no paid AI and no automatic persistence.
export function makeDraftRequest({ details, beneficiary, need, cause, goal }) {
  const text = String(details || "").trim();
  if (text.length < 12) throw new Error("Provide at least 12 characters about your campaign.");
  if (text.length > 1500) throw new Error("Keep campaign writing details to 1,500 characters. Your text was not shortened.");
  const tidy = (v) => {
    const value = String(v || "").trim();
    if (value.length > 100)
      throw new Error("Keep each beneficiary, need and cause detail to 100 characters or fewer. Your text was not shortened.");
    return value;
  };
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
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
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


/** Request one owner-reviewed story section through the authenticated Story Agent. */
export async function requestCampaignSection(client, { details, section, campaign_id = null }) {
  const context = String(details || "").trim();
  const original = String(section || "").trim();
  if (context.length < 12 || context.length > 4000) {
    throw new Error("Provide 12 to 4,000 characters of campaign context. Nothing was changed.");
  }
  if (!original || original.length > 4000) {
    throw new Error("Keep the selected story section to 4,000 characters or fewer. Nothing was changed.");
  }
  if (campaign_id != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaign_id)) {
    throw new Error("The campaign reference could not be verified.");
  }
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth?.session?.access_token) {
    throw new Error("Sign in to regenerate a story section.");
  }
  const requestId = globalThis.crypto?.randomUUID?.();
  if (!requestId) throw new Error("A secure request reference could not be created.");
  let response;
  try {
    response = await fetch("/api/services/story_agent/drafts", {
      method: "POST",
      headers: {
        authorization: "Bearer " + auth.session.access_token,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        request_id: requestId,
        details: context,
        section: original,
        campaign_id,
      }),
    });
  } catch {
    throw new Error("The Story Agent could not be reached. Your current section was not changed.");
  }
  const result = await response.json().catch(() => ({}));
  const replacement = result?.draft?.payload?.section;
  if (!response.ok || typeof replacement !== "string" || !replacement.trim()) {
    throw new Error(
      result?.state === "queued" || response.status === 202
        ? "The section request is queued or unavailable. No replacement was applied."
        : result?.error || "A verified replacement section was not returned. Your current section was not changed.",
    );
  }
  if (replacement.length > 6000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(replacement)) {
    throw new Error("The Story Agent returned an invalid section. Your current section was not changed.");
  }
  return { section: replacement.trim() };
}
