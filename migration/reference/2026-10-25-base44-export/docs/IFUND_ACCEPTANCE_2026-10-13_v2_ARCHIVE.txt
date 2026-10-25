import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const TERMS_VERSION = '2026-10-13-v2';

// Only the signed-in owner can record an acceptance; data written by the server.
// This is an audit record, never an AI, external account, or money authorization.
export default async function (req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const userId = String(activeAccount.user?.id || '');
    if (!userId) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
    const input = await req.json().catch(() => ({}));
    const mode = String(input.mode || 'status');
    if (mode !== 'status' && mode !== 'accept') {
      return Response.json({ error: 'Unsupported action.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const accepted = await sr.entities.LegalAcceptance.filter({
      owner_user_id: userId, terms_version: TERMS_VERSION,
    });
    if (accepted?.length) return Response.json({ accepted: true, terms_version: TERMS_VERSION });
    if (mode === 'status') return Response.json({ accepted: false, terms_version: TERMS_VERSION });

    // Explicit assent must be separate from clicking a page or accessing a URL.
    if (input.explicit_consent !== true || input.terms_version !== TERMS_VERSION) {
      return Response.json({ error: 'Review and accept the current terms before continuing.' }, { status: 400 });
    }
    await sr.entities.LegalAcceptance.create({
      owner_user_id: userId,
      terms_version: TERMS_VERSION,
      accepted_at: new Date().toISOString(),
      acceptance_method: 'explicit_checkbox_and_button',
      terms_path: '/terms',
      privacy_path: '/privacy',
    });
    return Response.json({ accepted: true, terms_version: TERMS_VERSION });
  } catch (error) {
    console.error('recordLegalAcceptance failure:', error?.name || 'UnexpectedError');
    return Response.json({ error: 'Agreement could not be confirmed. Please try again.' }, { status: 503 });
  }
}
