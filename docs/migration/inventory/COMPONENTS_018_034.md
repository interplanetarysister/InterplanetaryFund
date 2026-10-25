# Frontend non-UI components 18–34
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/admin/AccountDetailPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/AccountDetailPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/admin/ActionQueuePanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/ActionQueuePanel.jsx) — 1 matches
- L14: `const { data } = await base44.functions.invoke("acknowledgeConnectionIssue", { connection_id: c.id });`

## [src/components/admin/AdminApprovalQueue.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/AdminApprovalQueue.jsx) — 5 matches
- L8: `const load=async()=>{const list=await base44.entities.AdminApproval.filter({},"-requested_at",200);setItems(list);const pairs=await Promise.all(list.map(async i=>[i.id,await base44.entities.`
- L9: `const message=async(item,type,content,extra={})=>{const me=await base44.auth.me();await base44.entities.AdminActionMessage.create({approval_id:item.id,sender_type:"admin",sender_user_id:me.i`
- L10: `const resolve=async(item,status)=>{setBusy(item.id);try{const me=await base44.auth.me();if(status==="approved"&&item.action_type==="create_platform_account"){const existing=await base44.enti`
- L11: `const ask=async item=>{if(!note.trim())return;setBusy(item.id);try{await message(item,"request_more_information",note.trim());await base44.entities.AdminApproval.update(item.id,{status:"need`
- L12: `const investigate=async item=>{setBusy(item.id);try{if(note.trim())await message(item,"investigation_note",note.trim());await base44.entities.AdminApproval.update(item.id,{status:"investigat`

## [src/components/admin/AdminConnectionAssistant.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/AdminConnectionAssistant.jsx) — 1 matches
- L7: `const response=await base44.functions.invoke('adminApiConnectionIntake',{action,...data});`

## [src/components/admin/Base44ReleaseStatus.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/Base44ReleaseStatus.jsx) — 0 matches
- No direct match detected.

## [src/components/admin/ExternalAccountsSummary.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/ExternalAccountsSummary.jsx) — 0 matches
- No direct match detected.

## [src/components/admin/ExternalAccountsTable.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/ExternalAccountsTable.jsx) — 0 matches
- No direct match detected.

## [src/components/admin/IntegrationDetailPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/IntegrationDetailPanel.jsx) — 1 matches
- L30: `await base44.functions.invoke("managePlatformAccess", { action, platform: entry.platform, ...payload });`

## [src/components/admin/IntegrationsTable.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/IntegrationsTable.jsx) — 0 matches
- No direct match detected.

## [src/components/admin/OwnerConnectorRoutePanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/OwnerConnectorRoutePanel.jsx) — 1 matches
- L16: `const reply=await base44.functions.invoke('manageOwnerConnectionConfiguration',{mode,...payload});`

## [src/components/admin/PayPalReceiptRecoveryPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/PayPalReceiptRecoveryPanel.jsx) — 4 matches
- L30: `base44.functions.invoke("listUntrackedPayPalReceipts", { lookback_days: lookbackDays }),`
- L31: `base44.entities.Campaign.list("-created_date", 300),`
- L70: `? await base44.functions.invoke("capturePayPalOrder", {`
- L76: `: await base44.functions.invoke("reconcileDirectPayPalCampaignDonation", {`

## [src/components/admin/PostLookupPanel.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/admin/PostLookupPanel.jsx) — 0 matches
- No direct match detected.

## [src/components/agents/AdminDevelopmentChat.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/AdminDevelopmentChat.jsx) — 0 matches
- No direct match detected.

## [src/components/agents/AgentChat.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/AgentChat.jsx) — 11 matches
- L23: `const response = await base44.functions.invoke("ownerAgentChatActions", {`
- L125: `const conv = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: agentLabel } });`
- L130: `unsub = base44.agents.subscribeToConversation(conv.id, (data) => {`
- L147: `void base44.functions.invoke("trackAgentConversation", { mode: "sync", run_id: runId })`
- L173: `const snapshot = await base44.agents.getConversation(conversationId).catch(() => null);`
- L190: `void base44.functions.invoke("trackAgentConversation", {`
- L217: `const response = await base44.functions.invoke("ownerAgentChatActions", {`
- L236: `const tracked = await base44.functions.invoke("trackAgentConversation", {`
- L245: `await base44.agents.addMessage(convRef.current, { role: "user", content: agentContent });`
- L247: `void base44.functions.invoke("trackAgentConversation", {`
- L254: `void base44.functions.invoke("trackAgentConversation", {`

## [src/components/agents/AgentContentReview.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/AgentContentReview.jsx) — 2 matches
- L34: `const r = await base44.functions.invoke("manageAgentContentDraft", {mode:"list"});`
- L60: `const r=await base44.functions.invoke(fn,input);`

## [src/components/agents/AgentMonitor.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/AgentMonitor.jsx) — 5 matches
- L98: `base44.functions.invoke("manageAgentWork", { mode: "list", view: "all" }),`
- L99: `base44.functions.invoke("trackAgentConversation", { mode: "list" }),`
- L100: `base44.functions.invoke("manageAgentContentDraft", { mode: "list" }),`
- L101: `base44.entities.AgentActivity.filter({ owner_user_id: user.id }, "-created_date", 50),`
- L117: `base44.functions.invoke("routeAgentTask", { mode: "status", delegation_id: task.id })));`

## [src/components/agents/BuilderExecutionControls.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/agents/BuilderExecutionControls.jsx) — 1 matches
- L19: `const response = await base44.functions.invoke("manageApprovedBuilderExecution", {`
