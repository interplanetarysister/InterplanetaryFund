import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Lists grant applications for an institution — only the institution's owner
// (or an admin) may read them. Service-scoped after an ownership check.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { institution_id } = await req.json();
    if (!institution_id) return Response.json({ error: 'Missing institution_id' }, { status: 400 });

    const institution = await base44.asServiceRole.entities.Institution.get(institution_id);
    if (!institution || institution.created_by_id !== user.id) {
      return Response.json({ error: 'Not authorized for this institution' }, { status: 403 });
    }

    const applications = await base44.asServiceRole.entities.GrantApplication.filter({ institution_id }, '-created_date');
    return Response.json({ applications });
  } catch (error) {
    console.error('listInstitutionApplications error:', error.message);
    return Response.json({ error: 'Unable to load applications. Please try again.' }, { status: 500 });
  }
}