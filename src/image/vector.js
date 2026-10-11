const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
]);
const attrs = new Set([
  'viewBox',
  'd',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'fill',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'id',
  'clip-path',
]);
export function sanitizeSvg(source) {
  if (source.length > 1_500_000) throw new Error('El SVG es demasiado grande.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('El SVG debe contener solo vectores.');
  // Parse in an inert XML document, so even resources outside the SVG cannot load.
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror'))
    throw new Error('El archivo no contiene un SVG válido.');
  function clean(node) {
    for (const child of Array.from(node.children)) {
      if (![...tags].some((tag) => tag.toLowerCase() === child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      clean(child);
    }
    for (const attr of Array.from(node.attributes)) {
      if (
        !attrs.has(attr.name) ||
        /javascript:|data:|https?:|expression|@import/i.test(attr.value) ||
        (/url\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))
      )
        node.removeAttribute(attr.name);
    }
  }
  clean(svg);
  const view = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    view &&
    (view.length !== 4 || view.some((v) => !Number.isFinite(v)) || view[2] <= 0 || view[3] <= 0)
  )
    throw new Error('Revisa las dimensiones del SVG.');
  const width = Number(svg.getAttribute('width')) || view?.[2] || 256,
    height = Number(svg.getAttribute('height')) || view?.[3] || 256;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Revisa las dimensiones del SVG.');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', view?.length === 4 ? view.join(' ') : `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  // Namespace IDs so uploaded vectors cannot collide with QR gradients or clipping.
  const ids = new Map();
  svg.querySelectorAll('[id]').forEach((node, i) => ids.set(node.id, 'vector-' + i));
  svg.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      let value = attr.value;
      for (const [old, next] of ids) value = value.replaceAll(`url(#${old})`, `url(#${next})`);
      if (attr.name === 'id') value = ids.get(value) || value;
      node.setAttribute(attr.name, value);
    }
  });
  return { svg: svg.outerHTML, width, height, transparent: true, logoLike: true };
}
export function svgDataUrl(svg) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
