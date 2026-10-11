import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { installBrowser, svgPixels, waitUntil } from '../helpers/browser.js';
import { createStudio } from '../../src/app/create-studio.js';
import { initColorPicker } from '../../src/ui/color-picker.js';
import { encodeLink } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';
import { QRStyles } from '../../src/qr/styles.js';
import { decodePixels } from '../../src/validation/decoder.js';
import { QRCheck } from '../../src/validation/qr-checker.js';
import { createPdf } from '../../src/export/pdf.js';
import { DEFAULT_FIELDS } from '../../src/app/defaults.js';

const destination = 'https://morphiq.com.mx';

test('catalog SVGs render, preserve the payload and common shapes decode', async () => {
  const qr = encodeLink(destination);
  const required = new Set(['square', 'dots', 'rounded', 'extra-rounded', 'circuit']);
  for (const preset of QRStyles.presets) {
    const svg = renderQrSvg(qr, { ...preset, size: 768, margin: 1 });
    const pixels = await svgPixels(svg);
    const decoded = decodePixels(pixels);
    assert.ok(decoded === null || decoded === destination, preset.id);
    if (required.has(preset.module) && preset.eye === 'square')
      assert.equal(decoded, destination, preset.id);
  }
});

test('controller preserves defaults, colors, image framing, validation and five downloads', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const { document, downloads } = browser;
  const el = (id) => document.getElementById(id);
  const emit = (id, value, event = 'input') => {
    el(id).value = value;
    el(id).dispatchEvent(new Event(event, { bubbles: true }));
  };
  const studio = createStudio();
  initColorPicker();
  assert.equal(el('margin').value, DEFAULT_FIELDS.margin);
  assert.equal(el('foreground').value, DEFAULT_FIELDS.foreground);
  assert.equal(document.querySelectorAll('[data-preset]').length, 64);
  assert.equal(document.querySelectorAll('[data-module]').length, 41);
  assert.equal(decodePixels(await svgPixels(el('qr-preview').innerHTML)), destination);

  // Color updates flow from the custom dialog to the actual QR renderer.
  document.querySelector('[data-picker="foreground"]').click();
  emit('picker-hex', '#0044AA');
  assert.equal(el('foreground').value, '#0044aa');
  assert.ok(el('qr-preview').innerHTML.includes('#0044aa'));
  el('picker-done').click();
  assert.equal(await studio.checkQr(), true);
  assert.equal(el('check-results').dataset.result, 'passed');
  emit('margin', '4');
  assert.equal(el('check-results').dataset.result, 'changed');
  emit('foreground', '#eeeeee');
  assert.equal(el('download').disabled, true);
  assert.equal(await studio.checkQr(), false);
  assert.ok(el('check-advice').textContent.includes('más oscuros'));

  el('reset').click();
  el('use-brand').click();
  await waitUntil(() => el('logo-enabled').checked);
  assert.equal(el('stat-ecc').textContent, 'H');
  assert.ok(el('qr-preview').innerHTML.includes('<image'));
  const before = document.querySelector('#qr-preview image');
  const oldWidth = Number(before.getAttribute('width'));
  const windowWidth = document.querySelector('#qr-preview clipPath rect').getAttribute('width');
  emit('image-zoom', '200');
  emit('image-x', '30');
  assert.equal(
    Number(document.querySelector('#qr-preview image').getAttribute('width')),
    oldWidth * 2,
  );
  assert.equal(
    document.querySelector('#qr-preview clipPath rect').getAttribute('width'),
    windowWidth,
  );
  emit('image-x', '0');
  emit('image-zoom', '100');
  emit('margin', '4');
  document.querySelector('[data-blend="weave"]').click();
  assert.equal(await studio.checkQr(), true);

  el('reset').click();
  for (const format of ['png', 'svg', 'pdf', 'jpg', 'webp']) {
    document.querySelector(`[data-format="${format}"]`).click();
    await studio.exportQr();
    const download = downloads.at(-1);
    assert.equal(download.filename, `morphiq-qr.${format}`);
    assert.ok(download.blob.size > 100);
    if (format === 'svg')
      assert.equal(decodePixels(await svgPixels(await download.blob.text())), destination);
    else if (format === 'pdf') {
      const pdf = await download.blob.text();
      assert.match(pdf, /^%PDF-1\.4/);
      assert.match(pdf, /xref\n0 6/);
      assert.match(pdf, /\/MediaBox \[0 0 141\.732283 141\.732283\]/);
    } else {
      const bytes = Buffer.from(await download.blob.arrayBuffer());
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(info.format, 'raw');
      assert.equal(
        decodePixels({ data: new Uint8ClampedArray(data), width: info.width, height: info.height }),
        destination,
      );
      assert.equal(
        (await sharp(bytes).metadata()).format,
        { png: 'png', jpg: 'jpeg', webp: 'webp' }[format],
      );
    }
  }
});

test('checker performs four real reads and rejects an incorrect destination or cancelled result', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const svg = renderQrSvg(encodeLink(destination), { size: 1024 });
  const steps = [];
  const result = await QRCheck.run(svg, destination, {
    onStep: (i, state) => steps.push([i, state]),
  });
  assert.equal(result.passed, true);
  assert.equal(result.outcomes.length, 4);
  assert.equal(steps.filter(([, state]) => state === 'running').length, 4);
  assert.equal((await QRCheck.run(svg, 'https://example.com')).passed, false);
  assert.equal(await QRCheck.run(svg, destination, { isCurrent: () => false }), null);
});

test('PDF embeds the composed image without flattening QR vector paths', async (t) => {
  const browser = await installBrowser();
  t.after(() => browser.restore());
  const image = createCanvas(100, 50);
  const context = image.getContext('2d');
  context.fillStyle = '#0044aa';
  context.fillRect(10, 10, 80, 30);
  const qr = encodeLink(destination, { hasImage: true });
  const options = {
    margin: 4,
    foreground: '#000000',
    background: '#ffffff',
    eyes: '#000000',
    module: 'rounded',
    eye: 'rounded',
    center: 'square',
    image: { data: image.toDataURL(), width: 100, height: 50, transparent: true },
    imageSize: 20,
    zoom: 125,
    panX: 20,
    panY: -10,
    fit: 'contain',
    frame: 'rounded',
    blend: 'weave',
    imageBackground: '#ffffff',
    size: 1024,
  };
  const bytes = Buffer.from(await (await createPdf(qr, options, 50)).arrayBuffer());
  const pdf = bytes.toString('latin1');
  assert.match(pdf, /\/Subtype \/Image/);
  assert.match(pdf, /\/Logo Do/);
  assert.match(pdf, /xref\n0 7/);
  assert.ok((pdf.match(/\nc\n/g) || []).length > 0 || pdf.includes(' c\n'));
  const offset = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(bytes.subarray(offset, offset + 4).toString(), 'xref');
});
