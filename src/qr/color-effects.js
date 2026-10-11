import { hasReadableColors } from '../utils/colors.js';
export const PALETTES = [
  { name: 'Mono', a: '#000000', b: '#252525', eyes: '#000000', bg: '#ffffff', frame: '#000000' },
  { name: 'Morphiq', a: '#08254c', b: '#123ca3', eyes: '#08254c', bg: '#ffffff', frame: '#123ca3' },
  { name: 'Tinta', a: '#17243b', b: '#324866', eyes: '#17243b', bg: '#f5f7fc', frame: '#17243b' },
  { name: 'Bosque', a: '#123d32', b: '#14634c', eyes: '#123d32', bg: '#f7fbf8', frame: '#14634c' },
  { name: 'Violeta', a: '#35205d', b: '#642f90', eyes: '#35205d', bg: '#fcf8ff', frame: '#642f90' },
  { name: 'Carmín', a: '#5d142d', b: '#9e2446', eyes: '#5d142d', bg: '#fff9fb', frame: '#9e2446' },
  { name: 'Cobre', a: '#462d1c', b: '#80501f', eyes: '#462d1c', bg: '#fffaf3', frame: '#80501f' },
  {
    name: 'Petróleo',
    a: '#06364a',
    b: '#07627d',
    eyes: '#06364a',
    bg: '#f7fcff',
    frame: '#07627d',
  },
];
export const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
export function readableDesign(options) {
  return (
    hasReadableColors(options.foreground, options.eyes, options.background) &&
    (!options.gradient ||
      options.gradient.mode === 'none' ||
      hasReadableColors(options.gradient.color, options.eyes, options.background))
  );
}
export function applyColorEffect(svg, { foreground, gradient }, grid) {
  if (!gradient || gradient.mode === 'none') return svg;
  const angle = (gradient.angle * Math.PI) / 180,
    x = (Math.cos(angle) * grid) / 2,
    y = (Math.sin(angle) * grid) / 2;
  const stops =
    gradient.mode === 'duo'
      ? `<stop offset="0" stop-color="${foreground}"/><stop offset="0.4999" stop-color="${foreground}"/><stop offset="0.5" stop-color="${gradient.color}"/><stop offset="1" stop-color="${gradient.color}"/>`
      : `<stop offset="0" stop-color="${foreground}"/><stop offset="1" stop-color="${gradient.color}"/>`;
  const definition =
    gradient.mode === 'radial'
      ? `<radialGradient id="qr-ink" gradientUnits="userSpaceOnUse" cx="${grid / 2}" cy="${grid / 2}" r="${grid * 0.7}">${stops}</radialGradient>`
      : `<linearGradient id="qr-ink" gradientUnits="userSpaceOnUse" x1="${grid / 2 - x}" y1="${grid / 2 - y}" x2="${grid / 2 + x}" y2="${grid / 2 + y}">${stops}</linearGradient>`;
  // Only the data path uses the gradient; finder patterns retain their explicit color.
  return svg
    .replace(/(<path d="[^"]+" fill=")[^"]+/, '$1url(#qr-ink)')
    .replace('</svg>', `<defs>${definition}</defs></svg>`);
}
