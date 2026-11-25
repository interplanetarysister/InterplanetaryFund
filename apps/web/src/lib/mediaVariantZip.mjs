/** Minimal ZIP (stored entries, no compression). Used only for local image exports. */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function encode(text) { return new TextEncoder().encode(text); }
export function packageMediaVariants(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 12)
    throw new Error("Choose 1–12 images to export.");
  const parts = [], central = [];
  let position = 0;
  for (const entry of entries) {
    if (!/^[a-z0-9][a-z0-9._-]*\.png$/i.test(entry.name)) throw new Error("Invalid export filename.");
    const name = encode(entry.name), bytes = entry.bytes;
    if (!(bytes instanceof Uint8Array) || bytes.length > 35_000_000) throw new Error("Image export is too large.");
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
    l.setUint16(8, 0, true); l.setUint32(14, crc, true);
    l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true);
    l.setUint16(26, name.length, true); local.set(name, 30);
    parts.push(local, bytes);
    const dir = new Uint8Array(46 + name.length);
    const d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true);
    d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true);
    d.setUint16(28, name.length, true); d.setUint32(42, position, true); dir.set(name, 46);
    central.push(dir);
    position += local.length + bytes.length;
  }
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true); e.setUint32(16, position, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
