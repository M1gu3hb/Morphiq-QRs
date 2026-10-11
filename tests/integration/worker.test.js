import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { svgPixels } from '../helpers/browser.js';
import { encodeLink } from '../../src/qr/encoder.js';
import { renderQrSvg } from '../../src/qr/renderer.js';

test('decoder worker reads transferred pixels and handles simultaneous jobs', async (t) => {
  const workerUrl = new URL('../../src/validation/decoder.worker.js', import.meta.url).href;
  const worker = new Worker(
    `
    const { parentPort } = require('node:worker_threads');
    (async () => {
      globalThis.self = globalThis;
      self.postMessage = (data) => parentPort.postMessage(data);
      await import(${JSON.stringify(workerUrl)});
      parentPort.on('message', (data) => self.onmessage({ data }));
    })().catch((error) => { throw error; });
  `,
    { eval: true },
  );
  t.after(() => worker.terminate());
  const pending = new Map();
  worker.on('message', (result) => {
    const job = pending.get(result.id);
    if (result.error) job.reject(new Error(result.error));
    else job.resolve(result.data);
    pending.delete(result.id);
  });
  worker.on('error', (error) => {
    for (const job of pending.values()) job.reject(error);
  });
  let sequence = 0;
  const read = (image) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      const pixels = image.data.buffer;
      worker.postMessage({ id, pixels, width: image.width, height: image.height }, [pixels]);
      assert.equal(pixels.byteLength, 0);
    });
  const urls = ['https://morphiq.com.mx', 'https://morphiq.com.mx/contacto?source=qr'];
  const inputs = await Promise.all(urls.map((url) => svgPixels(renderQrSvg(encodeLink(url), {}))));
  assert.deepEqual(await Promise.all(inputs.map(read)), urls);
  const blank = { data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 };
  assert.equal(await read(blank), null);
});
