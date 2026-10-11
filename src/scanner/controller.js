import { decodeQrImage } from '../validation/decoder-client.js';
import { scanResult } from './result.js';
import { rebuildQr, visibleVideoRect } from './rebuild.js';
import { loadImage, readFile } from '../image/image-loader.js';
import { qrImageFile, shareQrFile } from '../export/share.js';
import { namespaceSvg } from '../ui/svg.js';
import { saveFile } from '../utils/files.js';
import { createCameraAccess } from './camera-access.js';
import { initPermissionGuide } from './permission-guide.js';

export function createScanner() {
  const el = (id) => document.getElementById(id),
    video = el('scanner-video'),
    photo = el('scanner-photo'),
    canvas = document.createElement('canvas');
  let stream = null,
    session = 0,
    resultRevision = 0,
    facing = 'environment',
    found = null,
    imageFile = null,
    torch = false,
    starting = false,
    active = false,
    wanted = false,
    timer;
  const permissionDialog = el('camera-permissions'),
    access = createCameraAccess((state) => {
      updatePermission();
      if (state === 'denied') {
        const wasActive = stream || starting;
        stop();
        if (active && !found && wasActive) permissionNeeded();
      } else if (state === 'granted') maybeStart();
    });
  const status = (text) => {
    el('scanner-status').textContent = text;
    el('scan-result-status').textContent = found ? text : '';
  };
  function stop() {
    session++;
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    el('scanner-stop').hidden = true;
    el('scanner-start').hidden = false;
    el('scanner-start').disabled = false;
    el('scanner-torch').hidden = true;
    el('scanner-torch').textContent = 'Linterna';
    el('scanner-torch').setAttribute('aria-pressed', 'false');
    torch = false;
    starting = false;
  }
  function updatePermission() {
    el('camera-auto-start').checked = access.automatic;
    el('scanner-permissions').dataset.state = access.state;
    el('camera-permission-state').textContent =
      access.state === 'granted'
        ? 'Permiso de cámara concedido.'
        : access.state === 'denied'
          ? 'La cámara está bloqueada. Cambia el permiso en los ajustes.'
          : access.state === 'prompt'
            ? 'El navegador necesita tu permiso para usar la cámara.'
            : 'Tu navegador gestiona el permiso al abrir la cámara.';
  }
  function permissionNeeded() {
    status('Permite la cámara para leer. Consulta «Permisos» si te la pide cada vez.');
  }
  async function maybeStart({ allowPrompt = false } = {}) {
    if (
      !active ||
      !wanted ||
      found ||
      stream ||
      starting ||
      permissionDialog.open ||
      document.hidden
    )
      return;
    const token = session,
      state = await access.refresh();
    updatePermission();
    if (
      token !== session ||
      !active ||
      !wanted ||
      found ||
      stream ||
      starting ||
      permissionDialog.open ||
      document.hidden
    )
      return;
    if (
      state === 'granted' ||
      (state === 'unknown' && access.used && !access.blocked) ||
      (allowPrompt && state !== 'denied' && !access.blocked)
    )
      start();
    else permissionNeeded();
  }
  function enter() {
    if (active) return;
    active = true;
    wanted = access.automatic && !found;
    if (wanted) maybeStart({ allowPrompt: true });
    else if (!found) status('Inicio automático desactivado. Usa «Activar cámara» cuando quieras.');
  }
  function leave() {
    active = false;
    wanted = false;
    stop();
    permissionDialog.close();
  }
  function clearResult() {
    resultRevision++;
    found = null;
    imageFile = null;
    el('scan-result').hidden = true;
    el('scanner-view').classList.remove('has-result');
    el('scan-guide').hidden = false;
    el('scan-rebuilt').replaceChildren();
    el('scan-open').removeAttribute('href');
    el('scanner-overlay').classList.remove('detected');
    el('scanner-polygon').setAttribute('points', '');
    el('scan-share').disabled = true;
    el('scan-share').textContent = 'Compartir QR';
  }
  function display(result, width, height) {
    const token = ++resultRevision;
    found = scanResult(result.data);
    el('scan-kind').textContent = found.kind;
    el('scan-content').textContent = found.content;
    el('scan-copy').textContent = found.kind === 'Enlace' ? 'Copiar enlace' : 'Copiar información';
    el('scan-result').hidden = false;
    el('scanner-view').classList.add('has-result');
    el('scan-open').hidden = !found.href;
    if (found.href) {
      el('scan-open').href = found.href;
      el('scan-open').textContent = found.action;
    } else el('scan-open').removeAttribute('href');
    el('scan-save').hidden = !found.download;
    el('scan-save').textContent = found.kind === 'Contacto' ? 'Guardar contacto' : 'Guardar evento';
    el('scan-guide').hidden = true;
    el('scanner-overlay').setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (result.location) {
      const l = result.location;
      el('scanner-polygon').setAttribute(
        'points',
        [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner]
          .map((p) => `${p.x},${p.y}`)
          .join(' '),
      );
    }
    requestAnimationFrame(() => {
      if (token === resultRevision) el('scanner-overlay').classList.add('detected');
    });
    status('QR reconocido. Elige qué hacer.');
    el('scan-kind').focus({ preventScroll: true });
    try {
      const rebuilt = rebuildQr(found.payload);
      el('scan-rebuilt').innerHTML = namespaceSvg(rebuilt.svg, 'scanned');
      el('scan-share').textContent = 'Preparando imagen…';
      qrImageFile(rebuilt.svg, { size: rebuilt.size, name: 'morphiq-qr-escaneado' })
        .then((file) => {
          if (token !== resultRevision) return;
          imageFile = file;
          el('scan-share').textContent = 'Compartir QR';
          el('scan-share').disabled = false;
        })
        .catch(() => {
          if (token === resultRevision) {
            el('scan-share').textContent = 'Compartir QR';
            status('Contenido leído. No se pudo preparar la imagen para compartir.');
          }
        });
    } catch {
      status('Contenido leído. No se pudo reconstruir este QR. Puedes copiar su información.');
    }
  }
  async function loop(token) {
    if (token !== session || !stream) return;
    try {
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const stage = el('camera-stage').getBoundingClientRect();
        const crop = visibleVideoRect(
          video.videoWidth,
          video.videoHeight,
          stage.width,
          stage.height,
        );
        const scale = Math.min(1, 1280 / Math.max(crop.width, crop.height));
        canvas.width = Math.max(1, Math.round(crop.width * scale));
        canvas.height = Math.max(1, Math.round(crop.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(
          video,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const result = await decodeQrImage(ctx.getImageData(0, 0, canvas.width, canvas.height), {
          details: true,
        });
        if (token !== session) return;
        if (result) {
          photo.src = canvas.toDataURL('image/jpeg', 0.9);
          photo.hidden = false;
          video.hidden = true;
          wanted = false;
          stop();
          display(result, canvas.width, canvas.height);
          return;
        }
      }
    } catch (error) {
      if (token === session) status(error.message || 'No se pudo leer este cuadro.');
    }
    if (token === session && stream) timer = setTimeout(() => loop(token), 140);
  }
  async function start() {
    if (starting || !active || document.hidden) return;
    stop();
    clearResult();
    wanted = true;
    starting = true;
    const token = ++session;
    el('scanner-start').disabled = true;
    el('scanner-start').hidden = true;
    el('scanner-stop').hidden = false;
    el('scanner-stop').textContent = 'Cancelar';
    video.hidden = false;
    photo.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      wanted = false;
      status('La cámara necesita HTTPS y un navegador compatible. Puedes leer una imagen.');
      stop();
      return;
    }
    status('Solicitando cámara…');
    let acquired = false;
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 } },
        audio: false,
      });
      if (token !== session) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = next;
      acquired = true;
      video.srcObject = next;
      await video.play();
      if (token !== session) return;
      access.recordSuccess();
      updatePermission();
      el('scanner-stop').hidden = false;
      el('scanner-stop').textContent = 'Detener';
      el('scanner-start').hidden = true;
      el('scanner-torch').hidden = !next.getVideoTracks()[0]?.getCapabilities?.().torch;
      next.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (token !== session) return;
        wanted = false;
        stop();
        status('La cámara se desconectó. Puedes volver a activarla o leer una imagen.');
      });
      status('Buscando QR…');
      loop(token);
    } catch (error) {
      if (token === session) {
        stop();
        if (error.name === 'NotAllowedError' && !acquired) access.recordDenial();
        else wanted = false;
        status(
          error.name === 'NotAllowedError'
            ? acquired
              ? 'La cámara necesita un toque para iniciar. Pulsa «Activar cámara».'
              : 'Permite la cámara en tu navegador. Consulta «Permisos» o lee una imagen.'
            : error.name === 'NotFoundError'
              ? 'No se encontró una cámara. Puedes subir una imagen.'
              : error.name === 'NotReadableError'
                ? 'La cámara está ocupada o no está disponible. Cierra la otra app e intenta de nuevo.'
                : 'No se pudo iniciar la cámara. Intenta de nuevo.',
        );
      }
    } finally {
      if (token === session) {
        starting = false;
        el('scanner-start').disabled = false;
      }
    }
  }
  el('scanner-start').addEventListener('click', start);
  el('scanner-stop').addEventListener('click', () => {
    wanted = false;
    stop();
    status('Cámara detenida.');
  });
  el('scanner-switch').addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    if (stream) start();
    else status('Se usará la cámara ' + (facing === 'environment' ? 'trasera.' : 'frontal.'));
  });
  el('scanner-torch').addEventListener('click', async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const token = session,
      nextTorch = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
      if (token !== session) return;
      torch = nextTorch;
      el('scanner-torch').textContent = torch ? 'Apagar linterna' : 'Linterna';
      el('scanner-torch').setAttribute('aria-pressed', String(torch));
    } catch {
      if (token === session) status('Esta cámara no permite controlar la linterna.');
    }
  });
  el('scanner-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    wanted = false;
    stop();
    clearResult();
    photo.hidden = true;
    const token = ++session;
    try {
      if (file.size > 15_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Usa PNG, JPG o WebP de hasta 15 MB.');
      status('Leyendo imagen…');
      const source = await readFile(file),
        img = await loadImage(source);
      if (token !== session) return;
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const result = await decodeQrImage(ctx.getImageData(0, 0, canvas.width, canvas.height), {
        details: true,
      });
      if (token !== session) return;
      video.hidden = true;
      photo.src = source;
      photo.hidden = false;
      if (result) display(result, canvas.width, canvas.height);
      else status('No se encontró un QR legible. Prueba una imagen más nítida.');
    } catch (error) {
      if (token === session) status(error.message);
    } finally {
      event.target.value = '';
    }
  });
  el('scan-copy').addEventListener('click', async () => {
    if (!found) return;
    try {
      await navigator.clipboard.writeText(found.content);
      status(found.kind === 'Enlace' ? 'Enlace copiado.' : 'Información copiada.');
    } catch {
      status('Selecciona el texto del resultado para copiarlo.');
    }
  });
  el('scan-share').addEventListener('click', async () => {
    if (!imageFile) return;
    const token = resultRevision;
    el('scan-share').disabled = true;
    try {
      const result = await shareQrFile(imageFile);
      if (token !== resultRevision) return;
      status(
        result === 'downloaded'
          ? 'PNG guardado. Puedes adjuntarlo en tu aplicación.'
          : result === 'shared'
            ? 'Imagen compartida.'
            : 'QR reconocido. Elige qué hacer.',
      );
    } catch (error) {
      if (token === resultRevision) status(error.message);
    } finally {
      if (token === resultRevision) el('scan-share').disabled = false;
    }
  });
  el('scan-save').addEventListener('click', () => {
    if (found?.download)
      saveFile(
        new Blob([found.payload], { type: found.mime }),
        found.download,
        'morphiq-' + found.kind,
      );
  });
  el('scan-again').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const wasActive = stream || starting;
      stop();
      if (wasActive && !found) status('Cámara pausada mientras la app está en segundo plano.');
    } else maybeStart();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => maybeStart());
  el('scanner-permissions').addEventListener('click', () => {
    const wasActive = stream || starting;
    stop();
    if (wasActive && !found) status('Cámara pausada mientras revisas los permisos.');
    updatePermission();
    permissionDialog.showModal();
    access.refresh().then(updatePermission);
  });
  el('camera-permissions-close').addEventListener('click', () => permissionDialog.close());
  permissionDialog.addEventListener('close', () => maybeStart());
  el('camera-permissions-try').addEventListener('click', () => {
    permissionDialog.close();
    start();
  });
  el('camera-auto-start').addEventListener('change', (event) => {
    access.setAutomatic(event.target.checked);
    wanted = event.target.checked && !found;
    if (!wanted) {
      stop();
      if (!found) status('Inicio automático desactivado. Usa «Activar cámara» cuando quieras.');
    }
  });
  initPermissionGuide(el);
  updatePermission();
  return { start, stop, enter, leave };
}
