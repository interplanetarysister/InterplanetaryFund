// Disaster check-ins: in-app only. When an authoritative disaster alert
// matches a campaign's area, the platform asks that campaign's owner — once
// per disaster — whether they need emergency assistance. No email is sent in
// Phase 1, nothing is published, and no money moves. The answer RPC is
// server-side: "yes" sets the campaign's disaster_relief flag and queues a
// promotion draft; "no" is recorded as final for that event and never re-asked.
import { isVerifiedEmailUser } from "./verifiedEmailUser.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownerId(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !isVerifiedEmailUser(data?.user) || !UUID.test(data?.user?.id || ""))
    throw new Error("Sign in to view your disaster check-ins.");
  return data.user.id;
}

export function normalizeDisasterCheckin(row = {}) {
  return {
    checkin_id: row.checkin_id ?? null,
    alert_id: row.alert_id ?? null,
    campaign_id: row.campaign_id ?? null,
    campaign_title: row.campaign_title || "Your campaign",
    alert_title: row.alert_title || "A disaster alert",
    alert_area: row.alert_area || "",
    disaster_type: row.disaster_type || "",
    severity: row.severity || "",
    asked_at: row.asked_at || null,
  };
}

// Pending check-ins for the signed-in owner only. The RPC is
// authenticated-only and returns the caller's rows.
export async function loadMyDisasterCheckins(client) {
  await ownerId(client);
  const { data, error } = await client.rpc("ifund_my_disaster_checkins");
  if (error || !Array.isArray(data))
    throw new Error("Disaster check-ins could not be loaded.");
  return data
    .filter((row) => UUID.test(row?.checkin_id || ""))
    .map(normalizeDisasterCheckin);
}

// Answer one check-in. p_answer is 'yes' or 'no'; anything else is rejected
// client-side before the RPC is called. The answer is final for the event:
// a "no" is never re-asked and a "yes" is never re-asked.
export async function answerDisasterCheckin(client, checkinId, answer) {
  if (!UUID.test(checkinId || "")) throw new Error("Invalid disaster check-in.");
  if (answer !== "yes" && answer !== "no")
    throw new Error("Answer must be 'yes' or 'no'.");
  await ownerId(client);
  const { data, error } = await client.rpc("ifund_disaster_checkin_answer", {
    p_checkin_id: checkinId,
    p_answer: answer,
  });
  if (error || !Array.isArray(data) || data.length !== 1)
    throw new Error(error?.message || "Your answer could not be recorded.");
  const result = data[0];
  if (result.checkin_id !== checkinId || !["yes", "no"].includes(result.status))
    throw new Error("Your answer was not confirmed.");
  return {
    checkin_id: result.checkin_id,
    status: result.status,
    campaign_id: result.campaign_id ?? null,
    disaster_relief: result.disaster_relief === true,
  };
}
