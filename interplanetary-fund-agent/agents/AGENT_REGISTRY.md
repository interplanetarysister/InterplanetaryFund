# Interplanetary Fund — Agent Registry
**Version:** 1.0.0
**Chief of Staff:** Solene (app ID: 6a739f5aa09929feedcb5470)
**Previous Chief of Staff:** Lyra (app ID: 6a67a4ff1c164c06321e2e67) — retired 2026-08-07

## Agent Hierarchy

```
Solene (Chief of Staff)
├── Fundraising Agent (trust: 82, active)
├── Story Agent (trust: 80, active)
├── Donor Relations Agent (trust: 81, active)
├── Protocol Agent (trust: 90, active)
├── Analytics Agent (trust: 86, active)
├── Treasury Agent (active)
└── Platform Sync Agent (active)
```

## Agent Details

### 1. Fundraising Agent
- Role: fundraising
- Purpose: Outreach and revenue optimization
- Trust Score: 82
- Capabilities: outreach, revenue optimization, campaign promotion
- Automation: Every 6 hours
- Managed Campaigns: All 5 monitored campaigns

### 2. Story Agent
- Role: story
- Purpose: Story generation and optimization
- Trust Score: 80
- Capabilities: narrative optimization, AI content generation
- Automation: Every 6 hours
- Managed Campaigns: All 5 monitored campaigns

### 3. Donor Relations Agent
- Role: donor_relations
- Purpose: Donor engagement and retention
- Trust Score: 81
- Capabilities: donor communication, retention strategies
- Automation: Every 6 hours

### 4. Protocol Agent
- Role: protocol
- Purpose: Compliance monitoring (P-1 through P-8)
- Trust Score: 90
- Capabilities: protocol enforcement, audit generation
- Automation: Daily at 6am PT

### 5. Analytics Agent
- Role: analytics
- Purpose: Revenue tracking and reporting
- Trust Score: 86
- Capabilities: data analysis, reporting, metrics
- Automation: Every 8 hours

### 6. Treasury Agent
- Role: treasury
- Purpose: Fund management and consolidation
- Automation: Every 6 hours (fund consolidation)

### 7. Platform Sync Agent
- Role: platform_sync
- Purpose: External platform synchronization
- Automation: Every 4 hours

## Additional Agents (from Agent Roster - Base44 apps)
### FundForge (App ID: 6a66a32b4e5c2b7f4daddcc8)
- Purpose: AI-powered crowdfunding hub
- Architecture: 2 entities (Campaign, Donation), Stripe integration
- Status: Active

### Solas (App ID: 6a6739f36770e38d8e26b33e)
- Purpose: Fundraiser claims and withdrawal platform
- Architecture: 1 entity (FundraiserClaim), PayPal
- Status: Partial

### LegalAudit Connect (App ID: 6a67534ad66133ab606e5eac)
- Purpose: Legal audit marketplace
- Architecture: 18+ entities
- Status: High potential

### Vesper (App ID: 6a65d6a7bb60f56b5631d381)
- Purpose: Unknown
- Status: Discovery needed

### SAAS Company Copy (App ID: 6a660a07751bef4a517e462b)
- Purpose: AI assistant / workflow automation
- Status: Discovery needed

## Agent Communication Protocol
- Agents communicate via agentActivityLog table
- Each agent has working_memory and long_term_memory
- Weekly training sync updates all agent memories
- Agent automation can be toggled per-agent via automationEnabled field
