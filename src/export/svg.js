export function createSvg(svgText) {
  return new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
}
