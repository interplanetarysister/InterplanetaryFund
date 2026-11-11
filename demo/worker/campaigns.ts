import { categories, demand, uuid, type DB } from "./core.ts";
import type { Campaign, User } from "./types.ts";
export const publicCampaignFields =
  "id,title,summary,story,category,goal_cents,status,organizer,location,latitude,longitude,image_path,fictional,version,owner_id,ai_request_ids";
export function campaignInput(input: Record<string, unknown>) {
  const text = (k: string, min: number, max: number) => {
    const s = input[k];
    demand(
      typeof s === "string" && s.trim().length >= min && s.length <= max,
      "Review " + k,
    );
    return s.trim();
  };
  const title = text("title", 5, 120),
    summary = text("summary", 10, 600),
    organizer = text("organizer", 3, 80),
    location = text("location", 3, 100);
  demand(categories.includes(String(input.category)), "Choose a category");
  demand(
    input.status === "draft" || input.status === "published",
    "Invalid campaign status",
  );
  demand(
    Number.isSafeInteger(input.goal_cents) &&
      Number(input.goal_cents) >= 100 &&
      Number(input.goal_cents) <= 100000000,
    "Goal must be $1 to $1,000,000",
  );
  const story = input.story;
  demand(
    Array.isArray(story) &&
      story.length >= 1 &&
      story.length <= 8 &&
      story.every(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof s.heading === "string" &&
          s.heading.length >= 3 &&
          s.heading.length <= 100 &&
          typeof s.text === "string" &&
          s.text.length >= 10 &&
          s.text.length <= 4000,
      ),
    "Review story sections",
  );
  demand(
    Number.isFinite(input.latitude) &&
      Math.abs(Number(input.latitude)) <= 90 &&
      Number.isFinite(input.longitude) &&
      Math.abs(Number(input.longitude)) <= 180,
    "Invalid synthetic location",
  );
  const image = input.image_path;
  demand(
    image === null ||
      image === "" ||
      (typeof image === "string" &&
        /^\/api\/media\/[0-9a-f-]{36}$/.test(image)),
    "Use a demo upload or generated artwork",
  );
  const ids = input.ai_request_ids || [];
  demand(
    Array.isArray(ids) && ids.length <= 40 && ids.every(uuid),
    "Invalid AI execution references",
  );
  return {
    title,
    summary,
    organizer,
    location,
    category: String(input.category),
    status: input.status,
    goal_cents: Number(input.goal_cents),
    story: story as Campaign["story"],
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    image_path: image || null,
    ai_request_ids: ids,
    fictional: true as const,
  };
}
export async function validateMediaAndAI(
  db: DB,
  user: User,
  input: ReturnType<typeof campaignInput>,
) {
  if (input.image_path) {
    const media = await db.rows<{ owner_id: string }>(
      "media",
      "?id=eq." +
        String(input.image_path).split("/").at(-1) +
        "&select=owner_id",
    );
    demand(
      media[0]?.owner_id === user.id,
      "You can only use your own demo media",
      403,
    );
  }
  if (input.ai_request_ids.length) {
    const runs = await db.rows<{ id: string }>(
      "ai_runs",
      `?select=id&user_id=eq.${user.id}&status=eq.succeeded&id=in.(${input.ai_request_ids.join(",")})`,
    );
    demand(
      runs.length === new Set(input.ai_request_ids).size,
      "AI execution references must belong to your demo account",
      403,
    );
  }
}
export async function withTotals(db: DB, campaigns: Campaign[]) {
  if (!campaigns.length) return campaigns;
  const totals = await db.rpc<
    { campaign_id: string; raised_cents: number; donor_count: number }[]
  >("totals", { p_ids: campaigns.map((c) => c.id) });
  return campaigns.map((c) => {
    const total = totals.find((t) => t.campaign_id === c.id);
    return {
      ...c,
      raised_cents: total?.raised_cents || 0,
      donor_count: total?.donor_count || 0,
    };
  });
}
