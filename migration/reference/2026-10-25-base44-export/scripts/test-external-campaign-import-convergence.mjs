import assert from 'node:assert/strict';
import {
  convergeExternalCampaignImport,
  externalCampaignImportTargetKey,
} from '../base44/functions/importExternalCampaign/importOperation.ts';
import { campaignForResponse } from '../base44/shared/campaignResponse.ts';

const matches = (row, filter) =>
  Object.entries(filter).every(([key, value]) => row[key] === value);

function makeHarness({ crashAfterCampaign = false } = {}) {
  const user = { id: 'user-1' };
  const connection = {
    id: 'connection-1',
    created_by_id: user.id,
    platform: 'gofundme',
    kind: 'crowdfunding',
    status: 'connected',
    verification_status: 'verified',
  };
  const campaigns = [{
    id: 'arbitrary-campaign',
    created_by_id: user.id,
    title: 'Owner-controlled campaign',
    status: 'draft',
  }];
  const imports = [];
  const operations = [];
  const syncRun = {
    id: 'run-1',
    active_claim_key: 'claim-1',
    overall_status: 'in_progress',
  };
  let nextId = 0;
  let campaignCreates = 0;
  let crash = crashAfterCampaign;

  const entity = (records) => ({
    async filter(filter) {
      return records.filter((row) => matches(row, filter)).map((row) => ({ ...row }));
    },
    async get(id) {
      const row = records.find((item) => item.id === id);
      return row ? { ...row } : null;
    },
    async create(data) {
      const row = { id: `record-${++nextId}`, created_by_id: user.id, ...data };
      records.push(row);
      return { ...row };
    },
    async update(id, patch) {
      const row = records.find((item) => item.id === id);
      if (!row) throw new Error('missing record');
      Object.assign(row, patch);
      return { ...row };
    },
    async updateMany(filter, update) {
      const found = records.filter((row) => matches(row, filter));
      if (crash && update?.$set?.campaign_id) {
        crash = false;
        throw new Error('simulated crash after Campaign.create');
      }
      found.forEach((row) => Object.assign(row, update.$set));
      return { updated: found.length };
    },
  });

  const operationEntity = entity(operations);
  const syncEntity = {
    async get(id) {
      return id === syncRun.id ? { ...syncRun } : null;
    },
    async updateMany(filter, update) {
      if (!matches(syncRun, filter)) return { updated: 0 };
      Object.assign(syncRun, update.$set);
      return { updated: 1 };
    },
  };
  const campaignEntity = entity(campaigns);
  const serviceCreateCampaign = campaignEntity.create;
  campaignEntity.create = async (data) => {
    campaignCreates++;
    return serviceCreateCampaign(data);
  };
  const importEntity = entity(imports);
  const ownerVisibleCampaign = (id) => {
    const row = campaigns.find((item) => item.id === id);
    if (!row) return null;
    const visible = { ...row };
    delete visible.external_import_private_marker;
    delete visible.external_import_recovery_token;
    return visible;
  };
  const rejectOwnerPrivateFields = (data) => {
    if ('external_import_private_marker' in data || 'external_import_recovery_token' in data) {
      throw new Error('field-level security rejected private import marker mutation');
    }
  };
  const ownerCreateCampaign = (data) => {
    rejectOwnerPrivateFields(data);
    const row = { id: `owner-campaign-${++nextId}`, created_by_id: user.id, ...data };
    campaigns.push(row);
    return ownerVisibleCampaign(row.id);
  };
  const ownerUpdateCampaign = (id, patch) => {
    rejectOwnerPrivateFields(patch);
    const row = campaigns.find((item) => item.id === id);
    if (!row) throw new Error('missing record');
    Object.assign(row, patch);
    return ownerVisibleCampaign(id);
  };

  const sr = {
    entities: {
      SyncRun: syncEntity,
      ExternalCampaignImportOperation: operationEntity,
      Campaign: campaignEntity,
      ExternalCampaignImport: importEntity,
      PlatformConnection: {
        async get(id) {
          return id === connection.id ? { ...connection } : null;
        },
        async update(id, patch) {
          assert.equal(id, connection.id);
          Object.assign(connection, patch);
          return { ...connection };
        },
      },
    },
  };
  const input = {
    sr,
    user,
    connection,
    incoming: { goal_amount: 500, external_campaign_id: 'provider-campaign-1' },
    requestId: '8c0b75c0-6b2d-4b14-8c0f-8c21f5df4781',
    requestFingerprint: JSON.stringify({ connection_id: connection.id, goal_amount: 500 }),
    run: { id: syncRun.id },
    claimKey: syncRun.active_claim_key,
  };
  return {
    user, connection, campaigns, imports, operations, syncRun, input,
    ownerVisibleCampaign,
    ownerCreateCampaign,
    ownerUpdateCampaign,
    get campaignCreates() { return campaignCreates; },
  };
}

const snapshot = {
  source: 'provider_public_campaign_page',
  source_url: 'https://www.gofundme.com/f/example',
  campaign: {
    title: 'Recovered fundraiser',
    summary: 'Provider summary',
    story: 'Provider story',
    category: 'other',
  },
};

// Crash recovery uses an admin-only operation plus a field-level protected
// campaign correlation marker. Owner/public reads cannot see the marker and
// owner updates cannot move it to another campaign.
{
  const h = makeHarness({ crashAfterCampaign: true });
  const ordinaryCampaign = h.ownerCreateCampaign({ title: 'Ordinary owner draft', status: 'draft' });
  assert.equal(ordinaryCampaign.title, 'Ordinary owner draft',
    'ordinary campaign creation without private fields must remain available');
  h.campaigns.pop();
  let discoveryCalls = 0;
  const discover = async () => {
    discoveryCalls++;
    return snapshot;
  };
  await assert.rejects(
    () => convergeExternalCampaignImport({ ...h.input, discover }),
    /simulated crash after Campaign\.create/,
  );
  assert.equal(h.campaigns.length, 2);
  assert.equal(h.campaignCreates, 1);
  const privateMarker = h.campaigns[1].external_import_private_marker;
  assert.equal(typeof privateMarker, 'string');
  assert.equal(h.campaigns[1].created_by_id, h.user.id,
    'service-role import must preserve the authenticated campaign owner');
  assert.equal(h.ownerVisibleCampaign(h.campaigns[1].id).external_import_private_marker, undefined,
    'owner reads must not reveal the private campaign marker');
  assert.equal(h.ownerVisibleCampaign(h.campaigns[1].id).external_import_recovery_token, undefined,
    'legacy recovery secrets must not be visible');
  const saveCampaignLikeResponse = campaignForResponse({
    ...h.campaigns[1],
    title: 'Saved through service-role update',
  });
  assert.equal(saveCampaignLikeResponse.external_import_private_marker, undefined,
    'saveCampaign-like service-role serialization must not reveal the private marker');
  assert.equal(saveCampaignLikeResponse.external_import_recovery_token, undefined,
    'saveCampaign-like service-role serialization must not reveal legacy secrets');
  assert.throws(
    () => h.ownerCreateCampaign({
      title: 'Replacement campaign',
      status: 'draft',
      external_import_private_marker: privateMarker,
    }),
    /field-level security rejected/,
    'owners must not create an arbitrary campaign carrying the private marker',
  );
  assert.throws(
    () => h.ownerUpdateCampaign(h.campaigns[0].id, { external_import_private_marker: privateMarker }),
    /field-level security rejected/,
    'owners must not move the private marker to an arbitrary campaign',
  );
  h.ownerUpdateCampaign(h.campaigns[0].id, { title: 'Mutated owner-visible campaign' });
  h.ownerUpdateCampaign(h.campaigns[1].id, { title: 'Mutated legitimate draft title' });

  h.syncRun.active_claim_key = 'claim-2';
  const recovered = await convergeExternalCampaignImport({
    ...h.input,
    requestId: 'f95911e3-aaf2-48a9-bd43-2f38a265de1e',
    claimKey: 'claim-2',
    discover,
  });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.campaign.id, h.campaigns[1].id);
  assert.equal(h.campaigns.length, 2, 'retry reuses the one legitimate draft');
  assert.equal(h.imports.length, 1);
  assert.equal(h.imports[0].recovery_token, undefined,
    'owner-readable import records must not copy the recovery secret');
  assert.equal(recovered.result.campaign.external_import_private_marker, undefined,
    'function responses must not serialize the private marker');
  assert.equal(recovered.result.import_record.connection_id, undefined,
    'function responses must not serialize raw connection identifiers');
  assert.equal(recovered.result.import_record.operation_key, undefined,
    'function responses must not serialize private operation identifiers');
  assert.equal(recovered.result.import_record.owner_user_id, undefined,
    'function responses must not serialize internal ownership fields');
  assert.equal(recovered.result.import_record.recovery_token, undefined,
    'function responses must not serialize legacy recovery secrets');
  assert.equal(JSON.stringify(recovered.result).includes(privateMarker), false,
    'function results and stored result payloads must not expose the recovery secret');
  assert.equal(h.connection.campaign_id, h.campaigns[1].id);
  assert.equal(discoveryCalls, 1, 'durable private snapshot avoids rediscovery');
}

// A paused expired holder is rejected when it resumes after the retry has
// replaced active_claim_key; only the retry may create durable import state.
{
  const h = makeHarness();
  let releaseOld;
  let oldEntered;
  const entered = new Promise((resolve) => { oldEntered = resolve; });
  const blockedDiscover = async () => {
    oldEntered();
    await new Promise((resolve) => { releaseOld = resolve; });
    return snapshot;
  };
  const stale = convergeExternalCampaignImport({ ...h.input, discover: blockedDiscover });
  await entered;

  h.syncRun.active_claim_key = 'claim-2';
  const winner = await convergeExternalCampaignImport({
    ...h.input,
    requestId: '00000000-0000-4000-8000-000000000003',
    claimKey: 'claim-2',
    discover: async () => snapshot,
  });
  releaseOld();
  await assert.rejects(stale, (error) => error?.code === 'claim_lost');
  assert.equal(winner.campaign.id, h.connection.campaign_id);
  assert.equal(h.campaignCreates, 1);
  assert.equal(h.imports.length, 1);
  assert.equal(h.operations.length, 1);
}

const target = await externalCampaignImportTargetKey('user-1', 'connection-1');
assert.match(target, /^campaign_import:v1:[a-f0-9]{64}$/);
console.log('External campaign import private recovery and stale-claim fencing passed');
