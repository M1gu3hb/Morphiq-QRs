import { decodeQrImage } from '../validation/decoder-client.js';
import { scanResult } from './result.js';
import { rebuildQr, visibleVideoRect } from './rebuild.js';
import { loadImage, readFile } from '../image/image-loader.js';
import { qrImageFile, shareQrFile } from '../export/share.js';
import { namespaceSvg } from '../ui/svg.js';
import { saveFile } from '../utils/files.js';
import { createCameraAccess } from './camera-access.js';
import { initPermissionGuide } from './permission-guide.js';
import { cameraEnvironment, cameraProblem, requestCamera } from './camera-environment.js';

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
    timer,
    requestTimer,
    lastError = null;
  const nativeControls = [];
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
    clearTimeout(requestTimer);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    el('scanner-stop').hidden = true;
    el('scanner-start').hidden = false;
    el('scanner-start').disabled = false;
    el('scanner-start').textContent = 'Activar cámara';
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
    const environment = cameraEnvironment();
    el('camera-diagnostics').textContent = [
      `${environment.installed ? 'App instalada' : 'Página web'} · ${environment.browser}`,
      `Conexión segura: ${environment.secure ? 'sí' : 'no'}`,
      `Cámara en vivo disponible: ${environment.supported && environment.allowed ? 'sí' : 'no'}`,
      `Estado del permiso: ${access.state}`,
      ...(lastError
        ? [`Último error: ${lastError.name || 'Error'} · ${lastError.message || ''}`]
        : []),
    ].join('\n');
  }
  function hideRecovery() {
    el('camera-recovery').hidden = true;
  }
  function showRecovery(problem, error = null) {
    lastError = error;
    el('camera-recovery-title').textContent = problem.title;
    el('camera-recovery-message').textContent = problem.message;
    el('camera-recovery').hidden = false;
    el('scan-guide').hidden = true;
    updatePermission();
  }
  function permissionNeeded() {
    status('Permite la cámara para leer. Consulta «Permisos» si te la pide cada vez.');
    showRecovery(cameraProblem({ name: 'NotAllowedError' }));
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
  function enter({ userGesture = false } = {}) {
    if (active) return;
    active = true;
    wanted = access.automatic && !found;
    // A tap must reach getUserMedia in the same task. Permission queries are
    // advisory and cannot consume the user gesture on mobile browsers.
    if (wanted && userGesture && !access.blocked) {
      start({ interactive: true });
      access.refresh().then(updatePermission);
    } else if (wanted) maybeStart({ allowPrompt: true });
    else if (!found) status('Inicio automático desactivado. Usa «Activar cámara» cuando quieras.');
  }
  function leave() {
    active = false;
    wanted = false;
    stop();
    hideRecovery();
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
  function beginRequest({ native = false } = {}) {
    stop();
    clearResult();
    if (!native) hideRecovery();
    lastError = null;
    wanted = true;
    starting = true;
    const token = ++session;
    el('scanner-start').disabled = true;
    el('scanner-start').hidden = true;
    el('scanner-stop').hidden = false;
    el('scanner-stop').textContent = 'Cancelar';
    video.hidden = false;
    photo.hidden = true;
    status('Solicitando cámara…');
    requestTimer = setTimeout(() => {
      if (token !== session || !starting) return;
      el('scanner-start').hidden = false;
      el('scanner-start').disabled = false;
      el('scanner-start').textContent = 'Reintentar cámara';
      status('Esperando autorización. Si no aparece el aviso, prueba otra opción.');
      showRecovery({
        title: '¿No aparece el aviso de cámara?',
        message:
          'Puedes reintentar con un toque, usar «Permisos», abrir el lector en tu navegador o fotografiar el QR.',
      });
    }, 7000);
    return token;
  }
  async function attachStream(next, token) {
    if (token !== session) {
      next.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = next;
    video.srcObject = next;
    // Explicit properties also cover mobile engines that do not reflect the
    // boolean muted/playsinline attributes into playback state consistently.
    video.muted = true;
    video.playsInline = true;
    await video.play();
    if (token !== session) return;
    clearTimeout(requestTimer);
    access.recordSuccess();
    starting = false;
    hideRecovery();
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
  }
  function failRequest(error, token, acquired = false) {
    if (token !== session) return;
    stop();
    const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(error.name) && !acquired;
    if (denied) access.recordDenial();
    wanted = denied && access.state === 'denied';
    const problem = cameraProblem(error, { acquired });
    status(problem.message);
    showRecovery(problem, error);
  }
  async function start({ interactive = false } = {}) {
    if ((starting && !interactive) || !active || document.hidden) return;
    const token = beginRequest();
    let acquired = false;
    try {
      const environment = cameraEnvironment();
      if (!environment.secure || !environment.allowed || !environment.supported)
        throw new DOMException(
          'El navegador no ofrece acceso a la cámara en este contexto.',
          'NotSupportedError',
        );
      const next = await requestCamera(facing, () => token === session);
      acquired = token === session;
      await attachStream(next, token);
    } catch (error) {
      failRequest(error, token, acquired);
    } finally {
      if (token === session) {
        starting = false;
        el('scanner-start').disabled = false;
      }
    }
  }
  el('scanner-start').addEventListener('click', () => start({ interactive: true }));
  el('scanner-stop').addEventListener('click', () => {
    wanted = false;
    stop();
    hideRecovery();
    status('Cámara detenida.');
  });
  el('scanner-switch').addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    nativeControls.forEach((control) =>
      control.setConstraints({ video: { facingMode: { ideal: facing } }, audio: false }),
    );
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
  async function readQrPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    wanted = false;
    stop();
    hideRecovery();
    clearResult();
    photo.hidden = true;
    const token = ++session;
    try {
      if (
        file.size > 15_000_000 ||
        !(file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name))
      )
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
  }
  el('scanner-file').addEventListener('change', readQrPhoto);
  el('scanner-capture-file').addEventListener('change', readQrPhoto);
  function capturePhoto() {
    wanted = false;
    stop();
    permissionDialog.close();
    el('scanner-capture-file').click();
  }
  el('scanner-capture').addEventListener('click', capturePhoto);
  el('camera-guide-capture').addEventListener('click', capturePhoto);
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
  el('scan-again').addEventListener('click', () => start({ interactive: true }));
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
    start({ interactive: true });
  });
  // Browsers with native capability controls can reopen a previously blocked
  // permission directly. Older engines keep the ordinary button and photo path.
  if ('HTMLUserMediaElement' in window) {
    for (const id of ['camera-native-recovery', 'camera-native-guide']) {
      const control = document.createElement('usermedia');
      if (typeof control.setConstraints !== 'function') continue;
      try {
        control.setConstraints({ video: { facingMode: { ideal: facing } }, audio: false });
      } catch {
        continue;
      }
      control.className = 'camera-native-control';
      control.lang = 'es';
      let token = null;
      control.addEventListener('click', (event) => {
        if (!active || document.hidden || (starting && token === session)) {
          event.preventDefault();
          return;
        }
        token = beginRequest({ native: true });
      });
      control.addEventListener('stream', async () => {
        const next = control.stream;
        if (!next) return;
        if (token !== session || !active || document.hidden) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        permissionDialog.close();
        try {
          await attachStream(next, token);
        } catch (error) {
          failRequest(error, token, true);
        }
      });
      control.addEventListener('error', () =>
        failRequest(
          control.error || new DOMException('Acceso bloqueado.', 'NotAllowedError'),
          token,
        ),
      );
      control.addEventListener('cancel', () => {
        if (token !== session) return;
        stop();
        wanted = false;
        status('Solicitud cancelada. Puedes activar la cámara o fotografiar el QR.');
      });
      el(id).append(control);
      el(id).hidden = false;
      nativeControls.push(control);
    }
  }
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
