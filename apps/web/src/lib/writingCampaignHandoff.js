const KEY = "ifund-writing-campaign-handoff-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE = 60 * 60 * 1000;
export class WritingHandoffError extends Error {}

function copyText(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result = {};
  for (const [key, max] of [
    ["title", 160],
    ["summary", 500],
    ["story", 12000],
  ]) {
    if (
      typeof raw[key] !== "string" ||
      !raw[key].trim() ||
      raw[key].length > max
    )
      return null;
    result[key] = raw[key];
  }
  return result;
}

// A tab-only copy for human review, not a campaign write or execution receipt.
// The existing saved suggestion remains the authoritative writing record.
export function rememberWritingHandoff(
  storage,
  { ownerId, draft, selection, campaignId = null },
  { now = Date.now(), id = crypto.randomUUID() } = {},
) {
  if (
    !UUID.test(ownerId || "") ||
    !UUID.test(id) ||
    !UUID.test(draft?.id || "") ||
    draft.status !== "draft" ||
    !Number.isFinite(now) ||
    (campaignId !== null && !UUID.test(campaignId))
  )
    throw new WritingHandoffError(
      "Open a current saved writing draft to continue.",
    );
  if (draft.campaign_id && draft.campaign_id !== campaignId)
    throw new WritingHandoffError(
      "Open the campaign associated with this writing draft.",
    );
  const accepted = draft.source_system === "ifund_story_accepted_v1";
  if (!accepted && draft.source_system !== "ifund_story_v1")
    throw new WritingHandoffError(
      "This writing draft is not available for the campaign editor.",
    );
  const payload = draft.payload;
  const copy = copyText(
    accepted
      ? selection?.wording || payload
      : {
          title: Number.isInteger(selection?.title_index)
            ? payload?.titles?.[selection.title_index]
            : null,
          summary: Number.isInteger(selection?.summary_index)
            ? payload?.summaries?.[selection.summary_index]
            : null,
          story: payload?.story,
        },
  );
  if (!copy)
    throw new WritingHandoffError(
      "Choose a title, short description and complete story first.",
    );
  const record = {
    version: 1,
    id,
    owner_id: ownerId,
    draft_id: draft.id,
    campaign_id: campaignId,
    created_at: now,
    copy,
  };
  try {
    storage.setItem(KEY, JSON.stringify(record));
  } catch {
    throw new WritingHandoffError(
      "Your browser could not open the campaign editor. Your writing is still saved.",
    );
  }
  return {
    id,
    target: campaignId
      ? `/campaigns/${encodeURIComponent(campaignId)}/edit?writing=${encodeURIComponent(id)}`
      : `/create?writing=${encodeURIComponent(id)}`,
  };
}

export function readWritingHandoff(
  storage,
  { ownerId, id, campaignId = null, now = Date.now() },
) {
  if (!UUID.test(ownerId || "") || !UUID.test(id || "")) return null;
  let record;
  try {
    record = JSON.parse(storage.getItem(KEY));
  } catch {
    return null;
  }
  if (
    !record ||
    record.version !== 1 ||
    record.id !== id ||
    record.owner_id !== ownerId ||
    record.campaign_id !== campaignId ||
    !UUID.test(record.draft_id || "") ||
    !Number.isFinite(record.created_at) ||
    now < record.created_at ||
    now - record.created_at > MAX_AGE
  )
    return null;
  const copy = copyText(record.copy);
  return copy ? { id, owner_id: ownerId, campaign_id: campaignId, copy } : null;
}

export function forgetWritingHandoff(
  storage,
  { ownerId, id, campaignId = null },
) {
  const current = readWritingHandoff(storage, { ownerId, id, campaignId });
  if (current) storage.removeItem(KEY);
}
