import { projectStore } from '../projects/storage.js';
export function initPwa(studio, projects = null) {
  const button = document.getElementById('install-app');
  let prompt = null,
    waiting = null;
  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    if (!standalone()) {
      button.hidden = false;
      button.textContent = 'Instalar app';
    }
  });
  window.addEventListener('appinstalled', () => {
    prompt = null;
    button.hidden = true;
    studio.showToast('Morphiq QR instalado.');
  });
  button.addEventListener('click', async () => {
    if (waiting) {
      try {
        if (projects) await (await projects).flushDraft();
        else
          await projectStore.save({
            id: 'autosave',
            name: 'Borrador',
            updated: Date.now(),
            state: studio.getState(),
          });
      } catch (error) {
        studio.showToast(error.message);
        return;
      }
      waiting.postMessage('SKIP_WAITING');
      return;
    }
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      prompt = null;
      button.hidden = true;
    } else studio.showToast('En Safari: Compartir → Agregar a pantalla de inicio.');
  });
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone()) {
    button.hidden = false;
    button.textContent = 'Instalar app';
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        const update = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            waiting = registration.waiting;
            button.hidden = false;
            button.textContent = 'Actualizar app';
          }
        };
        update();
        registration.addEventListener('updatefound', () =>
          registration.installing?.addEventListener('statechange', update),
        );
      })
      .catch(() => studio.showToast('No se pudo preparar el modo sin conexión.'));
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (waiting && !reloading) {
        reloading = true;
        location.reload();
      }
    });
  }
}
