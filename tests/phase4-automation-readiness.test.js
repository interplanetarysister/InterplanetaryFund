import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.js';
import {
  AGENTS, CONNECTOR_IDS, WORKFLOWS, readinessSummary, workflowExecutable,
} from '../worker/automationRegistry.js';

test('source agent, workflow and connector census remains complete and unique', () => {
  assert.equal(AGENTS.length, 10);
  assert.equal(WORKFLOWS.length, 17);
  assert.equal(CONNECTOR_IDS.length, 11);
  assert.equal(new Set(AGENTS).size, AGENTS.length);
  assert.equal(new Set(WORKFLOWS.map(w => w.id)).size, WORKFLOWS.length);
  assert.equal(new Set(CONNECTOR_IDS).size, CONNECTOR_IDS.length);
  for (const item of WORKFLOWS) {
    assert.ok(item.handlers.length >= 1);
    assert.equal(item.ported, false);
    if (item.kind === 'scheduled') {
      assert.ok(item.cron);
      assert.ok(item.timezone);
    } else {
      assert.ok(item.entityName);
      assert.ok(item.events.length);
    }
  }
});

test('all workflows refuse execution, including with forged enablement and consent', () => {
  for (const workflow of WORKFLOWS) {
    assert.equal(workflowExecutable(workflow.id), false);
    assert.equal(workflowExecutable(workflow.id, {
      internalCallerVerified: true,
      ownerScopeVerified: true,
      durableQueueReady: true,
      auditReady: true,
      consentVerified: true,
      budgetApproved: true,
      providerWebhookVerified: true,
      ledgerReconciled: true,
      providerGrantsVerified: true,
      productionReleaseApproved: true,
    }), false);
  }
  assert.equal(workflowExecutable('unknown'), false);
});

test('readiness cannot claim active agents or social/payment connections', () => {
  const readiness = readinessSummary();
  assert.equal(readiness.state, 'not_connected');
  assert.equal(readiness.execution_enabled, false);
  assert.equal(readiness.verified_active_agents, 0);
  assert.equal(readiness.verified_active_workflows, 0);
  assert.equal(readiness.verified_connected_providers, 0);
});

test('web/mobile readiness route reveals no internal agent instructions or grant state', async () => {
  const r = await worker.fetch(new Request('https://example.org/api/automations/readiness'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const value = await r.json();
  assert.equal(value.source_agents, 10);
  assert.equal(value.source_workflows, 17);
  assert.equal(value.execution_enabled, false);
  assert.equal(JSON.stringify(value).includes('admin_builder_agent'), false);
  assert.equal(JSON.stringify(value).includes('PAYPAL_CLIENT_SECRET'), false);
  const post = await worker.fetch(new Request('https://example.org/api/automations/readiness', { method: 'POST' }));
  assert.equal(post.status, 405);
  const attempt = await worker.fetch(new Request('https://example.org/api/automations/dispatch', { method: 'POST' }));
  assert.equal(attempt.status, 404);
});
