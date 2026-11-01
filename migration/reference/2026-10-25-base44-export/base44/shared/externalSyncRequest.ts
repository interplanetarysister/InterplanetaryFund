export const EXTERNAL_SYNC_RUN_TTL_MS = 10 * 60 * 1000;
export const EXTERNAL_SYNC_RATE_WINDOW_MS = 60 * 1000;
export const EXTERNAL_SYNC_RATE_LIMIT = 5;

export const validExternalSyncRequestId = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || '').trim());

export function externalSyncRequestKey(jobType, actorUserId, requestId) {
  return `${String(jobType)}:${String(actorUserId)}:${String(requestId).toLowerCase()}`;
}

export function crowdfundingConnectionEligibility(connection, ownerUserId) {
  if (!connection || connection.kind !== 'crowdfunding') return { ok: false, reason: 'not_crowdfunding' };
  if (!ownerUserId || connection.created_by_id !== ownerUserId) return { ok: false, reason: 'owner_mismatch' };
  if (connection.status !== 'connected') return { ok: false, reason: 'disconnected' };
  if (connection.verification_status !== 'verified') return { ok: false, reason: 'unverified' };
  if (connection.capability_status === 'reauthorization_required') return { ok: false, reason: 'reauthorization_required' };
  // Purpose-specific provider consent is optional on legacy link connections.
  // When present, an explicit refusal/revocation always fails closed. AI/OBO
  // publishing consent is deliberately not treated as fundraising-data consent.
  const consent = connection.fundraising_data_consent;
  if (consent?.granted === false || consent?.revoked_at) return { ok: false, reason: 'consent_revoked' };
  return { ok: true, reason: '' };
}

export function authorizeExternalSyncScope({ actorId, actorRole, scope, campaignOwnerId, oboUserId }) {
  const isAdmin = actorRole === 'admin' || actorRole === 'super_admin';
  if (!['user', 'campaign', 'all'].includes(scope)) return { ok: false, status: 400, reason: 'invalid_scope' };
  if (scope === 'all' && !isAdmin) return { ok: false, status: 403, reason: 'admin_required' };
  if (oboUserId && (!isAdmin || scope !== 'user')) return { ok: false, status: 403, reason: 'obo_not_allowed' };
  if (scope === 'campaign' && campaignOwnerId && !isAdmin && campaignOwnerId !== actorId) return { ok: false, status: 403, reason: 'owner_required' };
  return { ok: true, status: 200, reason: '' };
}

export class ExternalSyncRequestError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'ExternalSyncRequestError';
    this.code = code;
    this.status = status;
  }
}

const time = (value) => new Date(value || 0).getTime();
const isFinal = (status) => status && status !== 'in_progress';

const EXTERNAL_SYNC_MUTEX_KEY = 'mutex:external-sync:v1';
const EXTERNAL_SYNC_MUTEX_LEASE_MS = 2 * 60 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exactClaims(sr, filter, limit = 3) {
  const rows = await sr.entities.ExternalSyncClaim.filter(filter, '-created_date', limit);
  return Array.isArray(rows) ? rows : [];
}

async function acquireExternalSyncMutex(sr, nowMs) {
  // claim_key is not database-unique, so request traffic must never bootstrap
  // this coordinator by creating a row. Provision exactly one mutex record as
  // controlled release data; zero or multiple rows fail closed without writes.
  let rows;
  try {
    rows = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
    if (rows.length === 0) {
      throw new ExternalSyncRequestError(
        'backend_unavailable',
        'Synchronization safeguards are not provisioned. Try again later.',
      );
    }
  } catch (error) {
    if (error instanceof ExternalSyncRequestError) throw error;
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are unavailable. Try again later.');
  }
  if (rows.length !== 1) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are ambiguous. Try again later.');
  }

  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 40; attempt++) {
    const currentRows = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
    if (currentRows.length !== 1) {
      throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are ambiguous. Try again later.');
    }
    const current = currentRows[0];
    const currentExpiry = String(current.lock_expires_at || '');
    const expiresAt = time(currentExpiry);
    const currentToken = String(current.lock_token || '');
    if (!currentToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      const result = await sr.entities.ExternalSyncClaim.updateMany(
        {
          id: current.id,
          claim_key: EXTERNAL_SYNC_MUTEX_KEY,
          lock_token: currentToken,
          lock_expires_at: currentExpiry,
        },
        { $set: {
          lock_token: token,
          lock_expires_at: new Date(Math.max(Date.now(), nowMs) + EXTERNAL_SYNC_MUTEX_LEASE_MS).toISOString(),
        } },
      );
      if (Number(result?.updated || 0) === 1) {
        const verified = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
        if (verified.length === 1 &&
            verified[0].id === current.id &&
            verified[0].lock_token === token &&
            time(verified[0].lock_expires_at) > Date.now()) {
          return { id: current.id, token, expiresAt: verified[0].lock_expires_at };
        }
        throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards could not be verified.');
      }
    }
    await wait(15);
  }
  throw new ExternalSyncRequestError('backend_unavailable', 'Another synchronization request is being recorded. Try again.');
}

async function renewAndVerifyExternalSyncMutex(sr, mutex) {
  if (!mutex) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization lease is unavailable.');
  }
  const rows = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
  const current = rows.length === 1 ? rows[0] : null;
  const previousExpiry = current?.lock_expires_at;
  if (!current ||
      current.id !== mutex.id ||
      current.lock_token !== mutex.token ||
      time(previousExpiry) <= Date.now()) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization lease ownership was lost.');
  }

  const renewedExpiry = new Date(Date.now() + EXTERNAL_SYNC_MUTEX_LEASE_MS).toISOString();
  const result = await sr.entities.ExternalSyncClaim.updateMany(
    {
      id: mutex.id,
      claim_key: EXTERNAL_SYNC_MUTEX_KEY,
      lock_token: mutex.token,
      lock_expires_at: previousExpiry,
    },
    { $set: { lock_expires_at: renewedExpiry } },
  );
  if (Number(result?.updated || 0) !== 1) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization lease renewal failed.');
  }

  const verified = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
  if (verified.length !== 1 ||
      verified[0].id !== mutex.id ||
      verified[0].lock_token !== mutex.token ||
      verified[0].lock_expires_at !== renewedExpiry ||
      time(verified[0].lock_expires_at) <= Date.now()) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization lease renewal could not be verified.');
  }
  mutex.expiresAt = renewedExpiry;
  return mutex;
}

async function releaseExternalSyncMutex(sr, mutex) {
  if (!mutex) return;
  await sr.entities.ExternalSyncClaim.updateMany(
    { id: mutex.id, claim_key: EXTERNAL_SYNC_MUTEX_KEY, lock_token: mutex.token },
    { $set: { lock_token: '', lock_expires_at: new Date(0).toISOString() } },
  ).catch(() => {});
}

async function acquireExternalSyncRateSlot(sr, mutex, options, requestKey, nowMs, now) {
  const windowStartMs = Math.floor(nowMs / EXTERNAL_SYNC_RATE_WINDOW_MS) * EXTERNAL_SYNC_RATE_WINDOW_MS;
  const windowStartedAt = new Date(windowStartMs).toISOString();
  const records = await exactClaims(sr, {
    claim_type: 'rate_slot',
    job_type: options.jobType,
    actor_user_id: options.actorUserId,
    rate_window_started_at: windowStartedAt,
  }, EXTERNAL_SYNC_RATE_LIMIT + 2);

  const owned = records.find((row) => row.request_key === requestKey);
  if (owned) {
    if (owned.request_fingerprint !== options.fingerprint) {
      throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
    }
    return;
  }
  if (records.length >= EXTERNAL_SYNC_RATE_LIMIT) {
    throw new ExternalSyncRequestError('rate_limited', 'Too many synchronization requests. Wait a minute and try again.', 429);
  }

  const claimKey = `rate:${String(options.jobType)}:${String(options.actorUserId)}:${windowStartMs}:${requestKey}`;
  await renewAndVerifyExternalSyncMutex(sr, mutex);
  await sr.entities.ExternalSyncClaim.create({
    claim_key: claimKey,
    claim_type: 'rate_slot',
    request_key: requestKey,
    request_id: options.requestId,
    request_fingerprint: options.fingerprint,
    job_type: options.jobType,
    actor_user_id: options.actorUserId,
    attempt_number: 0,
    claimed_at: now,
    rate_window_started_at: windowStartedAt,
    rate_slot: records.length,
  });
  const verified = await exactClaims(sr, { claim_key: claimKey });
  if (verified.length !== 1 ||
      verified[0].request_key !== requestKey ||
      verified[0].request_fingerprint !== options.fingerprint) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization rate claim could not be verified.');
  }
}

export async function beginExternalSyncRequest(sr, options) {
  const nowMs = options.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const requestKey = externalSyncRequestKey(options.jobType, options.actorUserId, options.requestId);
  const targetKey = String(options.targetKey || '').trim();
  let mutex = null;

  try {
    mutex = await acquireExternalSyncMutex(sr, nowMs);

    // All idempotency, rate-limit, claim, and run writes occur while the
    // conditional global lease is held. Provider I/O begins only after an
    // immutable request claim and its SyncRun have both been verified.
    const [runs, claims, targetRuns] = await Promise.all([
      sr.entities.SyncRun.filter({ request_key: requestKey }, '-created_date', 5),
      exactClaims(sr, { request_key: requestKey }, 10),
      targetKey
        ? sr.entities.SyncRun.filter({ target_key: targetKey }, '-created_date', 5)
        : Promise.resolve([]),
    ]);
    if ((runs || []).length > 1 || (targetRuns || []).length > 1) {
      throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization request state is ambiguous.');
    }

    const requestRun = runs?.[0] || null;
    const targetRun = targetRuns?.[0] || null;
    if (requestRun && targetRun && requestRun.id !== targetRun.id) {
      throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
    }
    const existing = targetRun || requestRun;
    const attemptClaims = (claims || []).filter((row) => row.claim_type !== 'rate_slot');
    const conflicting = [...(claims || []), ...(runs || [])]
      .find((row) => row.request_fingerprint && row.request_fingerprint !== options.fingerprint);
    if (conflicting) {
      throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
    }
    if (targetRun?.request_fingerprint && targetRun.request_fingerprint !== options.fingerprint) {
      throw new ExternalSyncRequestError('target_conflict', 'This target already has an import with different parameters.', 409);
    }
    if (existing && isFinal(existing.overall_status) &&
        (!targetKey || existing.overall_status !== 'failed')) {
      return { disposition: 'completed', run: existing, requestKey, targetKey };
    }

    const latestClaim = [...attemptClaims]
      .sort((a, b) => Number(b.attempt_number || 0) - Number(a.attempt_number || 0))[0] || null;
    const activeStartedAt = existing?.started_at || latestClaim?.claimed_at;
    const activeAge = nowMs - time(activeStartedAt);
    if ((existing?.overall_status === 'in_progress' || (!existing && latestClaim)) &&
        Number.isFinite(activeAge) && activeAge >= 0 && activeAge < EXTERNAL_SYNC_RUN_TTL_MS) {
      return { disposition: 'in_progress', run: existing, requestKey };
    }

    await acquireExternalSyncRateSlot(sr, mutex, options, requestKey, nowMs, now);

    const attempt = Math.max(Number(existing?.attempt_number || 0), Number(latestClaim?.attempt_number || 0)) + 1;
    const claimKey = `${requestKey}:${attempt}`;
    const sameKey = await exactClaims(sr, { claim_key: claimKey });
    if (sameKey.length > 1) {
      throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization claim state is ambiguous.');
    }
    if (sameKey.length === 1) {
      if (sameKey[0].request_fingerprint !== options.fingerprint) {
        throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
      }
      return { disposition: 'in_progress', run: existing, requestKey, claimKey };
    }

    await renewAndVerifyExternalSyncMutex(sr, mutex);
    await sr.entities.ExternalSyncClaim.create({
      claim_key: claimKey,
      claim_type: 'request_attempt',
      request_key: requestKey,
      request_id: options.requestId,
      request_fingerprint: options.fingerprint,
      job_type: options.jobType,
      actor_user_id: options.actorUserId,
      attempt_number: attempt,
      claimed_at: now,
    });
    const verifiedClaim = await exactClaims(sr, { claim_key: claimKey });
    if (verifiedClaim.length !== 1 ||
        verifiedClaim[0].request_key !== requestKey ||
        verifiedClaim[0].request_fingerprint !== options.fingerprint) {
      throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization claim could not be verified.');
    }

    const runData = {
      request_key: requestKey,
      request_id: options.requestId,
      request_fingerprint: options.fingerprint,
      target_key: targetKey || null,
      job_type: options.jobType,
      initiator_type: options.initiatorType || 'user',
      initiator_id: options.actorUserId,
      initiator_user_id: options.actorUserId,
      scope: options.scope || 'user',
      campaign_id: options.campaignId || null,
      started_at: now,
      completed_at: null,
      overall_status: 'in_progress',
      provider_results: [],
      total_discovered: 0,
      discovered_totals: [],
      total_imported: 0,
      campaigns_covered: 0,
      attempt_number: attempt,
      active_claim_key: claimKey,
      description: attempt > 1 ? 'Retrying a stale authenticated explicit request.' : 'Authenticated explicit request is in progress.',
    };
    await renewAndVerifyExternalSyncMutex(sr, mutex);
    let run;
    if (existing) {
      // A stale-at-read retry may race a live worker heartbeat. Replace the
      // attempt only if the exact state observed above is still current.
      const takeoverFilter = {
        id: existing.id,
        active_claim_key: existing.active_claim_key,
        overall_status: existing.overall_status,
        started_at: existing.started_at,
        ...(existing.claim_checked_at !== undefined
          ? { claim_checked_at: existing.claim_checked_at }
          : {}),
      };
      const takeover = await sr.entities.SyncRun.updateMany(
        takeoverFilter,
        { $set: runData },
      );
      if (Number(takeover?.updated || 0) !== 1) {
        throw new ExternalSyncRequestError('claim_lost', 'Synchronization retry lost its takeover race.', 409);
      }
      run = await sr.entities.SyncRun.get(existing.id);
      if (!run || run.active_claim_key !== claimKey || run.overall_status !== 'in_progress') {
        throw new ExternalSyncRequestError('claim_lost', 'Synchronization retry could not be verified.', 409);
      }
    } else {
      run = await sr.entities.SyncRun.create(runData);
    }
    return { disposition: 'acquired', run, requestKey, claimKey };
  } catch (error) {
    if (error instanceof ExternalSyncRequestError) throw error;
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are unavailable. Try again later.');
  } finally {
    await releaseExternalSyncMutex(sr, mutex);
  }
}

export async function finishExternalSyncRequest(sr, run, claimKey, patch) {
  const completedAt = patch.completed_at || new Date().toISOString();
  const result = await sr.entities.SyncRun.updateMany(
    { id: run.id, active_claim_key: claimKey, overall_status: 'in_progress' },
    { $set: { ...patch, completed_at: completedAt } },
  );
  if (Number(result?.updated || 0) !== 1) {
    throw new ExternalSyncRequestError('claim_lost', 'Synchronization claim is no longer active.', 409);
  }

  const current = await sr.entities.SyncRun.get(run.id);
  if (!current ||
      current.active_claim_key !== claimKey ||
      current.overall_status !== patch.overall_status ||
      current.completed_at !== completedAt) {
    throw new ExternalSyncRequestError('claim_lost', 'Synchronization completion could not be verified.', 409);
  }
  return current;
}

// Revalidate the exact attempt immediately before provider I/O or a durable
// side effect. A plain read can be stale while a TTL retry replaces the claim.
export async function assertExternalSyncClaimActive(sr, run, claimKey) {
  const checkedAt = new Date().toISOString();
  const result = await sr.entities.SyncRun.updateMany(
    { id: run.id, active_claim_key: claimKey, overall_status: 'in_progress' },
    // started_at is the liveness heartbeat used by stale-takeover detection.
    // Renewing it in the same CAS prevents a retry from replacing an active
    // worker based on an obsolete start time.
    { $set: { claim_checked_at: checkedAt, started_at: checkedAt } },
  );
  if (Number(result?.updated || 0) !== 1) {
    throw new ExternalSyncRequestError('claim_lost', 'Synchronization claim is no longer active.', 409);
  }
  const current = await sr.entities.SyncRun.get(run.id);
  if (!current || current.active_claim_key !== claimKey ||
      current.overall_status !== 'in_progress' || current.claim_checked_at !== checkedAt ||
      current.started_at !== checkedAt) {
    throw new ExternalSyncRequestError('claim_lost', 'Synchronization claim could not be fenced.', 409);
  }
  return current;
}

export async function failExternalSyncRequest(sr, run, claimKey, description) {
  try {
    return await finishExternalSyncRequest(sr, run, claimKey, {
      overall_status: 'failed',
      description: description || 'The authenticated explicit request failed before completion.',
    });
  } catch (error) {
    if (error?.code === 'claim_lost') return null;
    throw error;
  }
}