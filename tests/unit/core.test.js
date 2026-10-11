import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLink, encodeLink, outputDimension } from '../../src/qr/encoder.js';
import { QRStyles } from '../../src/qr/styles.js';
import { QRImage } from '../../src/image/framing.js';
import { safeFilename } from '../../src/utils/files.js';
import { hasReadableColors } from '../../src/utils/colors.js';

test('preserves the destination without a redirect and rejects unsuitable input', () => {
  for (const [input, expected] of [
    ['morphiq.com.mx', 'https://morphiq.com.mx'],
    [' //morphiq.com.mx/contacto ', 'https://morphiq.com.mx/contacto'],
    ['http://example.com/?a=1&b=2#section', 'http://example.com/?a=1&b=2#section'],
  ])
    assert.equal(normalizeLink(input), expected);
  for (const input of ['', 'https://example.com/a b', 'javascript:alert(1)', 'ftp://example.com']) {
    assert.throws(() => normalizeLink(input));
  }
});

test('activating an image forces high correction; dimensions use complete modules', () => {
  const basic = encodeLink('https://morphiq.com.mx');
  const image = encodeLink('https://morphiq.com.mx', { hasImage: true, ecc: 'M' });
  assert.equal(basic.errorCorrectionLevel.ordinal, 1);
  assert.equal(image.errorCorrectionLevel.ordinal, 3);
  assert.ok(image.version >= 3);
  for (const margin of [0, 1, 4, 8]) {
    const pixels = outputDimension(image, margin, 1024);
    assert.ok(pixels >= 1024);
    assert.equal(pixels % (image.size + margin * 2), 0);
  }
});

test('the catalog has unique identifiers and compatible preset combinations', () => {
  assert.equal(QRStyles.presets.length, 32);
  assert.equal(QRStyles.modules.length, 18);
  for (const items of [QRStyles.presets, QRStyles.modules, QRStyles.eyes, QRStyles.centers]) {
    assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  }
  for (const preset of QRStyles.presets) {
    assert.ok(QRStyles.modules.some((item) => item.id === preset.module));
    assert.ok(QRStyles.compatibleCenters(preset.eye).includes(preset.center), preset.id);
  }
});

test('zoom and pan change the image while leaving its QR window fixed', () => {
  const qr = encodeLink('https://morphiq.com.mx', { hasImage: true });
  const image = { width: 600, height: 200, transparent: true };
  const initial = QRImage.geometry(qr, 1, image);
  const moved = QRImage.geometry(qr, 1, image, { zoom: 200, x: 30, y: -30 });
  assert.equal(initial.side, moved.side);
  assert.equal(initial.start, moved.start);
  assert.equal(moved.w, initial.w * 2);
  assert.notEqual(moved.x, initial.x);
  assert.equal(initial.mode, 'contain');
  assert.equal(QRImage.geometry(qr, 1, { ...image, transparent: false }).mode, 'cover');
  assert.equal(QRImage.geometry(qr, 1, image, { size: 90 }).side, Math.floor(qr.size * 0.3));
});

test('contrast checks both data modules and finder colors', () => {
  assert.equal(hasReadableColors('#000000', '#000000', '#ffffff'), true);
  assert.equal(hasReadableColors('#0044aa', '#000000', '#ffffff'), true);
  assert.equal(hasReadableColors('#000000', '#eeeeee', '#ffffff'), false);
  assert.equal(hasReadableColors('#ffffff', '#ffffff', '#000000'), false);
});

test('download filenames remove extensions, unsafe characters and empty names', () => {
  assert.equal(safeFilename(' Mi QR ázul.svg '), 'Mi-QR-azul');
  assert.equal(safeFilename('../../ logo.png'), 'logo');
  assert.equal(safeFilename('...'), 'morphiq-qr');
  assert.equal(safeFilename('x'.repeat(100)).length, 60);
});
