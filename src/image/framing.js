import { QRStyles } from '../qr/styles.js';
/* Image framing and QR integration; shared by previews and every export. */
('use strict');
export const QRImage = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function geometry(
    q,
    margin,
    image,
    { size = 24, zoom = 100, x = 0, y = 0, fit = 'auto', frame = 'square' } = {},
  ) {
    const side = (q.size * clamp(size, 8, 30)) / 100,
      start = margin + (q.size - side) / 2;
    const mode = fit === 'auto' ? (image.transparent || image.logoLike ? 'contain' : 'cover') : fit;
    const scale =
      ((mode === 'cover'
        ? Math.max(side / image.width, side / image.height)
        : Math.min(side / image.width, side / image.height)) *
        clamp(zoom, 50, 400)) /
      100;
    const w = image.width * scale,
      h = image.height * scale;
    // At least a quarter of the image stays inside the window at either extreme.
    const travelX = (w + side) / 2 - Math.min(w, side) * 0.25,
      travelY = (h + side) / 2 - Math.min(h, side) * 0.25;
    return {
      side,
      start,
      x: start + (side - w) / 2 + (clamp(x, -100, 100) / 100) * travelX,
      y: start + (side - h) / 2 + (clamp(y, -100, 100) / 100) * travelY,
      w,
      h,
      travelX,
      travelY,
      r: frame === 'circle' ? side / 2 : frame === 'rounded' ? side * 0.16 : 0,
      mode,
    };
  }
  function fragment(
    q,
    margin,
    image,
    g,
    { background = '#ffffff', foreground = '#000000', mode = 'integrated' } = {},
  ) {
    const positions = q.getAlignmentPatternPositions(),
      n = q.size + 2 * margin;
    let protectedRects = '',
      cores = '';
    for (let y = 0; y < q.size; y++)
      for (let x = 0; x < q.size; x++) {
        if (
          x + margin + 1 <= g.start ||
          y + margin + 1 <= g.start ||
          x + margin >= g.start + g.side ||
          y + margin >= g.start + g.side
        )
          continue;
        if (QRStyles.protectedModule(q, x, y, positions))
          protectedRects += `<rect x="${x + margin}" y="${y + margin}" width="1" height="1" fill="#000"/>`;
        else if (mode === 'weave')
          cores += `<rect x="${x + margin + 0.14}" y="${y + margin + 0.14}" width=".72" height=".72" fill="${q.getModule(x, y) ? foreground : background}"/>`;
      }
    return `<defs><clipPath id="image-window"><rect x="${g.start}" y="${g.start}" width="${g.side}" height="${g.side}" rx="${g.r}"/></clipPath><mask id="image-safe" maskUnits="userSpaceOnUse" x="0" y="0" width="${n}" height="${n}"><rect width="${n}" height="${n}" fill="#fff"/>${protectedRects}</mask></defs><g clip-path="url(#image-window)" mask="url(#image-safe)"><rect x="${g.start}" y="${g.start}" width="${g.side}" height="${g.side}" fill="${background}"/><image x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" href="${image.data}" preserveAspectRatio="none"/>${cores}</g>`;
  }
  function trimBounds(data, w, h) {
    let left = w,
      top = h,
      right = -1,
      bottom = -1,
      transparent = false;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a < 250) transparent = true;
        if (a > 8) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    if (right < 0) throw new Error('La imagen está completamente vacía.');
    let logoLike = false;
    if (!transparent) {
      // A uniform border is common in logo exports; trim its empty padding, never
      // remove interior colors. Photos with varying borders keep their full bounds.
      const rgb = [data[0], data[1], data[2]],
        matches = (x, y) => {
          const i = (y * w + x) * 4;
          return rgb.every((c, k) => Math.abs(data[i + k] - c) <= 18);
        };
      let same = 0,
        total = 0;
      for (let x = 0; x < w; x++) {
        same += Number(matches(x, 0)) + Number(matches(x, h - 1));
        total += 2;
      }
      for (let y = 1; y < h - 1; y++) {
        same += Number(matches(0, y)) + Number(matches(w - 1, y));
        total += 2;
      }
      if (same / total > 0.97) {
        let l = w,
          t = h,
          r = -1,
          b = -1;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (!matches(x, y)) {
              l = Math.min(l, x);
              t = Math.min(t, y);
              r = Math.max(r, x);
              b = Math.max(b, y);
            }
        if (r >= 0 && (r - l + 1) * (b - t + 1) < w * h * 0.88) {
          const pad = Math.max(1, Math.round(Math.min(w, h) * 0.008));
          left = Math.max(0, l - pad);
          top = Math.max(0, t - pad);
          right = Math.min(w - 1, r + pad);
          bottom = Math.min(h - 1, b + pad);
          logoLike = true;
        }
      }
    }
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1, transparent, logoLike };
  }
  return { geometry, fragment, trimBounds, clamp };
})();
