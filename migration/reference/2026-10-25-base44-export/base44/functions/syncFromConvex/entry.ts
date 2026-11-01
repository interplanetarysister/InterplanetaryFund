export default async function() {
  return Response.json({ ok: true, retired: true, skipped: true, reason: 'Legacy Convex synchronization is retired; Base44 is authoritative.' });
}