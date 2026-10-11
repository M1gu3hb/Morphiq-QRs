export function physicalSvg(svg, widthMm) {
  const view = svg
      .match(/viewBox="([^\"]+)"/)[1]
      .split(' ')
      .map(Number),
    height = (widthMm * view[3]) / view[2];
  return svg
    .replace(/width="[^\"]+"/, `width="${widthMm}mm"`)
    .replace(/height="[^\"]+"/, `height="${height.toFixed(4)}mm"`);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export async function withDpi(blob, dpi) {
  if (!dpi || !['image/png', 'image/jpeg'].includes(blob.type)) return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (blob.type === 'image/jpeg') {
    if (
      bytes[2] === 0xff &&
      bytes[3] === 0xe0 &&
      String.fromCharCode(...bytes.slice(6, 10)) === 'JFIF'
    ) {
      const view = new DataView(bytes.buffer);
      bytes[13] = 1;
      view.setUint16(14, dpi);
      view.setUint16(16, dpi);
    }
    return new Blob([bytes], { type: blob.type });
  }
  const pieces = [bytes.slice(0, 8)],
    view = new DataView(bytes.buffer);
  let pos = 8;
  while (pos < bytes.length) {
    const size = view.getUint32(pos),
      type = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
    if (type !== 'pHYs') pieces.push(bytes.slice(pos, pos + size + 12));
    pos += size + 12;
  }
  const chunk = new Uint8Array(21),
    data = new DataView(chunk.buffer);
  data.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  data.setUint32(8, Math.round(dpi / 0.0254));
  data.setUint32(12, Math.round(dpi / 0.0254));
  chunk[16] = 1;
  data.setUint32(17, crc32(chunk.slice(4, 17)));
  pieces.splice(2, 0, chunk);
  return new Blob(pieces, { type: blob.type });
}
