import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/20261119170500_ifund_fk_index_reconciliation.sql', import.meta.url), 'utf8');
const expected = [["ifund_agent_team_events","campaign_id"],["ifund_agent_team_events","corrected_by"],["ifund_echo_inapp_deliveries","campaign_id"],["ifund_editorial_agent_reviews","campaign_id"],["ifund_event_items","event_id, owner_id"],["ifund_event_items","owner_id"],["ifund_event_registrations","item_id, event_id"],["ifund_events","campaign_id"],["ifund_growth_experiments","campaign_id"],["ifund_mobile_organizer_blocks","organizer_id"],["ifund_opportunity_watches","opportunity_id"],["ifund_social_archive_likes","member_id"],["ifund_social_archive_reports","reporter_id"],["ifund_social_archive_reports","reviewed_by"],["ifund_social_likes","member_id"],["ifund_social_reports","reporter_id"],["ifund_social_reports","reviewed_by"],["ifund_support_replies","author_id"]];
test('all 18 independently advised foreign keys get additive indexes', () => {
  const statements = sql.match(/^CREATE INDEX IF NOT EXISTS .+;$/gm) || [];
  assert.equal(statements.length, expected.length);
  for (const [table, columns] of expected) {
    assert.equal(statements.filter(s => s.includes(' ON public.' + table + ' (' + columns + ')')).length, 1, table + '.' + columns);
  }
  assert.equal(new Set(statements.map(s=>s.match(/^CREATE INDEX IF NOT EXISTS ([a-z_0-9]+)/)[1])).size, expected.length);
});
test('performance repair cannot weaken security or mutate user/financial records', () => {
  const code = sql.replace(/--[^\n]*/g, '').trim();
  const statements = code.split(';').map(x=>x.trim()).filter(Boolean);
  assert.equal(statements.length, 18);
  for(const statement of statements) assert.match(statement, /^CREATE INDEX IF NOT EXISTS [a-z0-9_]+ ON public\.[a-z0-9_]+ \([a-z0-9_, ]+\)$/i);
  assert.doesNotMatch(code,/\b(ALTER|DROP|DELETE|UPDATE|INSERT|GRANT|REVOKE|TRUNCATE|POLICY|FUNCTION)\b/i);
});
