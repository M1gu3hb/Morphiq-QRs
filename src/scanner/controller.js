import { decodeQrImage } from '../validation/decoder-client.js';
import { scanResult } from './result.js';
import { loadImage, readFile } from '../image/image-loader.js';
import { saveFile } from '../utils/files.js';
export function createScanner() {
  const el = (id) => document.getElementById(id),
    video = el('scanner-video'),
    canvas = document.createElement('canvas');
  let stream = null,
    session = 0,
    facing = 'environment',
    found = null,
    torch = false,
    starting = false;
  const status = (text) => (el('scanner-status').textContent = text);
  function stop() {
    session++;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    el('scanner-stop').hidden = true;
    el('scanner-start').hidden = false;
    el('scanner-torch').hidden = true;
    starting = false;
  }
  function display(result, width, height) {
    found = scanResult(result.data);
    el('scan-kind').textContent = found.kind;
    el('scan-content').textContent = found.content;
    el('scan-result').hidden = false;
    el('scan-open').hidden = !found.href;
    if (found.href) {
      el('scan-open').href = found.href;
      el('scan-open').textContent = found.action;
    } else el('scan-open').removeAttribute('href');
    el('scan-save').hidden = !found.download;
    el('scan-save').textContent = found.kind === 'Contacto' ? 'Guardar contacto' : 'Guardar evento';
    el('scan-guide').hidden = true;
    el('scanner-overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
    const l = result.location;
    if (l)
      el('scanner-polygon').setAttribute(
        'points',
        [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner]
          .map((p) => `${p.x},${p.y}`)
          .join(' '),
      );
    el('scanner-overlay').classList.remove('detected');
    requestAnimationFrame(() => el('scanner-overlay').classList.add('detected'));
    status('QR reconocido. Elige cómo abrirlo.');
  }
  async function loop(token) {
    if (token !== session || !stream) return;
    try {
      if (!found && video.readyState >= 2) {
        const scale = Math.min(1, 800 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const result = await decodeQrImage(ctx.getImageData(0, 0, canvas.width, canvas.height), {
          details: true,
        });
        if (token !== session) return;
        if (result) display(result, canvas.width, canvas.height);
      }
    } catch (error) {
      if (token === session) status(error.message || 'No se pudo leer este cuadro.');
    }
    if (token === session && stream) setTimeout(() => loop(token), 140);
  }
  async function start() {
    if (starting) return;
    stop();
    starting = true;
    const token = ++session;
    found = null;
    el('scan-result').hidden = true;
    el('scan-guide').hidden = false;
    el('scanner-overlay').classList.remove('detected');
    video.hidden = false;
    el('scanner-photo').hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      status('La cámara necesita HTTPS y un navegador compatible. Puedes leer una imagen.');
      starting = false;
      return;
    }
    status('Solicitando cámara…');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
        audio: false,
      });
      if (token !== session) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = next;
      video.srcObject = stream;
      await video.play();
      if (token !== session) return;
      el('scanner-stop').hidden = false;
      el('scanner-start').hidden = true;
      el('scanner-torch').hidden = !stream.getVideoTracks()[0].getCapabilities?.().torch;
      status('Buscando QR…');
      loop(token);
    } catch (error) {
      if (token === session) {
        stop();
        status(
          error.name === 'NotAllowedError'
            ? 'Permite la cámara en tu navegador o sube una imagen.'
            : error.name === 'NotFoundError'
              ? 'No se encontró una cámara. Puedes subir una imagen.'
              : 'No se pudo iniciar la cámara. Intenta de nuevo.',
        );
      }
    } finally {
      if (token === session) starting = false;
    }
  }
  el('scanner-start').addEventListener('click', start);
  el('scanner-stop').addEventListener('click', () => {
    stop();
    status('Cámara detenida.');
  });
  el('scanner-switch').addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    if (stream) start();
    else status('Se usará la cámara ' + (facing === 'environment' ? 'trasera.' : 'frontal.'));
  });
  el('scanner-torch').addEventListener('click', async () => {
    try {
      torch = !torch;
      await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch }] });
      el('scanner-torch').textContent = torch ? 'Apagar linterna' : 'Linterna';
    } catch {
      status('Esta cámara no permite controlar la linterna.');
    }
  });
  el('scanner-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    stop();
    const token = ++session;
    found = null;
    try {
      if (file.size > 15_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Usa PNG, JPG o WebP de hasta 15 MB.');
      status('Leyendo imagen…');
      const source = await readFile(file),
        img = await loadImage(source);
      if (token !== session) return;
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = await decodeQrImage(ctx.getImageData(0, 0, canvas.width, canvas.height), {
        details: true,
      });
      if (token !== session) return;
      video.hidden = true;
      el('scanner-photo').src = source;
      el('scanner-photo').hidden = false;
      if (result) display(result, canvas.width, canvas.height);
      else {
        el('scan-result').hidden = true;
        el('scanner-overlay').classList.remove('detected');
        status('No se encontró un QR legible. Prueba una imagen más nítida.');
      }
    } catch (error) {
      if (token === session) status(error.message);
    } finally {
      event.target.value = '';
    }
  });
  el('scan-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(found.content);
      status('Contenido copiado.');
    } catch {
      status('Selecciona el texto del resultado para copiarlo.');
    }
  });
  el('scan-save').addEventListener('click', () => {
    if (found.download)
      saveFile(
        new Blob([found.content], { type: found.mime }),
        found.download,
        'morphiq-' + found.kind,
      );
  });
  el('scan-again').addEventListener('click', () => {
    found = null;
    el('scan-result').hidden = true;
    el('scanner-overlay').classList.remove('detected');
    el('scan-guide').hidden = false;
    if (!stream) start();
    else status('Buscando QR…');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop();
  });
  window.addEventListener('pagehide', stop);
  return { start, stop };
}
