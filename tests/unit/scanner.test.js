import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanResult } from '../../src/scanner/result.js';
import { visibleVideoRect } from '../../src/scanner/rebuild.js';

test('scanner descriptions retain their exact raw payload, including escaped Wi-Fi and mail headers', () => {
  const values = [
    'https://morphiq.com.mx/?a=1&b=2#inicio',
    'WIFI:T:WPA;S:Red\\;Morphiq;P:a\\:b\\\\c;H:true;;',
    'mailto:hola@morphiq.com.mx?subject=Hola%20Miguel&body=Uno%0ADos',
    'tel:+525512345678',
    'SMSTO:+525512345678:Hola: gracias',
    'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Miguel\r\nEND:VCARD',
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
    'Texto 🌐 & <img onerror="alert(1)">',
  ];
  for (const value of values) assert.equal(scanResult(value).payload, value);
  assert.equal(scanResult(values[4]).href, 'sms:+525512345678?body=Hola%3A%20gracias');
  assert.equal(scanResult('SMSTO:javascript:alert(1)').href, undefined);
});
test('camera decoding uses the same centered cover crop visible in the viewport', () => {
  const portrait = visibleVideoRect(1920, 1080, 390, 844);
  assert.ok(Math.abs(portrait.width - (390 * 1080) / 844) < 1e-9);
  assert.ok(Math.abs(portrait.x - (1920 - portrait.width) / 2) < 1e-9);
  assert.equal(portrait.y, 0);
  assert.equal(portrait.height, 1080);
  const wide = visibleVideoRect(900, 900, 1440, 1000);
  assert.equal(wide.x, 0);
  assert.equal(wide.width, 900);
  assert.equal(wide.height, 625);
  assert.equal(wide.y, 137.5);
});
