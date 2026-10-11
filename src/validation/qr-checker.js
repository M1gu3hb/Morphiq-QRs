import { decodeQrImage as decode } from './decoder-client.js';
export const QRCheck = (() => {
  const tests = ['Imagen original', 'Tamaño reducido', 'Rotación de 3°', 'Compresión y desenfoque'];
  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  async function run(
    svg,
    expected,
    { size = 1024, mime = 'image/png', onStep = () => {}, isCurrent = () => true } = {},
  ) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('No se pudo preparar el QR para comprobarlo.'));
        i.src = url;
      });
      const outcomes = [];
      for (let i = 0; i < 4; i++) {
        if (!isCurrent()) return null;
        onStep(i, 'running');
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const side = i === 0 ? Math.min(1536, size) : i === 1 ? 320 : 640,
          c = canvas(side),
          ctx = c.getContext('2d');
        if (!ctx) throw new Error('Este navegador no pudo iniciar el comprobador.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, side, side);
        ctx.imageSmoothingEnabled = i !== 0;
        if (i === 2) {
          ctx.translate(side / 2, side / 2);
          ctx.rotate((3 * Math.PI) / 180);
          const scale = Math.min(
            (side * 0.92) / img.naturalWidth,
            (side * 0.92) / img.naturalHeight,
          );
          ctx.drawImage(
            img,
            (-img.naturalWidth * scale) / 2,
            (-img.naturalHeight * scale) / 2,
            img.naturalWidth * scale,
            img.naturalHeight * scale,
          );
        } else {
          if (i === 3) ctx.filter = 'blur(0.45px)';
          const scale = Math.min(side / img.naturalWidth, side / img.naturalHeight);
          ctx.drawImage(
            img,
            (side - img.naturalWidth * scale) / 2,
            (side - img.naturalHeight * scale) / 2,
            img.naturalWidth * scale,
            img.naturalHeight * scale,
          );
          ctx.filter = 'none';
        }
        // Read a real encoded JPEG/WebP as well as the uncompressed SVG rendering.
        if (i === 3 || (i === 0 && mime !== 'image/png')) {
          const compressed = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('No se pudo verificar la compresión.'));
            image.src = c.toDataURL(i === 3 ? 'image/jpeg' : mime, i === 3 ? 0.72 : 1);
          });
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, side, side);
          ctx.drawImage(compressed, 0, 0, side, side);
        }
        const decoded = await decode(ctx.getImageData(0, 0, side, side));
        if (!isCurrent()) return null;
        const passed = decoded === expected;
        outcomes.push({ name: tests[i], passed, decoded });
        onStep(i, passed ? 'passed' : 'failed');
      }
      return { passed: outcomes.every((t) => t.passed), outcomes };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { tests, run, decode };
})();
