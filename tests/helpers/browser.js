import { readFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';

// Local adapters for integration tests; production uses the browser's own APIs.
export async function installBrowser() {
  const root = new URL('../../', import.meta.url);
  const { document, window } = parseHTML(await readFile(new URL('index.html', root), 'utf8'));
  const saved = new Map();
  const objectUrls = new Map();
  const timers = new Set();
  const downloads = [];
  const nativeTimeout = globalThis.setTimeout;
  const setGlobal = (key, value) => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  };
  const originalCreate = document.createElement.bind(document);
  document.createElement = (tag, ...args) => {
    if (tag === 'canvas') {
      const canvas = createCanvas(1, 1);
      const context = canvas.getContext('2d');
      const draw = context.drawImage.bind(context);
      context.drawImage = (image, ...values) => draw(image._image || image, ...values);
      canvas.getContext = () => context;
      canvas.toBlob = (callback, mime, quality) => {
        const base64 = canvas.toDataURL(mime, quality).split(',')[1];
        callback(new Blob([Buffer.from(base64, 'base64')], { type: mime }));
      };
      return canvas;
    }
    const node = originalCreate(tag, ...args);
    if (tag === 'a')
      node.click = () =>
        downloads.push({ filename: node.download, blob: objectUrls.get(node.href) });
    return node;
  };

  class TestImage {
    set src(source) {
      (async () => {
        let buffer;
        if (objectUrls.has(source))
          buffer = Buffer.from(await objectUrls.get(source).arrayBuffer());
        else if (source.startsWith('data:')) buffer = Buffer.from(source.split(',')[1], 'base64');
        else buffer = await readFile(new URL('public/' + source.replace(/^\//, ''), root));
        if (buffer.toString('utf8', 0, 100).includes('<svg'))
          buffer = await sharp(buffer).png().toBuffer();
        this._image = await loadImage(buffer);
        this.width = this.naturalWidth = this._image.width;
        this.height = this.naturalHeight = this._image.height;
        this.onload?.();
      })().catch((error) => this.onerror?.(error));
    }
  }
  class TestURL extends URL {
    static createObjectURL(blob) {
      const url = `blob:local-test-${objectUrls.size}-${Math.random()}`;
      objectUrls.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      objectUrls.delete(url);
    }
  }
  class TestFileReader {
    async readAsDataURL(file) {
      try {
        this.result = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
        this.onload?.();
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
  for (const input of document.querySelectorAll('input')) {
    if (input.type === 'radio' || input.type === 'checkbox') {
      Object.defineProperty(input, 'checked', {
        get() {
          return this.hasAttribute('checked');
        },
        set(value) {
          if (value) this.setAttribute('checked', '');
          else this.removeAttribute('checked');
        },
      });
    }
  }
  for (const select of document.querySelectorAll('select')) {
    const initial = select.querySelector('option[selected]') || select.querySelector('option');
    Object.defineProperty(select, 'value', { value: initial?.value, writable: true });
  }
  for (const node of document.querySelectorAll('[tabindex], input, button, summary')) {
    node.setPointerCapture = () => {};
    node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 150, height: 150 });
  }
  setGlobal('document', document);
  setGlobal('DOMParser', window.DOMParser);
  setGlobal('window', window);
  setGlobal('Image', TestImage);
  setGlobal('FileReader', TestFileReader);
  setGlobal('Event', window.Event);
  setGlobal('URL', TestURL);
  setGlobal('Worker', undefined);
  setGlobal('requestAnimationFrame', (callback) => setImmediate(callback));
  setGlobal('setTimeout', (callback, delay, ...args) => {
    const timer = nativeTimeout(callback, delay, ...args);
    timers.add(timer);
    return timer;
  });
  return {
    document,
    downloads,
    restore() {
      for (const timer of timers) clearTimeout(timer);
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

export async function svgPixels(svg, size = 768) {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

export async function waitUntil(condition, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('The UI did not finish its operation.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
