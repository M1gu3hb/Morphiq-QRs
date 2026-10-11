import { qrcodegen } from '../vendor/qrcodegen.js';
import { renderQrSvg } from '../qr/renderer.js';

export function rebuildQr(payload) {
  const segments = qrcodegen.QrSegment.makeSegments(payload);
  let qr;
  try {
    qr = qrcodegen.QrCode.encodeSegments(segments, qrcodegen.QrCode.Ecc.MEDIUM);
  } catch (error) {
    // A legitimate source QR may use the larger capacity of level L.
    if (!(error instanceof RangeError)) throw error;
    qr = qrcodegen.QrCode.encodeSegments(segments, qrcodegen.QrCode.Ecc.LOW);
  }
  const size = (qr.size + 8) * Math.max(6, Math.ceil(1024 / (qr.size + 8)));
  return { svg: renderQrSvg(qr, { margin: 4, size }), size };
}

// Decode exactly the visible portion of an object-fit: cover camera.
export function visibleVideoRect(sourceWidth, sourceHeight, width, height) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const w = width / scale,
    h = height / scale;
  return { x: (sourceWidth - w) / 2, y: (sourceHeight - h) / 2, width: w, height: h };
}
