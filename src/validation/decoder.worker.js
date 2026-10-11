import { decodePixels } from './decoder.js';

self.onmessage = ({ data: { id, pixels, width, height } }) => {
  try {
    const decoded = decodePixels({ data: new Uint8ClampedArray(pixels), width, height });
    self.postMessage({ id, data: decoded });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
