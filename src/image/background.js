import { loadImage } from './image-loader.js';
export async function removeUniformBackground(image) {
  if (image.svg) throw new Error('El vector ya conserva un fondo transparente.');
  const bitmap = await loadImage(image.data),
    canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
    data = pixels.data,
    w = canvas.width,
    h = canvas.height;
  const sample = Array.from(data.slice(0, 3)),
    matches = (index) =>
      data[index * 4 + 3] > 0 && sample.every((c, k) => Math.abs(c - data[index * 4 + k]) < 28);
  let matching = 0,
    total = 0;
  for (let x = 0; x < w; x++) {
    matching += Number(matches(x)) + Number(matches((h - 1) * w + x));
    total += 2;
  }
  for (let y = 1; y < h - 1; y++) {
    matching += Number(matches(y * w)) + Number(matches(y * w + w - 1));
    total += 2;
  }
  if (matching / total < 0.75)
    throw new Error(
      'El borde no es uniforme. Usa un PNG transparente o un editor para quitar el fondo.',
    );
  const seen = new Uint8Array(w * h),
    queue = new Uint32Array(w * h);
  let head = 0,
    tail = 0;
  const add = (index) => {
    if (index >= 0 && index < w * h && !seen[index]) {
      seen[index] = 1;
      if (matches(index)) queue[tail++] = index;
    }
  };
  for (let x = 0; x < w; x++) {
    add(x);
    add((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    add(y * w);
    add(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    data[i * 4 + 3] = 0;
    if (i % w) add(i - 1);
    if (i % w < w - 1) add(i + 1);
    add(i - w);
    add(i + w);
  }
  ctx.putImageData(pixels, 0, 0);
  return { ...image, data: canvas.toDataURL('image/png'), transparent: true, logoLike: true };
}
