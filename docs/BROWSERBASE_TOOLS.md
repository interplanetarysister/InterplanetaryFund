# Browserbase Tools — All IF Agents

## Overview

All Interplanetary Fund agents now have browser automation capabilities via Browserbase.

## Two Modes

### 1. Fetch API (Fast, Cheap)
- Retrieves page content without launching a browser session
- Returns markdown, HTML, or structured JSON
- Cost: $1 per 1,000 pages
- Perfect for: research, content scraping, page monitoring

### 2. Session API (Full Browser)
- Full browser automation: click, type, navigate, screenshot
- Handles JavaScript rendering, bot protection, dynamic content
- Perfect for: form filling, login flows, interactive research

## Agent Capabilities

| Agent | Fetch | Session | Auto-Research |
|-------|-------|---------|---------------|
| Strategy | ✓ | ✓ | Every 6h |
| Story | ✓ | — | Every 6h |
| Growth | ✓ | ✓ | Every 6h |
| Communications | ✓ | ✓ | Every 6h |
| Atlas | — | ✓ | Every 6h |
| Solene (Chief of Staff) | ✓ | ✓ | Every 6h |

## Convex Functions (convex/browserbase.ts)

### Fetch API
- `fetchPage({ url, format, agentRole })` — Fetch a single URL
- `fetchBatch({ urls, format, agentRole })` — Fetch multiple URLs at once

### Session API
- `createSession({ agentRole, proxies, keepAlive })` — Start browser session
- `navigateToUrl({ sessionId, url })` — Navigate to a URL
- `takeScreenshot({ sessionId, format })` — Capture screenshot
- `endSession({ sessionId })` — End browser session

### Automation
- `runAgentBrowserResearch({ agentRole })` — Run research for one agent
- `runAllAgentBrowserResearch({})` — Run research for all agents

### Status
- `getBrowserbaseStatus({})` — Check configuration and agent profiles
- `getAllBrowserProfiles({})` — Get all agent browser profiles

## Environment Variables

Set in Convex dashboard (Settings > Environment Variables):

```
BROWSERBASE_API_KEY=your_api_key
BROWSERBASE_PROJECT_ID=your_project_id
```

## Cron Jobs

- `browserbase-research` — Every 6 hours, runs Browserbase research for all agents
- `agent-research-sprint` — Every 12 hours, delegated to Browserbase module
- `master-agent-check` — Every 2 hours, includes Browserbase research cycle

## Solene Platform Tools

Solene (Chief of Staff) also has direct Browserbase access via Base44 platform tools:
- `browserbase_navigate` — Navigate to URL
- `browserbase_screenshot` — Take screenshot
- `browserbase_click` — Click element
- `browserbase_type` — Type text
- `browserbase_get_content` — Read page content
- `browserbase_observe` — Find actionable elements
- `browserbase_act` — AI-driven action
- `browserbase_extract` — Extract structured data

## Setup Checklist

1. Create a Browserbase account at https://browserbase.com
2. Get API key and project ID from the dashboard
3. Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` in Convex dashboard
4. Deploy: `npx convex deploy --env-file .env.deploy`
5. Verify: Run `getBrowserbaseStatus` query to confirm configuration
