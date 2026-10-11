import { qrcodegen } from '../vendor/qrcodegen.js';
export function normalizeLink(raw) {
  const s = raw.trim();
  if (!s) throw new Error('Pega una liga para generar el QR.');
  if (/\s/.test(s)) throw new Error('La liga contiene espacios o saltos de línea.');
  let value = s;
  if (s.startsWith('//')) value = 'https:' + s;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(s)) value = 'https://' + s;
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname)
    throw new Error('Usa una liga http:// o https://.');
  return value;
}

export function encodeLink(value, { ecc = 'M', hasImage = false } = {}) {
  const url = normalizeLink(value);
  const level = hasImage || ecc === 'H' ? qrcodegen.QrCode.Ecc.HIGH : qrcodegen.QrCode.Ecc.MEDIUM;
  return qrcodegen.QrCode.encodeSegments(
    qrcodegen.QrSegment.makeSegments(url),
    level,
    hasImage ? 3 : 1,
    40,
    -1,
    false,
  );
}
export function outputDimension(qr, margin, requestedPixels) {
  if (!qr) return 0;
  const grid = qr.size + margin * 2;
  return Math.ceil(requestedPixels / grid) * grid;
}
