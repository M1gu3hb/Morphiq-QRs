import { qrImageFile, shareQrFile, supportsImageSharing } from '../export/share.js';
import { QRCheck } from '../validation/qr-checker.js';
import { safeFilename } from '../utils/files.js';

export function initGeneratorSharing(studio) {
  const button = document.getElementById('share-qr');
  const status = document.getElementById('share-status');
  let revision = 0,
    timer,
    ready = null,
    key = '',
    pending = null;
  function snapshot() {
    if (!studio.qr) return null;
    const svg = studio.getSvg();
    return {
      svg,
      payload: studio.payload,
      size: Math.min(2048, studio.getOptions().size),
      key: svg,
    };
  }
  function state(value) {
    button.dataset.state = value;
    button.disabled =
      !studio.qr ||
      studio.busy ||
      document.getElementById('download').disabled ||
      ['preparing', 'sharing'].includes(value);
    button.textContent =
      value === 'preparing'
        ? 'Preparando imagen…'
        : value === 'sharing'
          ? 'Compartiendo…'
          : 'Compartir QR';
  }
  async function prepare(current) {
    const token = revision;
    state('preparing');
    const isCurrent = () =>
      token === revision &&
      current.key === studio.getSvg() &&
      !document.body.classList.contains('scanning');
    pending = (async () => {
      try {
        const result = await QRCheck.run(current.svg, current.payload, {
          size: current.size,
          isCurrent,
        });
        if (!result || !isCurrent()) return null;
        if (!result.passed) return { invalid: true, key: current.key };
        const file = await qrImageFile(current.svg, { size: current.size });
        return isCurrent() ? { file, key: current.key } : null;
      } catch (error) {
        return isCurrent() ? { error, key: current.key } : null;
      }
    })();
    const result = await pending;
    if (token === revision) {
      ready = result;
      pending = null;
      state('idle');
    }
    return result;
  }
  function sync() {
    const current = snapshot();
    if (!current || document.body.classList.contains('scanning')) {
      revision++;
      clearTimeout(timer);
      ready = null;
      key = '';
      pending = null;
      state('idle');
      return;
    }
    if (current.key === key) {
      if (button.dataset.state === 'idle') state('idle');
      return;
    }
    revision++;
    clearTimeout(timer);
    ready = null;
    pending = null;
    key = current.key;
    status.textContent = '';
    state('idle');
    // Browsers without native file sharing prepare only on request. On phones,
    // preflight lets the share sheet open directly from the subsequent tap.
    if (supportsImageSharing() && !studio.busy) timer = setTimeout(() => prepare(current), 500);
  }
  button.addEventListener('click', async () => {
    if (studio.busy || button.dataset.state === 'sharing') return;
    const current = snapshot();
    if (!current) return;
    clearTimeout(timer);
    let prepared = ready?.key === current.key ? ready : null;
    try {
      if (!prepared) {
        prepared = await (pending || prepare(current));
        if (!prepared || current.key !== studio.getSvg()) return;
        if (
          supportsImageSharing() &&
          !prepared.invalid &&
          !prepared.error &&
          !navigator.userActivation?.isActive
        ) {
          status.textContent = 'Imagen lista. Pulsa Compartir QR para elegir una aplicación.';
          return;
        }
      }
      if (prepared.error) throw prepared.error;
      if (prepared.invalid) {
        status.textContent = 'El diseño no pasó la comprobación. Ajusta el QR antes de compartir.';
        await studio.checkQr();
        return;
      }
      state('sharing');
      const file = new File(
        [prepared.file],
        safeFilename(document.getElementById('filename').value) + '.png',
        { type: 'image/png' },
      );
      const result = await shareQrFile(file);
      status.textContent =
        result === 'downloaded'
          ? 'PNG guardado. Este navegador no comparte archivos; puedes adjuntarlo en tu aplicación.'
          : result === 'shared'
            ? 'Imagen compartida.'
            : '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      state('idle');
    }
  });
  document.addEventListener('studio:render', sync);
  document.addEventListener('studio:view', sync);
  sync();
}
