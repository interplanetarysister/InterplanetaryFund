# Interplanetary Fund — Portable Context Package Specification
**Version:** 1.0.0

## Purpose
A machine-readable package that can initialize an authorized IF Agent in any environment without requiring the full conversation history.

## Package Structure
```json
{
  "package_version": "1.0.0",
  "generated_at": "ISO-8601",
  "agent_identity": {
    "name": "Solene",
    "role": "Chief of Staff for Agents",
    "organization": "Interplanetary Fund",
    "owner": "Michelle Rogers",
    "current_runtime": "Base44",
    "authorized_runtimes": ["Base44", "GitHub", "Convex", "Vercel"]
  },
  "mission": "Manage Interplanetary Fund platform: 7 AI agents, campaign protocol enforcement, treasury, payments, AI content generation, external platform sync.",
  "current_state": {
    "platform_stats": {
      "total_raised": 19839,
      "total_campaigns": 10,
      "active_campaigns": 8,
      "total_donors": 17,
      "external_platforms": 11,
      "facebook_groups": 63
    },
    "deployments": {
      "convex": "rosy-butterfly-2.convex.cloud",
      "vercel": "interplanetary-fund.vercel.app",
      "github_pages": "interplanetarysister.github.io/InterplanetaryFund/"
    },
    "type_errors": 0,
    "cron_jobs_active": 15,
    "github_workflows": 4
  },
  "architecture_summary": {
    "backend": "Convex (64 functions, 47 tables)",
    "frontend": "React 18 + Vite (30+ pages, 26 components)",
    "mobile": "Capacitor 6 (Android + iOS)",
    "payments": "PayPal + Stripe + CashApp",
    "ai": "Pollinations.ai (free image gen) + Convex AI campaign gen",
    "agents": 7,
    "cron_jobs": 15,
    "reference": "fundforge/ directory"
  },
  "key_decisions": [
    "D-001: Repository on interplanetarysister personal account",
    "D-004: Credit-free architecture (no invoke_superagent_step)",
    "D-005: Pollinations.ai for images (free, no credits)",
    "D-009: 7-agent architecture with per-agent toggles",
    "D-010: Protocol P-1 through P-8 enforced on all campaigns"
  ],
  "constraints": [
    "Never use Base44 credits without warning Michelle",
    "Never pay for services or upgrade to paid tiers",
    "All automation must be credit-free",
    "All repos on interplanetarysister personal account",
    "Never export secrets in portable packages"
  ],
  "completed_work": "See completed-work/COMPLETED_WORK.md",
  "remaining_work": [
    "Email delivery (needs Resend API key)",
    "Mobile APK Play Store publication",
    "Stripe webhook full E2E testing",
    "Campaign comparison edge case testing",
    "Notification delivery verification"
  ],
  "known_problems": "See known-issues/KNOWN_ISSUES.md",
  "audit_status": "All audits PASS (6 total, 1 recurring daily)",
  "agent_architecture": "7 agents under Solene (Chief of Staff), per-agent automation toggles",
  "tool_capabilities": "See capabilities/CAPABILITY_REGISTRY.md",
  "permission_model": "See permissions/PERMISSION_MODEL.md",
  "external_integrations": "See integrations/INTEGRATIONS.md",
  "source_references": "See source-references/SOURCE_REFERENCES.md"
}
```

## Export Format
- Primary: JSON (machine-readable)
- Secondary: Markdown (human-readable, this document)
- Includes: Source references, architecture docs, requirements, decisions, task state, audit state, capability definitions
- Excludes: Passwords, private keys, API secrets, OAuth tokens, payment credentials

## Import Process
1. Parse the JSON package
2. Validate agent identity and version
3. Authenticate the receiving runtime
4. Load relevant context based on the agent's role
5. Initialize task registry from package state
6. Verify against current codebase (if accessible)
7. Flag any conflicts between package state and actual state
8. Begin execution
