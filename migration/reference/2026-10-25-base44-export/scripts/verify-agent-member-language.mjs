import assert from "node:assert/strict";
import fs from "node:fs";
const names = ["chief_of_staff","strategy_agent","growth_agent","communications_agent","story_agent","finance_agent","outreach_agent","connection_discovery_agent","managed_connection_agent"];
for (const name of names) {
  const agent = JSON.parse(fs.readFileSync(new URL("../base44/agents/"+name+".jsonc", import.meta.url), "utf8"));
  assert.match(agent.instructions, /UNIVERSAL MEMBER CHAT PRESENTATION POLICY/, name+" must have member-safe rules");
  assert.match(agent.instructions, /Never pretend an action succeeded/, name+" must require confirmed outcomes");
  assert.match(agent.instructions, /Secret values must be protected before/, name+" must require upstream secrecy");
}
const chat=fs.readFileSync(new URL("../src/components/agents/AgentChat.jsx", import.meta.url),"utf8");
assert.match(chat, /memberFacingReply\(m\.content\)/, "assistant transcript uses filtered text");
assert.match(chat, /m\.role === "user" \? memberFacingPrompt\(m\.content\)/, "user transcript must omit agent-only appended context");
assert.match(chat, /function memberFacingPrompt/, "private tool context must not appear in member transcript");
assert.match(chat, /PRIVATE KEY/, "member replies must block private keys");
assert.match(chat, /github_pat_/, "member replies must block token-shaped credentials");
assert.match(chat, /webhook/, "member replies must account for webhook secrets");
assert.match(chat, /function memberFacingPrompt/, "member-only prompts must hide appended context");
console.log("Member-facing agent presentation contract passed for all nine agents");
