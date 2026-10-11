import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { installBrowser, svgPixels } from '../helpers/browser.js';
import { contentPayload } from '../../src/content/payloads.js';
import { encodePayload, imageRoom } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';
import { decodePixels } from '../../src/validation/decoder.js';
import { QRCheck } from '../../src/validation/qr-checker.js';
import { FRAMES } from '../../src/frames/catalog.js';
import { projectStore } from '../../src/projects/storage.js';
import { prepareSilhouette } from '../../src/image/silhouette.js';
import { normalizeImage } from '../../src/image/image-loader.js';
import { sanitizeSvg, svgDataUrl } from '../../src/image/vector.js';
import { rasterizeQr } from '../../src/export/raster.js';
import { withDpi, physicalSvg } from '../../src/export/print-metadata.js';
import { QRImage } from '../../src/image/framing.js';
import { createStudio } from '../../src/app/create-studio.js';
import { logoImage } from '../../src/ui/icons.js';

const url = 'https://morphiq.com.mx';
test('long payloads reserve a clear centered image area without removing alignment patterns', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const payload = 'https://morphiq.com.mx/?mensaje=' + 'mensaje-largo-'.repeat(6);
  const raw = encodePayload(payload, { hasImage: true, imageModules: 0 });
  assert.equal(imageRoom(raw), 0);
  const qr = encodePayload(payload, { hasImage: true, imageModules: 7 });
  assert.ok(imageRoom(qr) >= 7);
  assert.ok(qr.version > raw.version);
  const canvas = createCanvas(80, 80),
    ctx = canvas.getContext('2d');
  ctx.fillStyle = '#08254c';
  ctx.fillRect(0, 0, 80, 80);
  const image = await normalizeImage(canvas.toDataURL(), 'Logo');
  const svg = renderQrSvg(qr, { margin: 4, image, imageModules: 7 });
  assert.equal((await QRCheck.run(svg, payload)).passed, true);
});
test('all content types encode their actual payload without a relay service', async () => {
  const cases = [
    ['url', { url }],
    ['text', { text: 'Hola, Miguel 🌐' }],
    ['whatsapp', { phone: '525512345678', message: 'Hola' }],
    ['wifi', { ssid: 'Morphiq', password: 'secreto', security: 'WPA' }],
    ['contact', { name: 'Miguel Huerta', phone: '525512345678', email: 'miguel@example.com' }],
    ['phone', { phone: '525512345678' }],
    ['email', { email: 'miguel@example.com', subject: 'QR', message: 'Hola' }],
    ['event', { title: 'Demo', start: '2026-10-12T10:00:00Z', end: '2026-10-12T11:00:00Z' }],
    ['spotify', { url: 'https://open.spotify.com/track/123ABC' }],
    ['social', { platform: 'instagram', handle: 'morphiq' }],
    ['app', { url }],
    ['map', { address: 'Xochimilco, CDMX' }],
    ['sms', { phone: '525512345678', message: 'Hola' }],
  ];
  for (const [type, fields] of cases) {
    const payload = contentPayload(type, fields),
      svg = renderQrSvg(encodePayload(payload), { margin: 4 });
    assert.equal(decodePixels(await svgPixels(svg)), payload, type);
  }
});
test('every frame and gradient passes four reads and retains aspect ratio', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const qr = encodePayload(url);
  for (const frame of FRAMES) {
    const svg = renderQrSvg(qr, {
      margin: 4,
      border: {
        enabled: true,
        type: frame.id,
        text: 'Morphiq',
        color: '#123ca3',
        textColor: '#ffffff',
      },
    });
    assert.equal((await QRCheck.run(svg, url)).passed, true, frame.id);
  }
  for (const mode of ['linear', 'radial', 'duo']) {
    const svg = renderQrSvg(qr, {
      margin: 4,
      foreground: '#08254c',
      gradient: { mode, color: '#123ca3', angle: 45 },
    });
    assert.equal((await QRCheck.run(svg, url)).passed, true, mode);
  }
});
test('image windows grow by whole modules; artwork and safe silhouettes decode', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const qr = encodePayload(url, { hasImage: true }),
    imageCanvas = createCanvas(160, 160),
    ctx = imageCanvas.getContext('2d');
  ctx.fillStyle = '#003b80';
  ctx.fillRect(30, 30, 100, 100);
  const image = await normalizeImage(imageCanvas.toDataURL(), 'Logo');
  for (const count of [4, 5, 6, 7]) {
    const g = QRImage.geometry(qr, 4, image, { sizeModules: count, snapPan: true, x: 1, y: -1 });
    assert.equal(g.side, count);
    assert.equal(g.start % 1, 0);
  }
  const initial = QRImage.geometry(qr, 4, image, { sizeModules: 5, panMode: 'modules' });
  const fine = QRImage.geometry(qr, 4, image, {
    sizeModules: 5,
    panMode: 'modules',
    x: 0.25,
    y: -0.35,
  });
  assert.equal(fine.start, initial.start);
  assert.equal(fine.side, initial.side);
  assert.ok(Math.abs(fine.x - initial.x - 0.25) < 1e-10);
  assert.ok(Math.abs(fine.y - initial.y + 0.35) < 1e-10);
  for (const mode of ['center', 'texture', 'background']) {
    const svg = renderQrSvg(qr, {
      margin: 4,
      image,
      imageMode: mode,
      imageModules: 5,
      blend: 'weave',
    });
    assert.equal((await QRCheck.run(svg, url)).passed, true, mode);
  }
  const shapeCanvas = createCanvas(256, 256),
    c = shapeCanvas.getContext('2d');
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(128, 128, 120, 0, Math.PI * 2);
  c.fill();
  const silhouette = await prepareSilhouette(shapeCanvas.toDataURL(), 'Circle');
  const svg = renderQrSvg(qr, { margin: 4, silhouette });
  assert.equal(decodePixels(await svgPixels(svg, 1536)), url);
  assert.equal((await QRCheck.run(svg, url)).passed, true);
  const flush = renderQrSvg(qr, { margin: 0, silhouette });
  assert.equal((await QRCheck.run(flush, url)).passed, true, 'zero-margin silhouette');
});
test('colored popular logos retain their colors through normalization and four QR reads', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const qr = encodePayload(url, { hasImage: true });
  for (const name of [
    'whatsapp',
    'facebook',
    'instagram',
    'spotify',
    'youtube',
    'wifi',
    'phone',
    'email',
    'map',
  ]) {
    const image = await normalizeImage(logoImage(name), name);
    assert.match(image.svg, /#[0-9a-f]{6}/i, name);
    const svg = renderQrSvg(qr, { margin: 4, image, imageModules: 5 });
    assert.equal((await QRCheck.run(svg, url)).passed, true, name);
  }
});
test('projects round-trip data and images; imported SVG excludes executable resources', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const old = globalThis.indexedDB;
  globalThis.indexedDB = indexedDB;
  t.after(() => {
    globalThis.indexedDB = old;
  });
  const studio = createStudio(),
    state = studio.getState();
  state.fields.foreground = '#123ca3';
  state.styles.module = 'joined';
  studio.applyState(state);
  assert.equal(studio.getState().styles.module, 'joined');
  await projectStore.save({ id: 'test-project', name: 'Morphiq', state: studio.getState() });
  const restored = await projectStore.get('test-project');
  assert.equal(restored.state.fields.foreground, '#123ca3');
  await projectStore.remove('test-project');
  assert.equal(await projectStore.get('test-project'), undefined);
  const vector = sanitizeSvg(
    '<svg viewBox="0 0 10 10"><script>alert(1)</script><image href="https://example.com/tracker"/><path d="M0 0h10v10H0Z" fill="#000" onclick="alert(1)"/></svg>',
  );
  assert.ok(!/script|https:|onclick|<image/.test(vector.svg));
  const image = await normalizeImage(svgDataUrl(vector.svg), 'Vector');
  assert.ok(image.svg.includes('<path'));
  assert.equal(image.transparent, true);
  assert.throws(() =>
    studio.applyState({
      ...state,
      logo: { data: 'https://example.com/x.png', width: 10, height: 10 },
    }),
  );
});
test('print files carry physical SVG dimensions and PNG/JPEG density', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const svg = renderQrSvg(encodePayload(url), { margin: 4 });
  assert.match(physicalSvg(svg, 50), /width="50mm"/);
  for (const mime of ['image/png', 'image/jpeg']) {
    const blob = await withDpi(await rasterizeQr(svg, 600, mime), 300);
    assert.equal((await sharp(Buffer.from(await blob.arrayBuffer())).metadata()).density, 300);
  }
});
