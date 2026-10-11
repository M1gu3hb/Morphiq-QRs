import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { installBrowser, svgPixels } from '../helpers/browser.js';
import { rebuildQr } from '../../src/scanner/rebuild.js';
import { scanResult } from '../../src/scanner/result.js';
import { qrImageFile, shareQrFile } from '../../src/export/share.js';
import { decodePixels } from '../../src/validation/decoder.js';
import { qrcodegen } from '../../src/vendor/qrcodegen.js';

test('reconstructed and shared PNGs preserve real scanner payloads exactly', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  for (const value of [
    'https://morphiq.com.mx/?a=1&b=2#hola',
    'WIFI:T:WPA;S:Red\\;Morphiq;P:a\\:b\\\\c;H:true;;',
    'mailto:hola@morphiq.com.mx?subject=Hola%20Miguel&body=Uno%0ADos',
    'tel:+525512345678',
    'SMSTO:+525512345678:Hola: gracias',
    'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Miguel Huerta\r\nEND:VCARD',
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Demo\r\nEND:VEVENT\r\nEND:VCALENDAR',
    'Información 🌐 & <script>inert</script>',
  ]) {
    const { svg, size } = rebuildQr(scanResult(value).payload);
    assert.equal(decodePixels(await svgPixels(svg)), value);
    const file = await qrImageFile(svg, { size, name: 'QR original.png' });
    assert.equal(file.name, 'QR-original.png');
    assert.equal(file.type, 'image/png');
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(
      decodePixels({ data: new Uint8ClampedArray(data), width: info.width, height: info.height }),
      value,
    );
  }
});
test('scanner reconstruction also accepts valid payloads that exceed level M capacity', () => {
  const value = 'x'.repeat(2500);
  assert.throws(
    () =>
      qrcodegen.QrCode.encodeSegments(
        qrcodegen.QrSegment.makeSegments(value),
        qrcodegen.QrCode.Ecc.MEDIUM,
      ),
    RangeError,
  );
  assert.match(rebuildQr(value).svg, /<svg/);
});
test('native sharing sends only a PNG file; cancellation is quiet and fallback saves the PNG', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => Object.defineProperty(globalThis, 'navigator', descriptor));
  let received;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      canShare: () => true,
      share: async (value) => {
        received = value;
      },
    },
  });
  const file = new File(['png'], 'morphiq-qr.png', { type: 'image/png' });
  assert.equal(await shareQrFile(file), 'shared');
  assert.deepEqual(Object.keys(received), ['files']);
  assert.equal(received.files[0], file);
  navigator.share = async () => {
    throw new DOMException('Cancelled', 'AbortError');
  };
  assert.equal(await shareQrFile(file), 'cancelled');
  assert.equal(browser.downloads.length, 0);
  navigator.canShare = () => false;
  assert.equal(await shareQrFile(file), 'downloaded');
  assert.equal(browser.downloads[0].filename, file.name);
  assert.equal(browser.downloads[0].blob, file);
});
