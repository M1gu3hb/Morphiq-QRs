import { QRStyles } from '../qr/styles.js';
export function artGeometry(qr, margin, image, options = {}) {
  const side = qr.size,
    zoom = Math.max(50, Math.min(400, options.zoom || 100)) / 100;
  const contain = options.fit === 'contain' || (options.fit === 'auto' && image.transparent);
  const scale =
    (contain
      ? Math.min(side / image.width, side / image.height)
      : Math.max(side / image.width, side / image.height)) * zoom;
  const w = image.width * scale,
    h = image.height * scale;
  return {
    side,
    start: margin,
    w,
    h,
    x: margin + (side - w) / 2 + (options.panX || 0),
    y: margin + (side - h) / 2 + (options.panY || 0),
    travelX: (w + side) / 2 - Math.min(w, side) * 0.25,
    travelY: (h + side) / 2 - Math.min(h, side) * 0.25,
  };
}
export function imageArt(svg, qr, options) {
  if (!options.image || !['texture', 'background'].includes(options.imageMode)) return svg;
  const m = options.margin,
    image = options.image;
  const g = artGeometry(qr, m, image, options);
  const picture = image.svg
    ? image.svg
        .replace('<svg ', `<svg x="${g.x}" y="${g.y}" `)
        .replace(/width="[^"]+"/, `width="${g.w}"`)
        .replace(/height="[^"]+"/, `height="${g.h}"`)
    : `<image x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" href="${image.data}" preserveAspectRatio="none"/>`;
  let patches = '',
    structural = '';
  const align = qr.getAlignmentPatternPositions();
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++) {
      if (QRStyles.protectedModule(qr, x, y, align)) {
        const inFinder =
          (x < 7 && y < 7) || (x >= qr.size - 7 && y < 7) || (x < 7 && y >= qr.size - 7);
        if (!inFinder)
          structural += `<rect x="${x + m}" y="${y + m}" width="1" height="1" fill="${qr.getModule(x, y) ? options.foreground : options.background}"/>`;
        continue;
      }
      if (options.imageMode === 'background' && !qr.getModule(x, y))
        patches += `<rect x="${x + m + 0.13}" y="${y + m + 0.13}" width=".74" height=".74" fill="${options.background}"/>`;
      if (options.imageMode === 'texture' && qr.getModule(x, y))
        patches += `<rect x="${x + m + 0.2}" y="${y + m + 0.2}" width=".6" height=".6" fill="${options.foreground}"/>`;
    }
  if (options.imageMode === 'background')
    return svg
      .replace(
        /(<rect[^>]+\/>)/,
        `$1<defs><clipPath id="art-window"><rect x="${m}" y="${m}" width="${qr.size}" height="${qr.size}"/></clipPath></defs><g opacity="0.28" clip-path="url(#art-window)">${picture}</g>`,
      )
      .replace('</svg>', patches + structural + '</svg>');
  const shape = QRStyles.svgPath(QRStyles.dataPath(qr, options.module, m));
  return svg.replace(
    '</svg>',
    `<defs><clipPath id="art-ink"><path d="${shape}"/></clipPath></defs><g clip-path="url(#art-ink)">${picture}${patches}</g>${structural}</svg>`,
  );
}
