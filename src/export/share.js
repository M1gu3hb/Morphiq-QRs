import { rasterizeQr } from './raster.js';
import { safeFilename, saveFile } from '../utils/files.js';

export function supportsImageSharing() {
  try {
    return (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({
        files: [
          new File(
            [
              Uint8Array.from(
                atob(
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
                ),
                (c) => c.charCodeAt(0),
              ),
            ],
            'qr.png',
            { type: 'image/png' },
          ),
        ],
      })
    );
  } catch {
    return false;
  }
}

export async function qrImageFile(svg, { size = 1024, name = 'morphiq-qr' } = {}) {
  const blob = await rasterizeQr(svg, Math.min(2048, size), 'image/png');
  return new File([blob], safeFilename(name) + '.png', { type: 'image/png' });
}

// Call this directly in a click handler with a prepared file, preserving the
// transient gesture required by iOS and other Web Share implementations.
export async function shareQrFile(file) {
  if (supportsImageSharing() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      if (error.name === 'NotAllowedError')
        throw new Error('La imagen está lista. Pulsa Compartir QR de nuevo.');
      throw new Error('No se pudo compartir. Intenta de nuevo o descarga el PNG.');
    }
  }
  saveFile(file, 'png', file.name);
  return 'downloaded';
}
