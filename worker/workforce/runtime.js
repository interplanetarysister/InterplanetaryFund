import { procureTeam } from "./procurement.js";

const failure = (message) => Object.assign(new Error(message), { status: 503 });
// Compatibility for the previously released Story path. New procurement has no fallback to this value.
export const legacyStoryImplementation = Object.freeze({
  provider: "cloudflare",
  adapter: "workers_ai",
  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
});

/** Binding-only execution: no caller-supplied URL, bearer, paid fallback or automatic replay. */
export async function invokeImplementation(implementation, env, input) {
  if (
    implementation.adapter === "workers_ai" &&
    implementation.provider === "cloudflare"
  ) {
    if (
      !env.AI?.run ||
      !/^@(cf|hf)\/[a-z0-9_./-]+$/i.test(implementation.model || "")
    )
      throw failure("Writing suggestions are temporarily unavailable.");
    return env.AI.run(implementation.model, input);
  }
  if (
    implementation.adapter === "service_binding" &&
    implementation.provider === "self_hosted"
  ) {
    const name = implementation.binding;
    if (!/^IFUND_MODEL_[A-Z0-9_]{1,48}$/.test(name || "") || !env[name]?.fetch)
      throw failure("Writing suggestions are temporarily unavailable.");
    const result = await env[name].fetch(
      "https://ifund-inference.internal/v1/generate",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: implementation.model, input }),
        signal: AbortSignal.timeout(65000),
      },
    );
    if (!result.ok)
      throw failure("Writing suggestions could not finish. Your text is safe.");
    const length = Number(result.headers.get("content-length") || 0);
    if (length > 64000)
      throw failure("The writing assistant returned an incomplete draft.");
    // Bound streamed responses too; Content-Length alone is not a limit.
    const reader = result.body?.getReader();
    if (!reader)
      throw failure("The writing assistant returned an incomplete draft.");
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 64000) {
          await reader.cancel();
          throw failure("The writing assistant returned an incomplete draft.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  throw failure("Writing suggestions are temporarily unavailable.");
}

/** The database rechecks this plan atomically with quota, ownership and assignment. */
export async function beginStoryAssignment(env, rpc, input, hash, messages) {
  const snapshot = await rpc("ifund_workforce_snapshot", {});
  if (snapshot?.policy?.enabled !== true)
    throw failure("Writing suggestions are temporarily unavailable.");
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  const candidates = (
    Array.isArray(snapshot.implementations) ? snapshot.implementations : []
  ).map((c) => ({
    ...c,
    available:
      c.available === true &&
      ((c.adapter === "workers_ai" &&
        c.provider === "cloudflare" &&
        typeof env.AI?.run === "function") ||
        (c.adapter === "service_binding" &&
          c.provider === "self_hosted" &&
          /^IFUND_MODEL_[A-Z0-9_]{1,48}$/.test(c.binding || "") &&
          typeof env[c.binding]?.fetch === "function")),
  }));
  const task = {
    position_id: "story_agent",
    capabilities: [input.section ? "story.section.v1" : "story.draft.v1"],
    allowed_permissions: ["owner_context"],
    complexity: 2,
    input_bytes: bytes,
    max_output_tokens: 2200,
    remaining_units: snapshot.policy.remaining_units,
  };
  // A single complete Story contract is required. Fragmentary team output is never treated as equivalent.
  const plan = procureTeam(task, candidates, { max_members: 1 });
  return rpc("ifund_workforce_begin", {
    p_request_id: input.request_id,
    p_input_hash: hash,
    p_campaign_id: input.campaign_id,
    p_implementation_id: plan.members[0]?.id || null,
    p_contract: task.capabilities[0],
    p_prompt_bytes: bytes,
    p_task: { details: input.details, section: input.section },
  });
}
