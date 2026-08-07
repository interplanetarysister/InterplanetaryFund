# CREDIT-FREE AGENT ARCHITECTURE — Final
**Established:** 2026-08-01
**Authority:** Lyra, Chief of Staff for Agents
**Directive Source:** Michelle Rogers
**Status:** FULLY OPERATIONAL — ZERO RECURRING CREDITS

---

## ARCHITECTURE OVERVIEW

All recurring operations run as backend functions (code), not LLM agent steps. No `invoke_superagent_step` in any workflow. No `send_message_to_builder` in any workflow. The only credit costs are conversation messages with Michelle and rare manual Builder AI requests for architecture changes.

---

## ENTITIES (All in Lyra's App)

### Agent Entity — 5 Active Agents
| Agent | Role | Trust | Tasks | Status |
|-------|------|-------|-------|--------|
| Fundraising Agent | fundraising | 82 | 0 | active |
| Story Agent | story | 80 | 0 | active |
| Donor Relations Agent | donor_relations | 81 | 0 | active |
| Protocol Agent | protocol | 90 | 1 | active |
| Analytics Agent | analytics | 86 | 0 | active |

All agents have:
- long_term_memory (updated weekly by backend function)
- working_memory (updated weekly by backend function)
- Full profiles: capabilities, permissions, trust scores, managed campaigns

### MonitoredCampaign Entity — 4 Campaigns (Mirror)
Mirrors the Interplanetary Fund's campaign data for credit-free auditing.
Synced manually when Michelle is in conversation (no recurring credits).

### ProtocolReport Entity — Persistent Audit History
Every audit creates a report record. Michelle can read these on demand.
No LLM needed to generate reports — all done in code.

---

## BACKEND FUNCTIONS (All Credit-Free)

### 1. enforceCampaignProtocol
- Reads MonitoredCampaign mirror entity
- Checks P-1 through P-5 compliance
- Returns full audit with revenue summary
- Called daily by workflow and weekly by Saturday training

### 2. weeklyTrainingSync
- Runs protocol audit (same as above)
- Updates all 5 agents' long_term_memory and working_memory
- Creates a ProtocolReport record
- Returns full training report
- Called weekly by Saturday training

---

## WORKFLOWS (All Credit-Free)

### Daily Protocol Enforcement — 6am Pacific
```
invoke_backend_function → enforceCampaignProtocol → end
```
Zero credits. Pure code.

### Saturday Agent Training — 2am Pacific
```
invoke_backend_function → enforceCampaignProtocol
invoke_backend_function → weeklyTrainingSync → end
```
Zero credits. Pure code. Updates agent training, creates report.

---

## CREDIT COMPARISON — BEFORE vs AFTER

| Operation | Before | Credits | After | Credits |
|-----------|--------|---------|-------|---------|
| Daily protocol check | invoke_superagent_step | $/day | invoke_backend_function | FREE |
| Weekly training | invoke_superagent_step | $/week | invoke_backend_function | FREE |
| Agent creation | send_message_to_builder | $$ | create_entity_records | FREE |
| Agent training | send_message_to_builder | $$ | update_entities (via function) | FREE |
| Agent monitoring | invoke_superagent_step | $ | read_entities | FREE |
| Report generation | invoke_superagent_step | $ | ProtocolReport entity | FREE |
| Builder AI (rare) | send_message_to_builder | $$ | send_message_to_builder | $$ (rare, manual only) |
| Cross-app sync | invoke_superagent_step | $ | Manual (during conversation) | FREE |

**Result: 100% elimination of recurring credits.**

---

## SEPARATION FROM BASE44

The system is designed to be portable. If Michelle decides to separate from Base44:

### What's Exportable
1. **Agent records** — Export as JSON. Each agent is a complete profile with role, capabilities, scores, memory.
2. **Backend functions** — TypeScript/Deno code. Portable to any Deno runtime, Node.js, or serverless function.
3. **Protocol document** — Markdown. Universal format.
4. **Campaign mirror data** — Export as JSON.
5. **Protocol reports** — Export as JSON. Full audit history.

### What Would Need Replacing
1. **Base44 SDK** → Replace with direct database calls (MongoDB, PostgreSQL, etc.)
2. **Entity storage** → Replace with any database
3. **Workflows** → Replace with cron jobs calling the functions
4. **Cross-app entity access** → Replace with direct database queries

### Migration Path
1. Export all entity records (agents, campaigns, reports) as JSON
2. Port backend functions to standalone runtime (change SDK calls to DB calls)
3. Set up cron jobs for daily/weekly execution
4. Deploy to any cloud provider (Vercel, Railway, AWS, etc.)
5. Agents, protocol, training logic, and audit history all carry over intact

---

## MANUAL OPERATIONS (When Michelle Talks to Lyra)

These happen during conversation — no extra credits beyond the conversation itself:
1. **Mirror sync** — Read IF campaigns, update MonitoredCampaign mirror
2. **Cross-app fixes** — Update IF campaigns (e.g., enable outreach)
3. **Builder AI messages** — Send action plans for architecture changes (rare)
4. **Protocol amendments** — Update protocol standards
5. **Agent creation** — Create new agents as entity records
