export const BROWSER_READ_CAPABILITIES = [
  'GET_METRICS',
  'CHECK_STATUS',
  'READ_PAGE',
  'READ_INTERACTIONS',
  'READ_MESSAGES',
  'DISCOVER',
] as const;

export const BROWSER_WRITE_CAPABILITIES = [
  'CREATE_POST',
  'EDIT_POST',
  'DELETE_OWN_POST',
  'UPLOAD_MEDIA',
  'CREATE_CAMPAIGN_UPDATE',
  'EDIT_CAMPAIGN',
  'COMMENT',
  'REPLY_COMMENT',
  'REPLY_MESSAGE',
  'FOLLOW',
  'JOIN',
] as const;

export const BROWSER_CAPABILITIES = [
  ...BROWSER_READ_CAPABILITIES,
  ...BROWSER_WRITE_CAPABILITIES,
] as const;

export function isBrowserCapability(value: string) {
  return (BROWSER_CAPABILITIES as readonly string[]).includes(String(value || '').toUpperCase());
}

export function isBrowserWriteCapability(value: string) {
  return (BROWSER_WRITE_CAPABILITIES as readonly string[]).includes(String(value || '').toUpperCase());
}
