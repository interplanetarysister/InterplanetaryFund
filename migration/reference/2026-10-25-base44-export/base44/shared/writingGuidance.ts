// Optional weekly persuasive writing guidance. This is reference context,
// not private model retraining or evidence that any campaign claim is true.
export async function latestWritingGuidance(sr: any, limit = 1400): Promise<string> {
  try {
    const rows = await sr.entities.WritingResearchBrief.filter(
      { status: 'verified_sources' }, '-created_date', 1);
    const brief = rows?.[0];
    if (!brief) return '';
    const tips = (brief.guidance || []).slice(0, 6).join('; ');
    return [
      `Public research brief week ${String(brief.week_key || '').slice(0,12)}.`,
      'Treat these as general communication findings, not campaign-specific facts.',
      'Focus on credible persuasion, relevant human needs, audience choice, clarity and measurable action.',
      tips,
    ].join(' ').slice(0, Math.max(100, Math.min(limit, 2500)));
  } catch {
    return '';
  }
}
