import { applyColorEffect } from './color-effects.js';
import { frameSvg } from '../frames/renderer.js';
import { silhouetteSvg } from '../image/silhouette.js';
import { imageArt } from '../image/art.js';
import { QRStyles } from './styles.js';
import { QRImage } from '../image/framing.js';

export function renderQrSvg(qr, options) {
  const {
    margin = 1,
    foreground = '#000000',
    background = '#ffffff',
    eyes = foreground,
    size = 1024,
    module = 'square',
    eye = 'square',
    center = 'square',
    image = null,
    frame = 'square',
    blend = 'integrated',
    imageSize = 24,
    zoom = 100,
    panX = 0,
    panY = 0,
    fit = 'auto',
    imageBackground = background,
  } = options;
  let svg = QRStyles.svg(
    qr,
    { module, eye, center },
    { margin, fg: foreground, bg: background, eyes, size },
  );
  svg = applyColorEffect(svg, { foreground, gradient: options.gradient }, qr.size + margin * 2);
  if (image && options.imageMode && options.imageMode !== 'center')
    svg = imageArt(svg, qr, { ...options, foreground, background, margin, module });
  if (image && (!options.imageMode || options.imageMode === 'center')) {
    const geometry = QRImage.geometry(qr, margin, image, {
      size: imageSize,
      sizeModules: options.imageModules,
      snapPan: options.snapPan,
      panMode: options.panMode,
      zoom,
      x: panX,
      y: panY,
      fit,
      frame,
    });
    svg = svg.replace(
      '</svg>',
      QRImage.fragment(qr, margin, image, geometry, {
        background: imageBackground,
        foreground,
        mode: blend,
      }) + '</svg>',
    );
  }
  if (!options.bare) {
    svg = silhouetteSvg(svg, { ...options, foreground, background, size });
    svg = frameSvg(svg, { ...options, foreground, background, size });
  }
  return svg;
}
