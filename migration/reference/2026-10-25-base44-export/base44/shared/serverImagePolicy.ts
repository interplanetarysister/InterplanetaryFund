
const APP_ID = '6a67a778342a8fe05ee79cba';
const MAX_BYTES = 15 * 1024 * 1024;

// Server policy reads fresh, service-role-verified User data from accountGuard.
// No subscription claims from the browser are trusted.
export function requiresImageWatermark(user: any): boolean {
  if (user?.role === 'admin') return false;
  return !(user?.subscription_status === 'active' &&
    typeof user?.subscription_tier === 'string' &&
    !['', 'free', 'none'].includes(user.subscription_tier.toLowerCase()));
}

export function validIfundMediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return '';
    if (u.hostname === 'media.base44.com' && (u.pathname.startsWith(`/images/public/${APP_ID}/`) || u.pathname.startsWith(`/files/public/${APP_ID}/`))) return u.href;
    if (u.hostname === 'base44.app' && u.pathname.startsWith(`/api/apps/${APP_ID}/files/mp/public/${APP_ID}/`)) return u.href;
    return '';
  } catch { return ''; }
}

// Base44's own image URLs redirect to its media CDN. Follow only a small number
// of redirects, each confined to this app's verified media paths. Using
// redirect:'error' caused free-member campaign saves to fail on valid uploads.
async function fetchTrustedMedia(source: string): Promise<Response> {
  let url = source;
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    const next = location ? validIfundMediaUrl(new URL(location, url).href) : '';
    if (!next) throw new Error('Image redirected outside IFund media');
    url = next;
  }
  throw new Error('Too many image redirects');
}

// Process media when it is attached to a campaign or post, even if the caller
// bypassed the UI and uploaded an original image directly.
export async function enforceImagePolicy(base44: any, user: any, submittedUrl: unknown): Promise<string> {
  if (!submittedUrl) return '';
  const source = validIfundMediaUrl(submittedUrl);
  if (!source) throw new Error('Unverified image source');
  if (!requiresImageWatermark(user)) return source;

  const response = await fetchTrustedMedia(source);
  if (!response.ok) throw new Error('Image unavailable');
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_BYTES) throw new Error('Image exceeds size limit');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error('Image exceeds size limit');
  // Load native processing only for accounts that need a watermark.
  // An optional image processor must not prevent admin/paid saves or blank
  // private drafts from even reaching authentication and validation.
  const { default: sharp } = await import('npm:sharp@0.33.5');
  const img = sharp(bytes, { limitInputPixels: 24000000 }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height || !['jpeg','png','webp','avif','gif','tiff'].includes(meta.format || '')) throw new Error('Unsupported image');
  const width = Math.min(2200, meta.width);
  const height = Math.max(1, Math.round(meta.height * width / meta.width));
  const diameter = Math.max(64, Math.min(180, Math.round(Math.min(width, height) * .18)));
  const textSize = Math.max(11, Math.round(diameter * .105));
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g transform="translate(${width - diameter - 16},${height - diameter - 16})" opacity=".55">
      <circle cx="${diameter/2}" cy="${diameter/2}" r="${diameter*.32}" fill="#141d4a" stroke="#67e8f9" stroke-width="3"/>
      <ellipse cx="${diameter/2}" cy="${diameter/2}" rx="${diameter*.47}" ry="${diameter*.14}" transform="rotate(-23 ${diameter/2} ${diameter/2})" fill="none" stroke="#c084fc" stroke-width="5"/>
      <text x="${diameter/2}" y="${diameter*.91}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${textSize}" font-weight="bold" fill="#fff" stroke="#0a1029" stroke-width="2" paint-order="stroke">interplanetaryfund.com</text>
    </g>
  </svg>`;
  const png = await img.resize({ width, withoutEnlargement: true }).composite([{ input: new TextEncoder().encode(overlay), gravity: 'southeast' }]).png().toBuffer();
  const file = new File([png], `ifund-server-watermark-${Date.now()}.png`, { type: 'image/png' });
  const saved = await base44.integrations.Core.UploadFile({ file });
  const verified = validIfundMediaUrl(saved?.file_url);
  if (!verified) throw new Error('Processed image could not be saved');
  return verified;
}
