-- Public-source professional research ONLY. Never store user/private content here.
CREATE TABLE IF NOT EXISTS public_research (
  week_key TEXT NOT NULL,
  agent_id TEXT NOT NULL CHECK(agent_id IN (
    'nexus','story','orbit','polaris','forge','echo','pulse','link','discover'
  )),
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT,
  error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(week_key,agent_id)
);
CREATE INDEX IF NOT EXISTS research_status ON public_research(week_key,status);
