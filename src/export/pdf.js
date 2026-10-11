import { QRStyles } from '../qr/styles.js';
import { QRImage } from '../image/framing.js';
import { renderQrSvg } from '../qr/renderer.js';
import { loadImage } from '../image/image-loader.js';
export async function createPdf(qr, options, pageMm) {
  const page = (pageMm * 72) / 25.4,
    m = options.margin,
    grid = qr.size + m * 2,
    u = page / grid;
  const f = (n) => Number(n.toFixed(6)).toString();
  const rgb = (hex) =>
    hex
      .match(/[a-f\d]{2}/gi)
      .map((x) => f(parseInt(x, 16) / 255))
      .join(' ');
  const fill = (hex) => `${rgb(hex)} rg\n`;
  let stream =
    fill(options.background) + `0 0 ${f(page)} ${f(page)} re f\n` + fill(options.foreground);
  stream += QRStyles.pdfPath(QRStyles.dataPath(qr, options.module, m), u, page);
  for (const [x, y] of [
    [m, m],
    [m + qr.size - 7, m],
    [m, m + qr.size - 7],
  ])
    QRStyles.eyePaths(x, y, options.eye, options.center).forEach(
      (p, i) =>
        (stream +=
          fill(i === 1 ? options.background : options.eyes) + QRStyles.pdfPath(p, u, page)),
    );
  let imageBytes = null,
    imagePixels = 0;
  const g = options.image
    ? QRImage.geometry(qr, options.margin, options.image, {
        size: options.imageSize,
        zoom: options.zoom,
        x: options.panX,
        y: options.panY,
        fit: options.fit,
        frame: options.frame,
      })
    : null;
  if (g) {
    // Capture the exact composed center, including QR weave, clipping and protected bits.
    const uri = URL.createObjectURL(
      new Blob([renderQrSvg(qr, options)], { type: 'image/svg+xml' }),
    );
    try {
      const img = await loadImage(uri),
        c = document.createElement('canvas');
      imagePixels = 1024;
      c.width = c.height = imagePixels;
      const ctx = c.getContext('2d');
      const scale = imagePixels / g.side;
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, imagePixels, imagePixels);
      ctx.drawImage(img, -g.start * scale, -g.start * scale, grid * scale, grid * scale);
      const binary = atob(c.toDataURL('image/jpeg', 1).split(',')[1]);
      imageBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      stream += `q ${f(g.side * u)} 0 0 ${f(g.side * u)} ${f(g.start * u)} ${f(page - (g.start + g.side) * u)} cm /Logo Do Q\n`;
    } finally {
      URL.revokeObjectURL(uri);
    }
  }
  const enc = new TextEncoder(),
    obj = [
      enc.encode('<< /Type /Catalog /Pages 2 0 R >>'),
      enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      enc.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(page)} ${f(page)}] /Resources << ${imageBytes ? '/XObject << /Logo 6 0 R >>' : ''} >> /Contents 4 0 R >>`,
      ),
      enc.encode(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`),
      enc.encode('<< /Producer (Morphiq QR) /Creator (Morphiq) >>'),
    ];
  if (imageBytes) {
    const head = enc.encode(
        `<< /Type /XObject /Subtype /Image /Width ${imagePixels} /Height ${imagePixels} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      ),
      tail = enc.encode('\nendstream');
    const full = new Uint8Array(head.length + imageBytes.length + tail.length);
    full.set(head);
    full.set(imageBytes, head.length);
    full.set(tail, head.length + imageBytes.length);
    obj.push(full);
  }
  const chunks = [enc.encode('%PDF-1.4\n')],
    offsets = [0];
  let length = chunks[0].length;
  obj.forEach((object, i) => {
    offsets.push(length);
    const start = enc.encode(`${i + 1} 0 obj\n`),
      end = enc.encode('\nendobj\n');
    chunks.push(start, object, end);
    length += start.length + object.length + end.length;
  });
  let xref = `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((n) => (xref += String(n).padStart(10, '0') + ' 00000 n \n'));
  xref += `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(enc.encode(xref));
  return new Blob(chunks, { type: 'application/pdf' });
}
