import jsQR from 'jsqr';

export function decodePixels({ data, width, height }) {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return result?.data || null;
}

export function decodeDetails({ data, width, height }) {
  const r = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return r ? { data: r.data, location: r.location } : null;
}
