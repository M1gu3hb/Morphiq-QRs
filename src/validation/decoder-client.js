let worker = null;
let unavailable = false;
let sequence = 0;
const pending = new Map();

function getWorker() {
  if (unavailable || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./decoder.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.data);
    };
    worker.onerror = () => {
      for (const job of pending.values()) {
        clearTimeout(job.timer);
        job.reject(new Error('No se pudo iniciar el lector. Vuelve a comprobar.'));
      }
      pending.clear();
      worker?.terminate();
      worker = null;
      unavailable = true;
    };
    return worker;
  } catch {
    unavailable = true;
    return null;
  }
}

export async function decodeQrImage(image) {
  const activeWorker = getWorker();
  if (!activeWorker) {
    const { decodePixels } = await import('./decoder.js');
    return decodePixels(image);
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('El lector tardó demasiado. Reduce la resolución y vuelve a comprobar.'));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    const pixels = image.data.buffer.slice(
      image.data.byteOffset,
      image.data.byteOffset + image.data.byteLength,
    );
    activeWorker.postMessage({ id, pixels, width: image.width, height: image.height }, [pixels]);
  });
}
