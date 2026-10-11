import jsQR from 'jsqr';

export function decodePixels({ data, width, height }) {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return result?.data || null;
}
