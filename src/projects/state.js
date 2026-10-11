import { sanitizeSvg, svgDataUrl } from '../image/vector.js';
export function captureFields() {
  return Object.fromEntries(
    Array.from(
      document.querySelectorAll('.controls input[id],.controls textarea[id],.controls select[id]'),
    )
      .filter((e) => e.type !== 'file' && !['batch-input', 'batch-format'].includes(e.id))
      .map((e) => [e.id, e.type === 'checkbox' ? e.checked : e.value]),
  );
}
export function restoreFields(fields) {
  if (!fields || typeof fields !== 'object') return;
  for (const [id, value] of Object.entries(fields)) {
    const input = document.getElementById(id);
    if (!input || !input.closest('.controls') || input.type === 'file') continue;
    if (input.type === 'checkbox') {
      input.checked = value === true;
      continue;
    }
    if (typeof value !== 'string') continue;
    if (
      input.type === 'hidden' &&
      /color|foreground|background/.test(id) &&
      !/^#[a-f\d]{6}$/i.test(value)
    )
      continue;
    if (
      input.tagName.toLowerCase() === 'select' &&
      !Array.from(input.options).some((o) => o.value === value)
    )
      continue;
    if (['range', 'number'].includes(input.type)) {
      if (!Number.isFinite(Number(value))) continue;
      // These bounds depend on the QR or image that will be restored next.
      if (id === 'logo-size') input.setAttribute('max', '14');
      if (['image-x', 'image-y'].includes(id)) {
        input.setAttribute('min', '-100');
        input.setAttribute('max', '100');
      }
      const min = input.getAttribute('min'),
        max = input.getAttribute('max');
      input.value = String(
        Math.max(
          min === null ? -Infinity : Number(min),
          Math.min(max === null ? Infinity : Number(max), Number(value)),
        ),
      );
    } else
      input.value = value.slice(0, Number(input.maxLength) > 0 ? Number(input.maxLength) : 3000);
  }
}
export function validImage(image) {
  if (!image) return null;
  if (image.svg) {
    const vector = sanitizeSvg(String(image.svg));
    return {
      ...vector,
      data: svgDataUrl(vector.svg),
      name: String(image.name || 'Vector').slice(0, 100),
    };
  }
  if (
    typeof image.data !== 'string' ||
    image.data.length > 8_000_000 ||
    !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(image.data)
  )
    throw new Error('La imagen del proyecto no es válida.');
  if (!(image.width > 0 && image.width <= 1024 && image.height > 0 && image.height <= 1024))
    throw new Error('Revisa las dimensiones de la imagen.');
  return {
    data: image.data,
    width: image.width,
    height: image.height,
    transparent: !!image.transparent,
    logoLike: !!image.logoLike,
    name: String(image.name || 'Imagen').slice(0, 100),
  };
}
export function validSilhouette(shape) {
  if (!shape) return null;
  if (
    typeof shape.path !== 'string' ||
    shape.path.length > 2_000_000 ||
    !/^[\d\s.,eMHLVZmhvlz+-]+$/.test(shape.path)
  )
    throw new Error('La silueta del proyecto no es válida.');
  const { x, y, side } = shape.box || {};
  if (
    ![x, y, side].every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    side < 45 ||
    x + side > 256 ||
    y + side > 256
  )
    throw new Error('Revisa el contorno del proyecto.');
  return {
    path: shape.path,
    box: { x, y, side },
    name: String(shape.name || 'Silueta').slice(0, 100),
  };
}
