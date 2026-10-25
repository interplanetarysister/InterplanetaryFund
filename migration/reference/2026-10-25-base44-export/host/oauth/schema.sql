-- D1 schema for admin-authorized Make OAuth clients and grants.
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  scope TEXT NOT NULL,
  expires INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS oauth_tokens_client ON oauth_tokens(client_id);
CREATE TABLE IF NOT EXISTS oauth_consent (
  nonce_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  state TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_refresh (
  refresh_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(id),
  scope TEXT NOT NULL,
  expires INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
