// Permanent Cloudflare writing service. Native generation stores a private
// suggestion receipt; campaign content changes only when the owner saves it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makeDraftRequest({ details, beneficiary, need, cause, goal, campaign_id = null, section = null }) {
  const text = String(details || "").trim();
  const maxDetails = section ? 4000 : 3000;
  if (text.length < 12)
    throw new Error("Provide at least 12 characters about your campaign.");
  if (text.length > maxDetails)
    throw new Error("Keep campaign writing context to " + maxDetails.toLocaleString("en-US") + " characters or fewer. Your text was not shortened.");
  if (campaign_id != null && (typeof campaign_id !== "string" || !UUID.test(campaign_id)))
    throw new Error("The campaign reference could not be verified.");
  const tidy = (v) => {
    const value = String(v || "").trim();
    if (value.length > 100)
      throw new Error("Keep each beneficiary, need and cause detail to 100 characters or fewer. Your text was not shortened.");
    return value;
  };
  const goalAmount = Number(goal);
  return {
    details: text,
    answers: {
      beneficiary: tidy(beneficiary),
      need: tidy(need),
      cause: tidy(cause),
    },
    goal: Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount : null,
    campaign_id: campaign_id || null,
  };
}

export function validateDraftSuggestion(data, section = false) {
  if (section) {
    if (
      data?.assistance !== "assisted" ||
      data.ai_inference !== true ||
      typeof data.section !== "string" ||
      !data.section.trim() ||
      data.section.length > 4000
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
    !strings(data.titles, 5, 150) ||
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
  const id = requestId || globalThis.crypto?.randomUUID?.();
  if (!UUID.test(id || ""))
    throw new Error("A secure writing request reference could not be created.");
  let response;
  try {
    response = await fetcher("/api/services/story_agent/campaign-preview", {
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
  } catch {
    throw new Error("Campaign suggestions are unavailable. Your current text was not changed.");
  }
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


/** Preserve the creator's existing section-regeneration interface. */
export async function requestCampaignSection(
  client,
  { details, section, campaign_id = null },
  options = {},
) {
  const context = String(details || "").trim();
  const original = String(section || "").trim();
  if (context.length < 12 || context.length > 4000)
    throw new Error("Provide 12 to 4,000 characters of campaign context. Nothing was changed.");
  if (!original || original.length > 4000)
    throw new Error("Keep the selected story section to 4,000 characters or fewer. Nothing was changed.");
  const result = await requestCampaignDraft(
    client,
    { details: context, section: original, campaign_id },
    options,
  );
  return { section: result.story };
}
