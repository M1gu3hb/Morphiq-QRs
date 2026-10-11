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
  const svg = QRStyles.svg(
    qr,
    { module, eye, center },
    { margin, fg: foreground, bg: background, eyes, size },
  );
  if (!image) return svg;
  const geometry = QRImage.geometry(qr, margin, image, {
    size: imageSize,
    zoom,
    x: panX,
    y: panY,
    fit,
    frame,
  });
  return svg.replace(
    '</svg>',
    QRImage.fragment(qr, margin, image, geometry, {
      background: imageBackground,
      foreground,
      mode: blend,
    }) + '</svg>',
  );
}
