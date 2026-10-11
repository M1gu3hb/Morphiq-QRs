import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { unzipSync, strFromU8 } from 'fflate';
import { encodePayload } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';
import { decodePixels } from '../../src/validation/decoder.js';

const url = 'https://morphiq.com.mx';
const command = promisify(execFile);

test('camera detection marks the QR and releases the video track on leaving the reader', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const png = await sharp(Buffer.from(renderQrSvg(encodePayload(url), { margin: 4, size: 900 })))
    .png()
    .toBuffer();
  const source = 'data:image/png;base64,' + png.toString('base64');
  await page.addInitScript((data) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 900;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const stream = canvas.captureStream(10);
      window.testCameraTrack = stream.getVideoTracks()[0];
      return stream;
    };
  }, source);
  await page.goto('/?view=scan');
  expect(await page.evaluate(() => window.testCameraTrack)).toBeUndefined();
  await page.locator('#scanner-start').click();
  await expect(page.locator('#scan-content')).toHaveText(url, { timeout: 20_000 });
  await expect(page.locator('#scanner-overlay')).toHaveClass('detected');
  expect(await page.evaluate(() => window.testCameraTrack.readyState)).toBe('live');
  await page.locator('#nav-studio').click();
  expect(await page.evaluate(() => window.testCameraTrack.readyState)).toBe('ended');
});
async function check(page) {
  await page.locator('#check-qr').click();
  await expect(page.locator('#check-results')).toHaveAttribute('data-result', 'passed', {
    timeout: 45_000,
  });
}
async function field(page, id, value) {
  await page.locator('#' + id).evaluate((node, v) => {
    node.value = String(v);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
async function advanced(page) {
  await page.locator('#advanced-enabled').check();
  await page
    .locator('#advanced-tools details.studio-details')
    .evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
}
async function download(page, format, testInfo, name = 'qr') {
  await page.locator(`[data-format="${format}"]`).click();
  const pending = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('#download').click();
  const file = await pending,
    path = testInfo.outputPath(name + '.' + format);
  await file.saveAs(path);
  return path;
}
async function decoded(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return decodePixels({
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  });
}

test('content forms, connected styles, complete-module image editing and mobile layout', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#qr-preview svg')).toBeVisible();
  await expect(page.locator('#margin')).toHaveValue('1');
  await expect(page.locator('#foreground')).toHaveValue('#000000');
  await expect(page.locator('#advanced-tools')).toBeHidden();
  await expect(page.locator('#image-settings')).toBeHidden();
  await expect(page.locator('[data-logo="whatsapp"] svg path')).toHaveAttribute('fill', '#25D366');
  await page.locator('[data-content="whatsapp"]').click();
  await page.locator('#content-whatsapp-phone').fill('525512345678');
  await page.locator('#content-whatsapp-message').fill('Hola, quiero información');
  await expect(page.locator('#destination')).toContainText('https://wa.me/525512345678?text=');
  await check(page);
  await page.locator('#module-menu > summary').click();
  await page.locator('[data-module="joined"]').click();
  await page.locator('[data-logo="whatsapp"]').click();
  await expect(page.locator('#logo-enabled')).toBeChecked();
  await expect(page.locator('input[name="ecc"][value="H"]')).toBeChecked();
  await field(page, 'logo-size', 5);
  const rect = page.locator('#qr-preview clipPath rect');
  await expect(rect).toHaveAttribute('width', '5');
  await field(page, 'image-zoom', 180);
  await page.locator('#image-editor').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#image-x')).toHaveValue('0.1');
  await field(page, 'image-x', 0.25);
  await field(page, 'image-y', -0.35);
  await expect(page.locator('#image-x')).toHaveValue('0.25');
  await expect(page.locator('#image-y')).toHaveValue('-0.35');
  await expect(rect).toHaveAttribute('width', '5');
  await expect(rect).toHaveAttribute('x', /^\d+$/);
  await check(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
  await page.locator('#logo-enabled').uncheck();
  await expect(page.locator('#image-settings')).toBeHidden();
  expect(errors).toEqual([]);
});

test('autosave, named projects, comparison and repair suggestions preserve user choices', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#url').fill('https://morphiq.com.mx/clientes');
  await expect(page.locator('#autosave-status')).toHaveText('Guardado en este dispositivo');
  await page.reload();
  await expect(page.locator('#url')).toHaveValue('https://morphiq.com.mx/clientes');
  await page.locator('#nav-projects').click();
  await page.locator('#project-name').fill('Cliente de prueba');
  await page.locator('#project-save').click();
  await expect(page.locator('#projects-list')).toContainText('Cliente de prueba');
  await page.locator('#projects-close').click();
  await page.locator('#preview-inspector > summary').click();
  await page.locator('#compare-save').click();
  await expect(page.locator('#compare-panel svg')).toHaveCount(2);
  await page.locator('#url').fill(url);
  await expect(page.locator('#destination')).toHaveText(url);
  await page.locator('#compare-apply').click();
  await expect(page.locator('#url')).toHaveValue('https://morphiq.com.mx/clientes');
  await page.locator('#compare-close').click();
  await field(page, 'foreground', '#eeeeee');
  await expect(page.locator('#download')).toBeDisabled();
  await page.locator('#repair-qr').click();
  await expect(page.locator('#repair-apply')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#foreground')).toHaveValue('#eeeeee');
  await page.locator('#repair-apply').click();
  await expect(page.locator('#foreground')).toHaveValue('#000000');
  await expect(page.locator('#margin')).toHaveValue('4');
  await check(page);
  await page.locator('#check-close').click();
  await expect(page.locator('#check-results')).toBeHidden();
  await page.locator('#url').fill('https://morphiq.com.mx/otra-liga');
  await expect(page.locator('#destination')).toHaveText('https://morphiq.com.mx/otra-liga');
  await page.locator('#repair-undo').click();
  await expect(page.locator('#foreground')).toHaveValue('#eeeeee');
  await expect(page.locator('#margin')).toHaveValue('1');
  await expect(page.locator('#url')).toHaveValue('https://morphiq.com.mx/otra-liga');
  await expect(page.locator('#repair-undo-row')).toBeHidden();
  await page.locator('#repair-qr').click();
  await expect(page.locator('#repair-apply')).toBeVisible({ timeout: 30_000 });
  await page.locator('#repair-close').click();
  await expect(page.locator('#repair-result')).toBeHidden();
  await page.locator('#preview-inspector > summary').click();
  await expect(page.locator('#repair-qr')).toBeHidden();
});

test('reference frames stay outside study mode, all labels export, and mobile preview follows edits', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('#advanced-tools')).toBeHidden();
  await page.locator('#border-settings > summary > span').click();
  await page.locator('#border-enabled').check();
  await page.locator('#border-gallery > summary').click();
  await expect(page.locator('#border-options [data-border]')).toHaveCount(43);
  await page.locator('[data-border="discover-landscape"]').click();
  await page.locator('#border-text').fill('Visita Morphiq');
  await page.locator('#border-text-secondary').fill('Cliente & marca');
  await page.locator('#border-text-footer').fill('Una nueva experiencia');
  await expect(page.locator('#qr-preview')).toContainText('Cliente & marca');
  const path = await download(page, 'svg', info, 'editorial');
  const svg = await readFile(path, 'utf8');
  expect(svg).toContain('Cliente &amp; marca');
  expect(svg).toContain('Una nueva experiencia');
  expect(await decoded(path)).toBe(url);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#border-text').scrollIntoViewIfNeeded();
  await expect(page.locator('.following-preview')).toBeVisible();
  await field(page, 'border-color', '#582C83');
  await expect(page.locator('#follow-qr rect[fill="#582C83"]')).toHaveCount(1);
  await page.locator('#follow-expand').click();
  await expect(page.locator('#preview-dialog')).toBeVisible();
  await page.locator('#follow-close').click();
  await page.locator('#follow-toggle').click();
  await expect(page.locator('#follow-expand')).toBeHidden();
  await page.locator('#follow-toggle').click();
  await expect(page.locator('#follow-expand')).toBeVisible();
  await page.screenshot({ path: info.outputPath('frame-mobile.png') });
  await page.locator('#nav-scan').click();
  await expect(page.locator('.following-preview')).toBeHidden();
});

test('framed vector and bitmap PDFs match the readable exported design and print size', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await advanced(page);
  await page.locator('#border-settings > summary > span').click();
  await page.locator('#border-enabled').check();
  await page.locator('#border-controls details').evaluate((d) => (d.open = true));
  await page.locator('[data-border="band"]').click();
  await page.locator('#border-text').fill('MORPHIQ');
  await field(page, 'gradient-mode', 'linear');
  await field(page, 'gradient-color', '#123ca3');
  await page.locator('#print-enabled').check();
  await field(page, 'print-width', 50);
  const vector =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#08254c"/><path d="M30 50L45 65L72 34" fill="none" stroke="#ffffff" stroke-width="12"/></svg>';
  await page
    .locator('#logo-file')
    .setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(vector) });
  await expect(page.locator('#image-name')).toHaveText('logo.svg');
  await field(page, 'logo-size', 5);
  const svgPath = await download(page, 'svg', info, 'vector');
  const svg = await readFile(svgPath, 'utf8');
  expect(svg).toContain('width="50mm"');
  expect(svg).toContain('<circle');
  expect(svg).not.toContain('<image');
  expect(await decoded(svgPath)).toBe(url);
  const pdf = await download(page, 'pdf', info, 'vector');
  await command('pdftoppm', [
    '-singlefile',
    '-scale-to',
    '1400',
    '-png',
    pdf,
    info.outputPath('pdf-vector'),
  ]);
  expect(await decoded(info.outputPath('pdf-vector.png'))).toBe(url);
  const png = await download(page, 'png', info, 'print');
  const metadata = await sharp(png).metadata();
  expect(metadata.width).toBe(591);
  expect(metadata.density).toBe(300);
  expect(await decoded(png)).toBe(url);
  const picture = await sharp({
    create: { width: 160, height: 120, channels: 4, background: '#08254c' },
  })
    .png()
    .toBuffer();
  await page
    .locator('#logo-file')
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: picture });
  await expect(page.locator('#image-name')).toHaveText('photo.png');
  await field(page, 'logo-size', 5);
  const bitmap = await download(page, 'pdf', info, 'bitmap');
  await command('pdftoppm', [
    '-singlefile',
    '-scale-to',
    '1400',
    '-png',
    bitmap,
    info.outputPath('pdf-bitmap'),
  ]);
  expect(await decoded(info.outputPath('pdf-bitmap.png'))).toBe(url);
  for (const mode of ['texture', 'background']) {
    await field(page, 'image-mode', mode);
    await field(page, 'image-zoom', 130);
    await field(page, 'image-x', 2);
    const artwork = await download(page, 'pdf', info, mode);
    await command('pdftoppm', [
      '-singlefile',
      '-scale-to',
      '1400',
      '-png',
      artwork,
      info.outputPath(mode),
    ]);
    expect(await decoded(info.outputPath(mode + '.png'))).toBe(url);
  }
  await field(page, 'image-mode', 'center');
  const contour = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="122" fill="black"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  await page
    .locator('#silhouette-file')
    .setInputFiles({ name: 'circle.png', mimeType: 'image/png', buffer: contour });
  await expect(page.locator('#silhouette-enabled')).toBeChecked();
  const shapePdf = await download(page, 'pdf', info, 'silhouette');
  await command('pdftoppm', [
    '-singlefile',
    '-scale-to',
    '1400',
    '-png',
    shapePdf,
    info.outputPath('silhouette'),
  ]);
  expect(await decoded(info.outputPath('silhouette.png'))).toBe(url);
});

test('checked batch ZIP includes valid QRs and a truthful per-item report', async ({
  page,
}, info) => {
  await page.goto('/');
  await advanced(page);
  await page
    .locator('#batch-input')
    .fill(
      'nombre,tipo,url,phone,message\nMorphiq,url,https://morphiq.com.mx,,\nWhatsApp,whatsapp,,525512345678,Hola\nError,url,javascript:alert(1),,',
    );
  await field(page, 'batch-format', 'svg');
  const pending = page.waitForEvent('download', { timeout: 40_000 });
  await page.locator('#batch-generate').click();
  const file = await pending,
    path = info.outputPath('batch.zip');
  await file.saveAs(path);
  const files = unzipSync(new Uint8Array(await readFile(path)));
  const report = JSON.parse(strFromU8(files['reporte.json']));
  expect(report.filter((r) => r.passed)).toHaveLength(2);
  expect(report.find((r) => r.name === 'Error').passed).toBe(false);
  const { data, info: size } = await sharp(Buffer.from(files[report[0].file]))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(
    decodePixels({ data: new Uint8ClampedArray(data), width: size.width, height: size.height }),
  ).toBe(url);
});

test('PWA opens scanner, detects and outlines uploaded QRs offline without navigating', async ({
  page,
  context,
}, info) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const png = await sharp(Buffer.from(renderQrSvg(encodePayload(url), { margin: 4, size: 900 })))
    .png()
    .toBuffer();
  await context.setOffline(true);
  await page.goto('/?app=1');
  await expect(page.locator('#scanner-view')).toBeVisible();
  await expect(page.locator('#studio-view')).toBeHidden();
  const startUrl = page.url();
  await page
    .locator('#scanner-file')
    .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#scan-content')).toHaveText(url, { timeout: 20_000 });
  await expect(page.locator('#scan-open')).toHaveAttribute('href', new URL(url).href);
  await expect(page.locator('#scanner-overlay')).toHaveClass('detected');
  await expect(page.locator('#scanner-polygon')).not.toHaveAttribute('points', '');
  expect(page.url()).toBe(startUrl);
  expect(context.pages()).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('scanner.png'), fullPage: true });
  await page.locator('#nav-studio').click();
  await page.locator('#url').fill('https://morphiq.com.mx/offline');
  await check(page);
});

test('untrusted scanner content is shown as text and never becomes an executable action', async ({
  page,
}) => {
  await page.goto('/?view=scan');
  const value = 'javascript:alert(document.cookie)',
    png = await sharp(Buffer.from(renderQrSvg(encodePayload(value), { margin: 4, size: 900 })))
      .png()
      .toBuffer();
  await page
    .locator('#scanner-file')
    .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#scan-content')).toHaveText(value);
  await expect(page.locator('#scan-open')).toBeHidden();
  await expect(page.locator('#scan-open')).not.toHaveAttribute('href');
});
