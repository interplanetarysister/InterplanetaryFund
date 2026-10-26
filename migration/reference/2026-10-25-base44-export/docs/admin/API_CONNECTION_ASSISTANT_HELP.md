# Admin API connection assistant

1. Sign into IFund as the platform super administrator.
2. Open **Admin → External AI Agent API** (`/admin/agent-api`).
3. In **Connection setup assistant**, describe the other service, API endpoint, or webhook. Paste the URL if it contains no keys. Never paste passwords, API keys, client secrets, signing tokens, or bearer tokens.
4. Select **Identify connection and required details**. Read the detected connection type and answer any missing-detail questions.
5. Enter the provider name, HTTPS URL, authentication **method** (not secret), events/methods, and expected data.
6. Choose **Save connection draft to IFund**. This stores an admin-only pending configuration record. It does **not** activate a webhook, change a provider account, or authorize posting.
7. Choose **Test connection reachability**. Known public provider hosts receive only an unauthenticated HEAD reachability check. A successful response does not prove authorization, scopes, payload mapping, or webhook delivery. Unsupported or private URLs are not fetched.
8. Complete provider-specific authorization from **Connections** using the encrypted credential manager and existing consent/verification tools before marking any integration operational.

The assistant uses IFund's AI text-classification service when available, with a deterministic fallback. It cannot automatically map arbitrary third-party payloads into production Campaign or financial records: those require provider-specific mapping and validation. Never treat a draft as a proven connection.
