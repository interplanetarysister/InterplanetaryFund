# Interplanetary Fund — Permission Model
**Version:** 1.0.0

## Permission Tiers

### Tier 1: Owner (Michelle Rogers)
- Full control over all systems
- Can revoke any agent's authority
- Can deactivate agents, revoke credentials, emergency shutdown
- Approves all high-risk operations
- Can authorize new runtimes

### Tier 2: Chief of Staff (Solene)
- Full approval authority for IF-related actions
- Can manage all 7 specialized agents
- Can deploy code, manage database, configure services
- Cannot use Base44 credits without warning Michelle
- Cannot pay for services or upgrade to paid tiers
- Must perform completion-reconciliation after every sprint

### Tier 3: Specialized Agents
- Each agent has domain-specific permissions
- Can execute within their specialization
- Cannot deploy to production without approval
- Cannot make financial decisions
- Activity logged in agentActivityLog

#### Fundraising Agent
- Scope: outreach, revenue optimization
- Can: manage campaign outreach, optimize donation flows
- Cannot: deploy code, modify payments, change protocol

#### Story Agent
- Scope: narrative optimization, AI content
- Can: generate and optimize campaign stories, FAQ, social content
- Cannot: deploy code, manage payments

#### Donor Relations Agent
- Scope: donor engagement, retention
- Can: manage donor communications, thank-you messages
- Cannot: deploy code, modify campaigns

#### Protocol Agent
- Scope: compliance monitoring
- Can: audit campaigns, generate protocol reports
- Cannot: modify campaigns, deploy code

#### Analytics Agent
- Scope: revenue tracking, reporting
- Can: generate reports, analyze data
- Cannot: modify data, deploy code

#### Treasury Agent
- Scope: fund management
- Can: run consolidation, track balances
- Cannot: initiate payouts without admin approval

#### Platform Sync Agent
- Scope: external platform synchronization
- Can: sync external data, discover groups
- Cannot: modify campaigns, deploy code

### Tier 4: External Agents (future)
- Must authenticate and identify runtime
- Receive context based on role and permissions
- Frontend agent: frontend architecture, UI requirements, relevant APIs
- Payment agent: payment architecture, financial requirements, webhooks
- Audit agent: audit history, security requirements, criteria
- No permanent authority from single interaction
- Can be revoked at any time

## Permission-Aware Context Retrieval
Different agents receive different context:
- Frontend agent → frontend architecture, UI requirements, relevant APIs, schemas
- Payment agent → payment architecture, financial requirements, webhook architecture
- Audit agent → audit history, security requirements, production-readiness criteria
- General agent → project overview, current state, architecture, requirements

## Emergency Controls
- Permission revocation (per agent)
- Agent deactivation (automationEnabled = false)
- Credential revocation (OAuth disconnect)
- Runtime revocation (remove from authorized_environments)
- Task cancellation
- Emergency shutdown (all agents off)
- Audit review (agentActivityLog)
