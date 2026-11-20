import { isVerifiedEmailUser } from "./verifiedEmailUser.js";
async function owner(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !isVerifiedEmailUser(data?.user))
    throw Error("Please sign in again.");
  return data.user.id;
}
function preferences(value) {
  if (
    !value ||
    typeof value.in_app_updates !== "boolean" ||
    typeof value.email_updates !== "boolean"
  )
    throw Error("Your update preferences could not be loaded.");
  return {
    email_updates: value.email_updates,
    in_app_updates: value.in_app_updates,
  };
}
export async function loadCommunicationPreferences(client) {
  const id = await owner(client);
  const { data, error } = await client
    .from("ifund_profiles")
    .select("id,comm_prefs")
    .eq("id", id)
    .maybeSingle();
  if (error || data?.id !== id)
    throw Error("Your update preferences could not be loaded.");
  return { owner_id: id, values: preferences(data.comm_prefs) };
}
export async function saveCommunicationPreferences(client, snapshot, values) {
  const id = await owner(client);
  if (snapshot?.owner_id !== id)
    throw Error("Your account changed. Reload your preferences.");
  const next = preferences(values);
  const { data, error } = await client
    .from("ifund_profiles")
    .update({ comm_prefs: next })
    .eq("id", id)
    .eq("comm_prefs", JSON.stringify(snapshot.values))
    .select("id,comm_prefs")
    .maybeSingle();
  if (error || data?.id !== id)
    throw Error(
      "Your preferences changed or could not be saved. Reload before choosing again.",
    );
  const actual = preferences(data.comm_prefs);
  if (
    actual.email_updates !== next.email_updates ||
    actual.in_app_updates !== next.in_app_updates
  )
    throw Error(
      "Your new preferences were not confirmed. Reload before choosing again.",
    );
  return { owner_id: id, values: actual };
}
