import { loadImage } from '../image/image-loader.js';
export async function rasterizeQr(svgText, size, mime) {
  const svg = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }),
    url = URL.createObjectURL(svg);
  try {
    const img = await loadImage(url),
      c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Usa SVG o PDF en este navegador.');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar la imagen.'))), mime, 1),
    );
    if (b.type !== mime) throw new Error('Formato no admitido en este navegador. Usa PNG o SVG.');
    return b;
  } finally {
    URL.revokeObjectURL(url);
  }
}
