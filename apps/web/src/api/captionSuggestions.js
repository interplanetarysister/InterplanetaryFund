import { authClient } from "@/api/auth";

// Ask the Worker for AI-drafted caption wording for generated media.
// The server checks every draft for real-word coherence and public-facing
// discretion, regenerates once on failure, and otherwise returns the
// campaign title as a labeled fallback — the caller shows the wording in
// the editable caption box, and nothing is printed until the member
// approves the exact text there.
export async function suggestCaption({ title, description = "", kind = "image" }) {
  const client = authClient();
  const { data: identity, error: identityError } = await client.auth.getUser();
  const { data: session, error: sessionError } = await client.auth.getSession();
  const owner = identity?.user;
  if (identityError || sessionError || !owner?.id || owner.is_anonymous ||
      session?.session?.user?.id !== owner.id || !session.session.access_token)
    throw new Error("Sign in to a verified account before asking AI for caption wording.");
  const response = await fetch("/api/ai/captions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.session.access_token },
    body: JSON.stringify({
      title: String(title || "").trim().slice(0, 150),
      description: String(description || "").trim().slice(0, 900),
      kind,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Caption suggestions are currently unavailable.");
  if (!result?.caption) throw new Error("Caption suggestions are currently unavailable.");
  return result; // { caption, source: 'ai' | 'ai_corrected' | 'fallback' }
}
