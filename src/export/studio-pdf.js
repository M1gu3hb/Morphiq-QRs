import { loadImage } from '../image/image-loader.js';
import { QRCheck } from '../validation/qr-checker.js';
async function libraries() {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  return jsPDF;
}
function svgNode(markup) {
  const holder = document.createElement('div');
  holder.innerHTML = markup;
  const svg = holder.querySelector('svg');
  if (!svg) throw new Error('No se pudo preparar el diseño.');
  return svg;
}
async function pdfSvg(markup) {
  const svg = svgNode(markup);
  // PDF does not support SVG luminance masks. Preserve the exact central composition
  // as a small raster patch, leaving modules, frame and remaining vectors untouched.
  const masked = svg.querySelector('g[mask]');
  if (masked && !masked.querySelector('image')) {
    const mask = svg.querySelector('#image-safe'),
      rects = Array.from(mask.querySelectorAll('rect'));
    const path = rects
      .map((rect) => {
        const x = Number(rect.getAttribute('x')) || 0,
          y = Number(rect.getAttribute('y')) || 0,
          w = Number(rect.getAttribute('width')),
          h = Number(rect.getAttribute('height'));
        return `M${x} ${y}h${w}v${h}h${-w}Z`;
      })
      .join(' ');
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', 'pdf-vector-safe');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    shape.setAttribute('clip-rule', 'evenodd');
    clip.append(shape);
    svg.querySelector('defs').append(clip);
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.setAttribute('clip-path', 'url(#pdf-vector-safe)');
    masked.replaceWith(wrapper);
    masked.removeAttribute('mask');
    wrapper.append(masked);
  } else if (masked) {
    const window = svg.querySelector('#image-window rect');
    const x = Number(window.getAttribute('x')),
      y = Number(window.getAttribute('y')),
      side = Number(window.getAttribute('width'));
    const container = svg.querySelector('#image-window').closest('g');
    const grid = Number(svg.querySelector('#image-safe rect').getAttribute('width'));
    const localSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${grid}" height="${grid}" viewBox="0 0 ${grid} ${grid}">${container ? container.innerHTML : svg.innerHTML}</svg>`;
    const view = [0, 0, grid, grid],
      canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    const uri = URL.createObjectURL(new Blob([localSvg], { type: 'image/svg+xml' }));
    try {
      const img = await loadImage(uri),
        ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        (-x * 768) / side,
        (-y * 768) / side,
        (view[2] * 768) / side,
        (view[3] * 768) / side,
      );
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      for (const [k, v] of Object.entries({
        x,
        y,
        width: side,
        height: side,
        href: canvas.toDataURL('image/png'),
      }))
        node.setAttribute(k, String(v));
      masked.replaceWith(node);
    } finally {
      URL.revokeObjectURL(uri);
    }
  }
  return svg;
}
export async function createStudioPdf(markup, widthMm) {
  const [jsPDF, svg] = await Promise.all([libraries(), pdfSvg(markup)]);
  const view = svg.getAttribute('viewBox').split(' ').map(Number),
    heightMm = (widthMm * view[3]) / view[2];
  const pdf = new jsPDF({
    unit: 'mm',
    format: [widthMm, heightMm],
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    compress: true,
  });
  await pdf.svg(svg, { x: 0, y: 0, width: widthMm, height: heightMm });
  pdf.setProperties({ title: 'Morphiq QR', creator: 'Morphiq', author: 'M1gu3hb' });
  return pdf.output('blob');
}
export async function createPrintSheet(markup, widthMm, payload) {
  if (!(await QRCheck.run(markup, payload)).passed)
    throw new Error('Comprueba y ajusta el QR antes de imprimir.');
  const [jsPDF, svg] = await Promise.all([libraries(), pdfSvg(markup)]),
    view = svg.getAttribute('viewBox').split(' ').map(Number),
    height = (widthMm * view[3]) / view[2];
  if (widthMm > 190 || height > 277)
    throw new Error('El diseño es demasiado grande para una hoja A4.');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (let y = 10; y + height <= 287; y += height + 4)
    for (let x = 10; x + widthMm <= 200; x += widthMm + 4)
      await pdf.svg(svg, { x, y, width: widthMm, height });
  pdf.setProperties({ creator: 'Morphiq', title: 'Etiquetas QR · Morphiq' });
  return pdf.output('blob');
}
