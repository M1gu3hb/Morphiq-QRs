import { loadImage } from './image-loader.js';
export function largestSquare(alpha, width, height) {
  const previous = new Uint16Array(width + 1),
    current = new Uint16Array(width + 1);
  let best = { x: 0, y: 0, side: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      current[x + 1] =
        alpha[y * width + x] > 180 ? 1 + Math.min(previous[x], previous[x + 1], current[x]) : 0;
      if (current[x + 1] > best.side)
        best = { x: x - current[x + 1] + 1, y: y - current[x + 1] + 1, side: current[x + 1] };
    }
    previous.set(current);
    current.fill(0);
  }
  return best;
}
export async function prepareSilhouette(source, name) {
  const image = await loadImage(source),
    canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d'),
    scale = 248 / Math.max(image.naturalWidth, image.naturalHeight);
  context.drawImage(
    image,
    (256 - image.naturalWidth * scale) / 2,
    (256 - image.naturalHeight * scale) / 2,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  );
  const rgba = context.getImageData(0, 0, 256, 256).data,
    alpha = new Uint8Array(256 * 256);
  let transparent = 0;
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = rgba[i * 4 + 3];
    if (alpha[i] < 20) transparent++;
  }
  if (transparent < alpha.length * 0.08)
    throw new Error('Sube un PNG con fondo transparente y una silueta sólida.');
  const box = largestSquare(alpha, 256, 256);
  if (box.side < 45)
    throw new Error(
      'La silueta no tiene un área continua suficiente para un QR legible. Usa una forma más amplia.',
    );
  let path = '';
  for (let y = 0; y < 256; y++) {
    let x = 0;
    while (x < 256) {
      if (alpha[y * 256 + x] <= 180) {
        x++;
        continue;
      }
      const start = x;
      while (x < 256 && alpha[y * 256 + x] > 180) x++;
      path += `M${start} ${y}h${x - start}v1H${start}Z`;
    }
  }
  return { path, box, name };
}
export function silhouetteSvg(svg, options) {
  const silhouette = options.silhouette;
  if (!silhouette) return svg;
  const box = silhouette.box,
    match = svg.match(/viewBox="([^\"]+)"/),
    n = Number(match[1].split(' ')[2]);
  const body = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  const side = box.side * 0.96,
    scale = side / n,
    x = box.x + (box.side - side) / 2,
    y = box.y + (box.side - side) / 2;
  let ornament = '';
  const step = Math.max(3, scale);
  for (let row = 0; row < 256 / step; row++)
    for (let col = 0; col < 256 / step; col++) {
      const a = col * step,
        b = row * step;
      if (a + step > x && a < x + side && b + step > y && b < y + side) continue;
      if ((col * 73 + row * 151 + col * row) % 13 < 7)
        ornament += `<rect x="${a}" y="${b}" width="${step}" height="${step}" rx="${step * 0.18}"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}" viewBox="0 0 256 256"><rect width="256" height="256" fill="${options.background}"/><defs><clipPath id="silhouette-window"><path d="${silhouette.path}"/></clipPath></defs><g clip-path="url(#silhouette-window)" fill="${options.foreground}">${ornament}</g><g transform="translate(${x} ${y}) scale(${scale})">${body}</g></svg>`;
}
