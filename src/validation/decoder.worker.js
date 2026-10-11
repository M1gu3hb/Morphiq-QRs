import { decodePixels, decodeDetails } from './decoder.js';

self.onmessage = ({ data: { id, pixels, width, height, details } }) => {
  try {
    const decoded = (details ? decodeDetails : decodePixels)({
      data: new Uint8ClampedArray(pixels),
      width,
      height,
    });
    self.postMessage({ id, data: decoded });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
