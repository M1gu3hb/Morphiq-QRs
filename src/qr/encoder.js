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
  return encodePayload(normalizeLink(value), { ecc, hasImage });
}
export function imageRoom(qr) {
  const positions = qr.getAlignmentPatternPositions();
  for (let side = Math.floor(qr.size * 0.3); side >= 2; side--) {
    const start = Math.floor((qr.size - side) / 2),
      end = start + side;
    if (!positions.some((p) => p - 2 < end && p + 3 > start)) return side;
  }
  return 0;
}
export function encodePayload(value, { ecc = 'M', hasImage = false, imageModules = 7 } = {}) {
  const url = String(value);
  if (!url) throw new Error('Completa el contenido.');
  const level = hasImage || ecc === 'H' ? qrcodegen.QrCode.Ecc.HIGH : qrcodegen.QrCode.Ecc.MEDIUM;
  const segments = qrcodegen.QrSegment.makeSegments(url);
  let qr = qrcodegen.QrCode.encodeSegments(segments, level, hasImage ? 3 : 1, 40, -1, false);
  if (hasImage && imageModules > 0) {
    const window = Math.max(2, Math.min(14, Math.round(imageModules)));
    // Choose a standards-compliant version with a clear central window. Data and
    // structural patterns are re-encoded normally; no alignment pattern is erased.
    while (imageRoom(qr) < Math.min(window, Math.floor(qr.size * 0.3))) {
      if (qr.version === 40)
        throw new Error(
          'El contenido es demasiado largo para dejar el centro libre. Acórtalo o usa la imagen como textura o fondo.',
        );
      qr = qrcodegen.QrCode.encodeSegments(segments, level, qr.version + 1, 40, -1, false);
    }
  }
  return qr;
}
export function outputDimension(qr, margin, requestedPixels) {
  if (!qr) return 0;
  const grid = qr.size + margin * 2;
  return Math.ceil(requestedPixels / grid) * grid;
}
