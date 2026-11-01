// Owner-approved display changes (2026-11-01). URL paths and authorization are
// unchanged. Original structure and behavior remain the implementation baseline.
export const PAGE_LABELS = Object.freeze({
  '/': 'Launchpad', '/discover': 'Explore Universe', '/globe': 'Planetary Atlas',
  '/community': 'Community Hub', '/blogs': 'Star Stories', '/create': 'Launch a Mission',
  '/dashboard': 'Mission Dashboard', '/following': 'Orbiting Causes',
  '/connections': 'Mission Links', '/agents': 'AI Command Crew',
  '/notifications': 'Signal Alerts', '/communications': 'Comms Center',
  '/ai-images': 'Cosmic Image Studio',
});
export function displayLabel(path, originalLabel) { return PAGE_LABELS[path] || originalLabel; }
