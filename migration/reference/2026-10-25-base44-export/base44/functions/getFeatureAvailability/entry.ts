import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { FEATURE_SCOPES } from '../../shared/featureFlagGate.ts';

// Public display hints only. Backend enforces every protected operation.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const flags = await base44.asServiceRole.entities.FeatureFlag.list('-created_date', 100);
    const available: Record<string, boolean> = {};
    for (const key of Object.keys(FEATURE_SCOPES)) {
      const matches = Array.isArray(flags) ? flags.filter(f => f.key === key) : [];
      available[key] = matches.length === 1 &&
        matches[0].scope === FEATURE_SCOPES[key] &&
        matches[0].enabled === true;
    }
    return Response.json({ available }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('getFeatureAvailability failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ available: {}, error: 'Feature availability temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
