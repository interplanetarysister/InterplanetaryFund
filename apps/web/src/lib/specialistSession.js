import { memberIdentity } from "./guestAccess.js";

const ACTIONS = Object.freeze({
  strategy: ["subscription", "workspace", "brief", "bulk"],
  growth: ["subscription", "workspace", "brief", "bulk"],
  communications: ["workspace", "save", "drafts", "cancel", "prepare-send", "send"],
  connections: ["workspace", "methods", "grant-help", "requests", "change-selected"],
});
const READS = new Set(["workspace", "subscription", "methods"]);
const changed = () => new Error("Your account changed. Reopen this workspace before continuing.");

// One service panel belongs permanently to one verified owner. Returning to the
// same account never revives old requests or approval previews.
export function createSpecialistSession({ client, ownerId, agent, fetcher = fetch, onInvalidate = () => {} }) {
  if (!ACTIONS[agent] || !ownerId) throw Error("Choose an available specialist workspace.");
  let active = true;
  const controllers = new Set();
  const invalidate = () => {
    if (!active) return;
    active = false;
    for (const controller of controllers) controller.abort();
    onInvalidate();
  };
  const assertActive = () => { if (!active) throw changed(); };
  const verify = async () => {
    assertActive();
    const result = await client.auth.getUser();
    assertActive();
    if (result.error || !memberIdentity(result.data?.user) || result.data.user.id !== ownerId) {
      invalidate();
      throw changed();
    }
  };
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    if (!memberIdentity(session?.user) || session.user.id !== ownerId) invalidate();
  });
  const publish = consume => { assertActive(); return consume(); };
  async function request(action, body) {
    const [name, query = ""] = String(action).split("?");
    if (!ACTIONS[agent].includes(name) || (query && (name !== "methods" || !/^provider=[a-z0-9_%-]+$/.test(query))))
      throw Error("This specialist action is unavailable.");
    if (READS.has(name) !== (body === undefined)) throw Error("Invalid specialist request method.");
    await verify();
    const identity = await client.auth.getSession();
    assertActive();
    if (identity.error || !memberIdentity(identity.data?.session?.user) ||
        identity.data.session.user.id !== ownerId || !identity.data.session.access_token) {
      invalidate(); throw changed();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    controllers.add(controller);
    try {
      // No await between the last synchronous guard and the network operation.
      assertActive();
      const response = await fetcher("/api/agents/" + agent + "/" + name + (query ? "?" + query : ""), {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: "Bearer " + identity.data.session.access_token,
          ...(body === undefined ? {} : { "content-type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      await verify();
      assertActive();
      if (!response.ok) throw Object.assign(Error(typeof result?.error === "string"
        ? result.error.slice(0, 500) : "The specialist service could not confirm this request."),
      { status: response.status, code: result?.code });
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw Error("The specialist service returned an invalid receipt.");
      return result;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  return {
    ownerId, get active() { return active; }, publish,
    async run(operation, consume) {
      await verify();
      assertActive();
      const result = await operation(request);
      await verify();
      // Publication occurs inside the scope, with no unguarded caller await.
      return publish(() => consume(result));
    },
    dispose() { active = false; for (const controller of controllers) controller.abort(); data?.subscription?.unsubscribe(); },
  };
}

export function selectedRevisions(rows, selected, { max = 50, revisionKey = "updated_at" } = {}) {
  const unique = [...new Set(selected)];
  if (!unique.length || unique.length !== selected.length || unique.length > max)
    throw Error("Choose between one and " + max + " current records.");
  return unique.map(id => {
    const row = rows.find(item => item.id === id);
    if (!row || typeof row[revisionKey] !== "string" || !row[revisionKey])
      throw Error("A selected record changed. Reload before choosing again.");
    return { id, revision: row[revisionKey] };
  });
}

export function verifiedMessagePreview(result, previewId, items) {
  const wanted = new Set(items.map(item => item.id));
  if (result?.preview_id !== previewId || !Array.isArray(result.messages) ||
      !wanted.size || wanted.size > 5 || result.messages.length !== wanted.size ||
      new Set(result.messages.map(message => message?.id)).size !== wanted.size)
    throw Error("The exact message review could not be verified. Reload before sending.");
  for (const message of result.messages) {
    if (!wanted.has(message?.id) || typeof message.subject !== "string" ||
        typeof message.content !== "string" || typeof message.campaign_id !== "string" ||
        message.subject.length > 200 || message.content.length > 4000 ||
        !Number.isSafeInteger(message.eligible_recipients) || message.eligible_recipients < 0)
      throw Error("The exact message text and audience could not be verified.");
  }
  return result;
}
