# Interplanetary Fund — Agent-to-Agent Communication Protocol
**Version:** 1.0.0

## Protocol Specification

### Message Structure
```json
{
  "protocol_version": "1.0.0",
  "message_type": "request | response | notification | acknowledgment",
  "sender": {
    "agent_id": "string",
    "agent_name": "string",
    "runtime": "string",
    "role": "string"
  },
  "receiver": {
    "agent_id": "string",
    "agent_name": "string",
    "runtime": "string"
  },
  "authentication": {
    "token_type": "string",
    "token": "REFERENCE_ONLY — never include raw tokens"
  },
  "task_id": "string | null",
  "correlation_id": "string",
  "timestamp": "ISO-8601",
  "content": {
    "action": "CREATE_TASK | READ_CONTEXT | READ_REQUIREMENT | READ_ARCHITECTURE | READ_CODE_REFERENCES | REPORT_STATUS | SUBMIT_RESULT | REQUEST_APPROVAL | REQUEST_ADDITIONAL_CONTEXT",
    "payload": {}
  },
  "authorization_scope": {
    "permissions": ["string"],
    "data_access_level": "string"
  },
  "status": "pending | in_progress | completed | failed | denied",
  "error": "string | null"
}
```

### Supported Actions

1. CREATE_TASK — External agent creates a task in the registry
2. READ_CONTEXT — Request relevant project context
3. READ_REQUIREMENT — Request specific requirements
4. READ_ARCHITECTURE — Request architecture documentation
5. READ_CODE_REFERENCES — Request relevant code file references
6. REPORT_STATUS — Report task status update
7. SUBMIT_RESULT — Submit completed work results
8. REQUEST_APPROVAL — Request approval for an action
9. REQUEST_ADDITIONAL_CONTEXT — Request more context

### Context Retrieval (Relevance-Based)
When an external agent requests context about a topic, the IF Agent returns ONLY relevant information:

Example: "Campaign donations"
Returns: Campaign architecture, donation requirements, payment architecture, relevant schemas, code references, previous decisions, audit findings
Does NOT return: Social integrations, unrelated AI systems, other projects, private user data

### GitHub Agent Example Flow
```
User: "Have the GitHub agent fix the campaign analytics bug."

GitHub Agent → IF Agent: READ_CONTEXT { topic: "campaign analytics" }
IF Agent → GitHub Agent: { architecture, requirements, affected files, audit findings, current task state }

GitHub Agent → IF Agent: SUBMIT_RESULT { files_changed, test_results, implementation }
IF Agent → IF Agent: Record in development action history, update task status, update canonical knowledge

GitHub Agent → IF Agent: REPORT_STATUS { status: "completed" }
IF Agent → User: "Campaign analytics bug fixed. Files changed: [list]. Tests: PASS."
```

### Security Rules
1. All messages require authentication
2. Authorization scope must be validated before processing
3. Sensitive data (passwords, keys, tokens) never transmitted
4. Each interaction is logged in the audit trail
5. No permanent authority from a single interaction
6. Permission-aware context: agents only receive context relevant to their role

### Bootstrap Protocol for New Agents
1. Authenticate the agent
2. Identify its runtime/environment
3. Determine its permissions
4. Load minimum required project context
5. Provide current project state
6. Provide relevant requirements
7. Provide relevant architecture
8. Provide relevant previous decisions
9. Provide relevant audit findings
10. Provide assigned task
11. Require agent to acknowledge its scope
12. Allow execution
13. Collect results
14. Update task history
15. Update canonical project knowledge
