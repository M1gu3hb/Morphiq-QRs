import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentPayload, withCampaign } from '../../src/content/payloads.js';
import { batchRows, parseCsv } from '../../src/advanced/batch.js';
import { scanResult } from '../../src/scanner/result.js';
import { largestSquare } from '../../src/image/silhouette.js';

test('WhatsApp, Wi-Fi, contact and event payloads preserve escaped content', () => {
  assert.equal(
    contentPayload('whatsapp', { phone: '+52 55 1234 5678', message: 'Hola & gracias' }),
    'https://wa.me/525512345678?text=Hola%20%26%20gracias',
  );
  const wifi = contentPayload('wifi', {
    ssid: 'Red;Morphiq',
    security: 'WPA',
    password: 'a:b\\c',
    hidden: true,
  });
  const result = scanResult(wifi);
  assert.match(result.content, /Red;Morphiq/);
  assert.ok(result.content.includes('a:b\\c'));
  const card = contentPayload('contact', {
    name: 'Miguel Huerta',
    company: 'Morphiq',
    phone: '525512345678',
  });
  assert.match(card, /FN:Miguel Huerta/);
  assert.match(card, /END:VCARD/);
  assert.equal(scanResult(card).download, 'vcf');
  const event = contentPayload('event', {
    title: 'Visita',
    start: '2026-10-12T10:00:00Z',
    end: '2026-10-12T11:00:00Z',
  });
  assert.match(event, /DTSTART:20261012T100000Z/);
  assert.equal(scanResult(event).download, 'ics');
  const mail = contentPayload('email', { email: 'hola@morphiq.com.mx', subject: 'Hola' });
  assert.equal(scanResult(mail).kind, 'Correo');
  assert.equal(scanResult(mail).content, 'hola@morphiq.com.mx');
  assert.equal(scanResult('mailto:bad%0A@morphiq.com.mx').href, undefined);
  assert.throws(() =>
    contentPayload('event', {
      title: 'Visita',
      start: '2026-10-12T11:00:00Z',
      end: '2026-10-12T10:00:00Z',
    }),
  );
});
test('campaign tags remain on the original domain and unsupported scanner URLs stay inert', () => {
  const url = withCampaign('https://morphiq.com.mx/contacto?a=1', {
    enabled: true,
    source: 'tarjeta',
    campaign: 'prueba',
  });
  assert.equal(new URL(url).hostname, 'morphiq.com.mx');
  assert.equal(new URL(url).searchParams.get('utm_source'), 'tarjeta');
  assert.throws(() => withCampaign('WIFI:S:test;;', { enabled: true }));
  for (const payload of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd'])
    assert.equal(scanResult(payload).href, undefined);
  assert.throws(() => contentPayload('spotify', { url: 'https://example.com/track/abc' }));
});
test('batch parsing supports quoted commas and multiline messages', () => {
  assert.deepEqual(parseCsv('name,message\r\n"QR, 1","Hola\nMiguel"'), [
    ['name', 'message'],
    ['QR, 1', 'Hola\nMiguel'],
  ]);
  const rows = batchRows(
    'nombre,tipo,phone,message\nCliente,whatsapp,525512345678,"Hola, gracias"',
  );
  assert.equal(rows[0].fields.message, 'Hola, gracias');
  assert.equal(batchRows('https://morphiq.com.mx\nhttps://example.com/?a=1,b=2').length, 2);
  assert.throws(() => batchRows(Array(101).fill('https://example.com').join('\n')));
  assert.throws(() => parseCsv('"unclosed'));
});
test('silhouette placement uses a square entirely inside its opaque area', () => {
  const alpha = new Uint8Array(100);
  for (let y = 2; y < 8; y++) for (let x = 3; x < 9; x++) alpha[y * 10 + x] = 255;
  const box = largestSquare(alpha, 10, 10);
  assert.deepEqual(box, { x: 3, y: 2, side: 6 });
  for (let y = box.y; y < box.y + box.side; y++)
    for (let x = box.x; x < box.x + box.side; x++) assert.equal(alpha[y * 10 + x], 255);
});
