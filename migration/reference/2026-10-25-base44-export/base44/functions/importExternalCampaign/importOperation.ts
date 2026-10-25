import {
  assertExternalSyncClaimActive,
  ExternalSyncRequestError,
} from '../../shared/externalSyncRequest.ts';
import { campaignForResponse } from '../../shared/campaignResponse.ts';

const ALLOWED = ['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];

const rows = async (entity, filter, limit = 3) => {
  const found = await entity.filter(filter, '-created_date', limit);
  return Array.isArray(found) ? found : [];
};

const unavailable = (message) =>
  new ExternalSyncRequestError('backend_unavailable', message, 503);

const requireOne = (records, message) => {
  if (records.length !== 1) throw unavailable(message);
  return records[0];
};

const withoutPrivateImportFields = (imported) => {
  const publicImport = { ...imported };
  delete publicImport.recovery_token;
  delete publicImport.connection_id;
  delete publicImport.operation_key;
  delete publicImport.owner_user_id;
  return publicImport;
};

export async function externalCampaignImportTargetKey(ownerUserId, connectionId) {
  const input = new TextEncoder().encode(
    `campaign_import:v1:${String(ownerUserId)}:${String(connectionId)}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', input);
  const encoded = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `campaign_import:v1:${encoded}`;
}

async function fence(sr, run, claimKey) {
  await assertExternalSyncClaimActive(sr, run, claimKey);
}

async function updateOperation(sr, operation, claimKey, patch) {
  const result = await sr.entities.ExternalCampaignImportOperation.updateMany(
    { id: operation.id, target_key: operation.target_key, active_claim_key: claimKey },
    { $set: patch },
  );
  if (Number(result?.updated || 0) !== 1) {
    throw new ExternalSyncRequestError('claim_lost', 'Campaign import claim is no longer active.', 409);
  }
  const current = await sr.entities.ExternalCampaignImportOperation.get(operation.id);
  if (!current || current.active_claim_key !== claimKey) {
    throw new ExternalSyncRequestError('claim_lost', 'Campaign import operation could not be fenced.', 409);
  }
  return current;
}

export async function convergeExternalCampaignImport({
  sr,
  user,
  connection,
  incoming,
  requestId,
  requestFingerprint,
  run,
  claimKey,
  discover,
}) {
  const targetKey = await externalCampaignImportTargetKey(user.id, connection.id);
  const operationFilter = { target_key: targetKey };
  let operations = await rows(sr.entities.ExternalCampaignImportOperation, operationFilter);
  if (operations.length > 1) throw unavailable('External campaign import operation is ambiguous.');

  let operation = operations[0] || null;
  let recovered = Boolean(operation);
  if (!operation) {
    await fence(sr, run, claimKey);
    const recoveryToken = crypto.randomUUID();
    await sr.entities.ExternalCampaignImportOperation.create({
      target_key: targetKey,
      owner_user_id: user.id,
      connection_id: connection.id,
      request_fingerprint: requestFingerprint,
      active_claim_key: claimKey,
      recovery_token: recoveryToken,
      request_id: requestId,
      state: 'claimed',
    });
    operations = await rows(sr.entities.ExternalCampaignImportOperation, operationFilter);
    operation = requireOne(operations, 'External campaign import operation could not be verified.');
  } else {
    if (operation.owner_user_id !== user.id ||
        operation.connection_id !== connection.id ||
        operation.request_fingerprint !== requestFingerprint) {
      throw unavailable('External campaign import operation ownership could not be verified.');
    }
    await fence(sr, run, claimKey);
    const result = await sr.entities.ExternalCampaignImportOperation.updateMany(
      { id: operation.id, target_key: targetKey, active_claim_key: operation.active_claim_key },
      { $set: { active_claim_key: claimKey, request_id: requestId } },
    );
    if (Number(result?.updated || 0) !== 1) {
      throw new ExternalSyncRequestError('claim_lost', 'Campaign import operation was claimed by another attempt.', 409);
    }
    operation = await sr.entities.ExternalCampaignImportOperation.get(operation.id);
    if (!operation || operation.active_claim_key !== claimKey) {
      throw new ExternalSyncRequestError('claim_lost', 'Campaign import operation claim could not be verified.', 409);
    }
  }

  let snapshot = operation.snapshot
    ? { source: operation.source, source_url: operation.source_url, campaign: operation.snapshot }
    : null;
  if (!snapshot) {
    await fence(sr, run, claimKey);
    snapshot = await discover(connection);
    await fence(sr, run, claimKey);
    operation = await updateOperation(sr, operation, claimKey, {
      source: snapshot.source,
      source_url: snapshot.source_url,
      snapshot: snapshot.campaign,
      imported_at: new Date().toISOString(),
      state: 'discovered',
    });
  }

  let campaign = null;
  if (operation.campaign_id) {
    campaign = await sr.entities.Campaign.get(operation.campaign_id);
    if (!campaign || campaign.created_by_id !== user.id ||
        campaign.external_import_private_marker !== operation.recovery_token) {
      throw unavailable('Recovered campaign ownership could not be verified.');
    }
  } else {
    const candidates = await rows(sr.entities.Campaign, {
      external_import_private_marker: operation.recovery_token,
    });
    if (candidates.length > 1) throw unavailable('Campaign recovery identity is ambiguous.');
    campaign = candidates[0] || null;
    if (campaign && campaign.created_by_id !== user.id) {
      throw unavailable('Recovered campaign ownership could not be verified.');
    }
    if (!campaign) {
      await fence(sr, run, claimKey);
      campaign = await sr.entities.Campaign.create({
        ...snapshot.campaign,
        created_by_id: user.id,
        status: 'draft',
        goal_amount: Number(incoming.goal_amount),
        external_import_private_marker: operation.recovery_token,
      });
      const verified = await rows(sr.entities.Campaign, {
        external_import_private_marker: operation.recovery_token,
      });
      campaign = requireOne(verified, 'Created campaign recovery identity could not be verified.');
      if (campaign.created_by_id !== user.id) {
        throw unavailable('Created campaign ownership could not be verified.');
      }
    }
    await fence(sr, run, claimKey);
    operation = await updateOperation(sr, operation, claimKey, {
      campaign_id: campaign.id,
      state: 'campaign_created',
    });
  }

  let imported = null;
  if (operation.import_id) {
    imported = await sr.entities.ExternalCampaignImport.get(operation.import_id);
    if (!imported || imported.owner_user_id !== user.id ||
        imported.connection_id !== connection.id ||
        imported.campaign_id !== campaign.id ||
        imported.operation_key !== targetKey) {
      throw unavailable('Recovered import record ownership could not be verified.');
    }
  } else {
    const candidates = await rows(sr.entities.ExternalCampaignImport, {
      operation_key: targetKey,
    });
    if (candidates.length > 1) throw unavailable('Campaign import record is ambiguous.');
    imported = candidates[0] || null;
    if (!imported) {
      const importedAt = operation.imported_at || new Date().toISOString();
      const provenance = {};
      for (const key of ALLOWED) {
        if (campaign[key] === undefined) continue;
        provenance[key] = {
          source: key === 'goal_amount'
            ? 'owner_supplied'
            : key === 'category' ? 'system_default' : operation.source,
          connection_id: connection.id,
          imported_at: importedAt,
          source_value: campaign[key],
        };
      }
      await fence(sr, run, claimKey);
      imported = await sr.entities.ExternalCampaignImport.create({
        owner_user_id: user.id,
        connection_id: connection.id,
        operation_key: targetKey,
        request_id: requestId,
        platform: connection.platform,
        external_campaign_id: String(incoming.external_campaign_id || ''),
        external_url: operation.source_url || '',
        campaign_id: campaign.id,
        sync_enabled: false,
        last_imported_at: importedAt,
        field_provenance: provenance,
        locally_locked_fields: [],
        status: 'imported',
      });
      const verified = await rows(sr.entities.ExternalCampaignImport, {
        operation_key: targetKey,
      });
      imported = requireOne(verified, 'External campaign import record could not be verified.');
    }
    if (imported.owner_user_id !== user.id || imported.connection_id !== connection.id ||
        imported.campaign_id !== campaign.id) {
      throw unavailable('External campaign import record ownership could not be verified.');
    }
    await fence(sr, run, claimKey);
    operation = await updateOperation(sr, operation, claimKey, { import_id: imported.id });
  }

  if (connection.campaign_id !== campaign.id) {
    await fence(sr, run, claimKey);
    await sr.entities.PlatformConnection.update(connection.id, { campaign_id: campaign.id });
  }
  const verifiedConnection = await sr.entities.PlatformConnection.get(connection.id);
  if (!verifiedConnection || verifiedConnection.created_by_id !== user.id ||
      verifiedConnection.campaign_id !== campaign.id) {
    throw unavailable('Connected fundraiser campaign link could not be verified.');
  }

  await fence(sr, run, claimKey);
  operation = await updateOperation(sr, operation, claimKey, { state: 'completed' });

  return {
    targetKey,
    recovered,
    campaign,
    imported,
    result: {
      ok: true,
      duplicate: recovered,
      request_id: requestId,
      campaign_id: campaign.id,
      campaign: campaignForResponse(campaign),
      import_record: withoutPrivateImportFields(imported),
    },
  };
}
