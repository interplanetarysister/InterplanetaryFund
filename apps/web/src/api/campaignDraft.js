// Permanent Cloudflare writing service. Native generation stores a private
// suggestion receipt; campaign content changes only when the owner saves it.
export function makeDraftRequest({ details, beneficiary, need, cause, goal }) {
  const text = String(details || "")
    .trim()
    .slice(0, 1500);
  if (text.length < 12)
    throw new Error("Provide at least 12 characters about your campaign.");
  const tidy = (v) =>
    String(v || "")
      .trim()
      .slice(0, 100);
  const goalAmount = Number(goal);
  return {
    details: text,
    answers: {
      beneficiary: tidy(beneficiary),
      need: tidy(need),
      cause: tidy(cause),
    },
    goal: Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount : null,
  };
}

export function validateDraftSuggestion(data, section = false) {
  if (section) {
    if (
      data?.assistance !== "assisted" ||
      data.ai_inference !== true ||
      typeof data.section !== "string" ||
      !data.section.trim() ||
      data.section.length > 6000
    )
      throw new Error("Drafting returned an incomplete section.");
    return {
      titles: [],
      summaries: [],
      story: data.section,
      imagePrompt: "",
      assistance: "assisted",
    };
  }
  const strings = (items, count, max) =>
    Array.isArray(items) &&
    items.length === count &&
    items.every(
      (value) =>
        typeof value === "string" && value.trim() && value.length <= max,
    );
  if (
    !data ||
    !strings(data.titles, 5, 160) ||
    !strings(data.summaries, 2, 600) ||
    typeof data.story !== "string" ||
    !data.story.trim() ||
    data.story.length > 15000 ||
    !["outline", "assisted"].includes(data.assistance) ||
    data.ai_inference !== (data.assistance === "assisted") ||
    typeof data.image_prompt !== "string" ||
    !data.image_prompt.trim() ||
    data.image_prompt.length > 2000
  ) {
    throw new Error("Drafting returned an incomplete suggestion.");
  }
  return {
    titles: data.titles,
    summaries: data.summaries,
    story: data.story,
    imagePrompt: typeof data.image_prompt === "string" ? data.image_prompt : "",
    assistance: data.assistance,
  };
}

export async function requestCampaignDraft(
  client,
  input,
  { requestId, fetcher = fetch } = {},
) {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth?.session?.access_token)
    throw new Error("Please sign in to prepare campaign suggestions.");
  const id = requestId || crypto.randomUUID();
  const response = await fetcher("/api/services/story_agent/campaign-preview", {
    method: "POST",
    headers: {
      authorization: "Bearer " + auth.session.access_token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...makeDraftRequest(input),
      request_id: id,
      ...(input.section ? { section: input.section } : {}),
    }),
    signal: AbortSignal.timeout(90000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Campaign suggestions are unavailable. Your current text was not changed.",
    );
  }
  const { data: current, error: changed } = await client.auth.getSession();
  const actor = auth.session.user?.id;
  if (
    changed ||
    !current?.session ||
    (actor
      ? current.session.user?.id !== actor
      : current.session.access_token !== auth.session.access_token)
  )
    throw new Error(
      "Your account changed. Reopen the writing assistant before continuing.",
    );
  if (response.status === 202) {
    if (data?.state !== "queued" || data.request_id !== id)
      throw new Error(
        "Your saved writing request could not be confirmed. Your current text is unchanged.",
      );
    throw Object.assign(
      new Error(
        "Your writing request is saved. Resume it here or in your writing assistant when capacity is available.",
      ),
      { code: "queued" },
    );
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error ||
          "Campaign suggestions are unavailable. Your current text was not changed.",
      ),
      { code: data.code },
    );
  return validateDraftSuggestion(data, Boolean(input.section));
}
