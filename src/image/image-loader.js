import { sanitizeSvg, svgDataUrl } from './vector.js';
import { QRImage } from './framing.js';
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen. Usa PNG, JPG o WebP.'));
    img.src = src;
  });
}
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });
}

export async function normalizeImage(source, name, crop) {
  if (source.startsWith('data:image/svg+xml')) {
    const encoded = source.split(',')[1],
      raw = source.includes(';base64,')
        ? decodeURIComponent(escape(atob(encoded)))
        : decodeURIComponent(encoded);
    const vector = sanitizeSvg(raw);
    return { ...vector, data: svgDataUrl(vector.svg), name };
  }
  const img = await loadImage(source);
  const area = crop || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const scale = Math.min(1, 1024 / Math.max(area.w, area.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.w * scale));
  canvas.height = Math.max(1, Math.round(area.h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se pudo preparar la imagen.');
  ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, canvas.width, canvas.height);
  const bounds = QRImage.trimBounds(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    ),
    trim = document.createElement('canvas');
  trim.width = bounds.w;
  trim.height = bounds.h;
  trim
    .getContext('2d')
    .drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  return {
    data: trim.toDataURL('image/png'),
    width: bounds.w,
    height: bounds.h,
    transparent: bounds.transparent,
    logoLike: bounds.logoLike,
    name,
  };
}
