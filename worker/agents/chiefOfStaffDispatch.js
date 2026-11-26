// NEXUS chief-of-staff dispatch (owner directive 2026-11-26).
//
// When a member explicitly asks NEXUS to DO a specialist task ("draft my
// story", "prepare a thank-you email", "make me a strategy brief"), NEXUS
// prepares that exact request for the owning specialist: the dispatch is
// recorded in the member's shared team context (which every specialist
// reads, including Story), returned to the client as a structured object,
// and the member launches it with one tap in the specialist's workspace.
//
// Honesty contract: a dispatch is a prepared, recorded request — it is NOT
// the specialist's finished work, and nothing here executes a specialist's
// tools, publishes, sends or moves money. Statuses must never be upgraded
// beyond "prepared" by this module.
import { TRAINING_ROUTE_RULES } from "../../apps/web/src/lib/agentTrainingDirectory.mjs";
import { redactTeamCredentials } from "./teamContext.js";

// Member-facing workspace for each specialist. Mirrors AGENT_WORKSPACES in
// apps/web/src/lib/agentWorkspaces.mjs (presentation paths); keep in sync.
export const SPECIALIST_WORKSPACES = Object.freeze({
  story: { tool: "Private AI campaign writing", path: "/agents?tab=writing" },
  polaris: { tool: "Campaign strategy and Mission Brief", path: "/strategy" },
  orbit: { tool: "Campaign finances and budget review", path: "/finances" },
  forge: { tool: "Campaign growth and engagement metrics", path: "/engagement" },
  echo: { tool: "Campaign message drafts", path: "/communications" },
  pulse: { tool: "Opportunity matching and outreach drafts", path: "/institutions" },
  link: { tool: "Connection status and authorization", path: "/connections" },
  discover: { tool: "Provider discovery", path: "/connections" },
});

const ACTION_VERBS = [
  "draft", "write", "rewrite", "create", "prepare", "make", "build",
  "compose", "generate", "plan", "start", "set up", "setup", "fix",
  "repair", "check", "review", "send", "post", "launch", "connect",
];
// Pure questions and information-seeking are not dispatch intents, even when
// they mention a specialist's domain ("how do I write a story?").
const QUESTION_OPENERS = [
  "how do i", "how can i", "how do we", "what is", "what are", "what does",
  "why", "when", "where", "who", "can you explain", "explain", "tell me about",
  "should i", "is it", "do i need",
];
const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase("en-US")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function detectDispatchIntent(question) {
  const text = " " + normalize(question) + " ";
  if (QUESTION_OPENERS.some(opener => text.startsWith(" " + opener + " "))) return null;
  const hasAction = ACTION_VERBS.some(verb => text.includes(" " + verb + " "));
  if (!hasAction) return null;
  const topics = [...new Set(TRAINING_ROUTE_RULES
    .filter(rule => rule.keywords.some(term => text.includes(" " + normalize(term) + " ")))
    .map(rule => rule.target))];
  if (!topics.length) return null;
  // One clear owner wins. Mixed-domain requests stay advisory here; NEXUS
  // already consults multiple specialists for those.
  if (topics.length > 1) return null;
  const specialist = topics[0];
  if (!Object.hasOwn(SPECIALIST_WORKSPACES, specialist)) return null;
  return { specialist };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A dispatch record needs its own team-context idempotency key: a third
// deterministic UUID derived from the request id, distinct from both the
// member's message key and the reply key (see replyEventKey in
// teamContext.js, which toggles different bits).
export function dispatchEventKey(requestId) {
  if (!UUID.test(requestId || "")) throw Error("Invalid request reference.");
  const bits = requestId.replace(/-/g, "").split("");
  bits[13] = (parseInt(bits[13], 16) ^ 1).toString(16);
  const tail = bits.slice(20).join("");
  const changed = tail[0] + (parseInt(tail[1], 16) ^ 8).toString(16) + tail.slice(2);
  return bits.slice(0, 8).join("") + "-" + bits.slice(8, 12).join("") + "-" +
    bits.slice(12, 16).join("") + "-" + bits.slice(16, 20).join("") + "-" + changed;
}

export function buildDispatch({ question, requestId }) {
  const intent = detectDispatchIntent(question);
  if (!intent) return null;
  const workspace = SPECIALIST_WORKSPACES[intent.specialist];
  return {
    kind: "chief_of_staff_dispatch",
    status: "prepared",
    specialist: intent.specialist,
    tool: workspace.tool,
    workspace_path: workspace.path,
    // The member's own words are the brief; specialists also receive this
    // through shared team context when the member launches the workspace.
    brief: redactTeamCredentials(String(question || "")).slice(0, 2000),
    request_id: requestId || null,
    requires_member_launch: true,
    actions_performed: false,
  };
}
