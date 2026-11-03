// Normalize the result of a public campaign lookup into a terminal UI state.
// PostgREST's single() returns PGRST116 when the requested row does not exist.
// Keep backend details out of the public page while distinguishing not-found
// from a transient or permission-related load failure.
export function campaignDetailOutcome({ data, error } = {}) {
  if (error) {
    if (error.code === "PGRST116") return { status: "not_found" };
    return {
      status: "error",
      message: "We couldn't load this campaign. Please try again.",
    };
  }

  if (!data) return { status: "not_found" };
  return { status: "ready", campaign: data };
}
