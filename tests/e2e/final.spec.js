import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { encodePayload } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';
import { contentPayload } from '../../src/content/payloads.js';
import { decodePixels } from '../../src/validation/decoder.js';

const url = 'https://morphiq.com.mx';
async function pngPayload(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return decodePixels({
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  });
}
async function qrImage(value) {
  return sharp(Buffer.from(renderQrSvg(encodePayload(value), { margin: 4, size: 900 })))
    .png()
    .toBuffer();
}
async function captureShare(page) {
  await page.addInitScript(() => {
    window.sharedImages = [];
    Object.defineProperty(navigator, 'canShare', {
      value: ({ files }) => files?.[0]?.type === 'image/png',
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: async (value) => {
        if (!navigator.userActivation.isActive)
          throw new DOMException('Tap required', 'NotAllowedError');
        const file = value.files[0];
        window.sharedImages.push({
          keys: Object.keys(value),
          name: file.name,
          type: file.type,
          data: [...new Uint8Array(await file.arrayBuffer())],
        });
      },
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value) => {
          window.copiedInformation = value;
        },
      },
      configurable: true,
    });
  });
}
async function shareCurrent(page, count) {
  await page.locator('#share-qr').click();
  await expect
    .poll(() =>
      page.evaluate(
        (n) =>
          window.sharedImages.length === n ||
          document.getElementById('share-status').textContent.startsWith('Imagen lista.'),
        count,
      ),
    )
    .toBe(true);
  if ((await page.evaluate(() => window.sharedImages.length)) < count)
    await page.locator('#share-qr').click();
  await expect.poll(() => page.evaluate(() => window.sharedImages.length)).toBe(count);
}

test('generator native sharing uses a current, verified PNG with no text, title or link', async ({
  page,
}) => {
  await captureShare(page);
  await page.goto('/');
  await expect(page.locator('#share-qr')).toHaveAttribute('data-state', 'idle');
  await shareCurrent(page, 1);
  let image = await page.evaluate(() => window.sharedImages[0]);
  expect(image.keys).toEqual(['files']);
  expect(image.type).toBe('image/png');
  expect(await pngPayload(Buffer.from(image.data))).toBe(url);
  await page.locator('#url').fill(url + '/compartir?prueba=2');
  await expect(page.locator('#destination')).toHaveText(url + '/compartir?prueba=2');
  await page.locator('#filename').fill('Cliente final');
  await shareCurrent(page, 2);
  image = await page.evaluate(() => window.sharedImages[1]);
  expect(image.name).toBe('Cliente-final.png');
  expect(await pngPayload(Buffer.from(image.data))).toBe(url + '/compartir?prueba=2');
  await page.locator('[data-picker="foreground"]').click();
  await page.locator('#picker-hex').fill('#EEEEEE');
  await page.locator('#picker-done').click();
  await expect(page.locator('#share-qr')).toBeDisabled();
});

test('scanner shares exact Wi-Fi and email payloads, copies descriptions and clears invalid uploads', async ({
  page,
  context,
}, info) => {
  await captureShare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?app=1');
  const initial = page.url();
  for (const payload of [
    'WIFI:T:WPA;S:Red\\;Morphiq;P:a\\:b\\\\c;H:true;;',
    'mailto:hola@morphiq.com.mx?subject=Hola%20Miguel&body=Uno%0ADos',
  ]) {
    await page
      .locator('#scanner-file')
      .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: await qrImage(payload) });
    await expect(page.locator('#scan-rebuilt svg')).toBeVisible();
    await expect(page.locator('#scan-share')).toBeEnabled();
    const previous = await page.evaluate(() => window.sharedImages.length);
    await page.locator('#scan-share').click();
    await expect.poll(() => page.evaluate(() => window.sharedImages.length)).toBe(previous + 1);
    const image = await page.evaluate(() => window.sharedImages.at(-1));
    expect(image.keys).toEqual(['files']);
    expect(await pngPayload(Buffer.from(image.data))).toBe(payload);
    await page.locator('#scan-copy').click();
    expect(await page.evaluate(() => window.copiedInformation)).toBe(
      await page.locator('#scan-content').textContent(),
    );
    expect(page.url()).toBe(initial);
    expect(context.pages()).toHaveLength(1);
    expect(await page.locator('#camera-stage').boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  }
  await page.screenshot({ path: info.outputPath('scan-mobile.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  const panel = await page.locator('#scan-result').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.y).toBeGreaterThanOrEqual(60);
  expect(panel.y + panel.height).toBeLessThanOrEqual(390);
  await expect(page.locator('#scan-share')).toBeVisible();
  await page.screenshot({ path: info.outputPath('scan-landscape.png') });
  await page
    .locator('#scanner-file')
    .setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.locator('#scan-result')).toBeHidden();
  await expect(page.locator('#scanner-status')).toContainText('No se pudo');
  await expect(page.locator('#scan-open')).not.toHaveAttribute('href');
});

test('scanner permission failures and delayed camera responses remain recoverable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await page.goto('/?view=scan');
  await page.locator('#scanner-start').click();
  await expect(page.locator('#scanner-status')).toContainText('Permite la cámara');
  await expect(page.locator('#scanner-start')).toBeEnabled();
  await page
    .locator('#scanner-file')
    .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: await qrImage(url) });
  await expect(page.locator('#scan-content')).toHaveText(url);
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        window.finishCamera = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 64;
          const stream = canvas.captureStream(5);
          window.lateTrack = stream.getVideoTracks()[0];
          resolve(stream);
        };
      });
  });
  await page.locator('#scan-again').click();
  await expect(page.locator('#scanner-status')).toHaveText('Solicitando cámara…');
  await page.locator('#nav-studio').click();
  await page.evaluate(() => window.finishCamera());
  await expect.poll(() => page.evaluate(() => window.lateTrack.readyState)).toBe('ended');
  await expect(page.locator('#studio-view')).toBeVisible();
});

test('all content forms encode correctly and all five exports download readable files', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const cases = [
    ['whatsapp', { phone: '525512345678', message: 'Hola & gracias' }],
    ['wifi', { ssid: 'Red;Morphiq', password: 'a:b\\c', security: 'WPA' }],
    ['contact', { name: 'Miguel Huerta', phone: '525512345678', email: 'hola@morphiq.com.mx' }],
    ['phone', { phone: '525512345678' }],
    ['email', { email: 'hola@morphiq.com.mx', subject: 'QR & cliente', message: 'Hola\nMiguel' }],
    ['event', { title: 'Visita', start: '2026-10-12T10:00', end: '2026-10-12T11:00' }],
    ['spotify', { url: 'https://open.spotify.com/track/123ABC' }],
    ['social', { platform: 'instagram', handle: 'morphiq' }],
    ['app', { url }],
    ['map', { address: 'Xochimilco, CDMX' }],
    ['text', { text: 'Hola, Miguel 🌐' }],
    ['sms', { phone: '525512345678', message: 'Hola: gracias' }],
  ];
  for (const [type, fields] of cases) {
    await page.locator(`[data-content="${type}"]`).click();
    for (const [key, value] of Object.entries(fields)) {
      const field = page.locator(`#content-${type}-${key}`);
      if ((await field.evaluate((node) => node.tagName)) === 'SELECT')
        await field.selectOption(value);
      else await field.fill(value);
    }
    const normalized =
      type === 'event'
        ? await page.evaluate(
            (values) => ({
              ...values,
              start: new Date(values.start).toISOString(),
              end: new Date(values.end).toISOString(),
            }),
            fields,
          )
        : fields;
    const expected = contentPayload(type, normalized);
    // datetime-local follows the browser's timezone, which can differ from Node.
    await expect(page.locator('#destination')).toHaveText(expected);
    const svg = await page.locator('#qr-preview svg').evaluate((node) => node.outerHTML);
    expect(await pngPayload(Buffer.from(svg))).toBe(expected);
  }
  await page.locator('[data-content="url"]').click();
  for (const format of ['png', 'jpg', 'webp', 'svg']) {
    await page.locator(`[data-format="${format}"]`).click();
    const pending = page.waitForEvent('download', { timeout: 45_000 });
    await page.locator('#download').click();
    const file = await pending;
    const path = info.outputPath('qr.' + format);
    await file.saveAs(path);
    expect(await pngPayload(await readFile(path))).toBe(url);
    expect(file.suggestedFilename()).toBe('morphiq-qr.' + format);
  }
  // PDF geometry and decoding are covered by the vector/bitmap/print test.
  await page.locator('#share-qr').evaluate((button) => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
  });
  const pending = page.waitForEvent('download', { timeout: 45_000 });
  await page.locator('#share-qr').click();
  const file = await pending;
  const path = info.outputPath('share.png');
  await file.saveAs(path);
  expect(await pngPayload(await readFile(path))).toBe(url);
  await expect(page.locator('#share-status')).toContainText('no comparte archivos');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('[data-picker="background"]').click();
  await expect(page.locator('#color-picker')).toBeVisible();
  await page.locator('#picker-hex').fill('oops');
  await expect(page.locator('#picker-hex')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#color-picker')).toBeHidden();
  await expect(page.locator('[data-picker="background"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(errors).toEqual([]);
});

test('project JSON restores edited imagery and rejects invalid input without changing the design', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.locator('#url').fill(url + '/respaldo');
  await page.locator('[data-logo="instagram"]').click();
  await page.locator('#nav-projects').click();
  await page.locator('#project-name').fill('Cliente respaldo');
  const pending = page.waitForEvent('download');
  await page.locator('#project-export').click();
  const backup = await pending;
  const path = info.outputPath('project.json');
  await backup.saveAs(path);
  const data = JSON.parse(await readFile(path, 'utf8'));
  expect(data.app).toBe('Morphiq QR');
  expect(data.state.fields.url).toBe(url + '/respaldo');
  expect(data.state.logo).toBeTruthy();
  await page.locator('#projects-close').click();
  await page.locator('#reset').click();
  await expect(page.locator('#image-settings')).toBeHidden();
  await page.locator('#url').fill(url);
  await page.locator('#nav-projects').click();
  await page.locator('#project-import').setInputFiles(path);
  await expect(page.locator('#projects-dialog')).not.toBeVisible();
  await expect(page.locator('#url')).toHaveValue(url + '/respaldo');
  await expect(page.locator('#image-settings')).toBeVisible();
  await page.locator('#nav-projects').click();
  await page.locator('#project-import').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...data,
        state: {
          ...data.state,
          logo: { data: 'https://example.com/logo.png', width: 1, height: 1 },
        },
      }),
    ),
  });
  await expect(page.locator('#projects-status')).toContainText('imagen');
  await expect(page.locator('#url')).toHaveValue(url + '/respaldo');
});
