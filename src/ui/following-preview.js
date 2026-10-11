import { namespaceSvg } from './svg.js';

export function initFollowingPreview(studio) {
  const view = document.getElementById('studio-view'),
    stage = document.querySelector('.qr-stage'),
    dock = document.createElement('aside'),
    dialog = document.createElement('dialog');
  dock.className = 'following-preview';
  dock.hidden = true;
  dock.setAttribute('aria-label', 'Vista previa flotante del QR');
  dock.innerHTML =
    '<button type="button" id="follow-toggle" class="follow-toggle" aria-expanded="true">QR <span aria-hidden="true">−</span></button><button type="button" id="follow-expand" class="follow-expand" aria-label="Ampliar vista previa del QR"><span id="follow-qr"></span></button>';
  dialog.className = 'preview-dialog';
  dialog.id = 'preview-dialog';
  dialog.setAttribute('aria-label', 'Vista previa ampliada');
  dialog.innerHTML =
    '<div class="result-heading"><span>Vista previa</span><button type="button" id="follow-close" class="mini-action">Cerrar</button></div><div id="follow-large"></div>';
  document.body.append(dock, dialog);
  let visible = true,
    minimized = false;
  const svg = (prefix) => (studio.qr ? namespaceSvg(studio.getSvg(), prefix) : '');
  function update() {
    dock.hidden = visible || view.hidden || !studio.qr;
    if (!dock.hidden && !minimized) document.getElementById('follow-qr').innerHTML = svg('follow');
    if (dialog.open) document.getElementById('follow-large').innerHTML = svg('follow-large');
    if (view.hidden && dialog.open) dialog.close();
  }
  new IntersectionObserver(
    (entries) => {
      visible = entries[0].intersectionRatio > 0.2;
      update();
    },
    { threshold: [0, 0.2, 1] },
  ).observe(stage);
  new MutationObserver(update).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  document.getElementById('follow-toggle').addEventListener('click', () => {
    minimized = !minimized;
    dock.classList.toggle('minimized', minimized);
    const toggle = document.getElementById('follow-toggle');
    toggle.setAttribute('aria-expanded', String(!minimized));
    toggle.innerHTML = minimized
      ? 'Mostrar QR <span aria-hidden="true">+</span>'
      : 'QR <span aria-hidden="true">−</span>';
    document.getElementById('follow-expand').hidden = minimized;
    update();
  });
  document.getElementById('follow-expand').addEventListener('click', () => {
    document.getElementById('follow-large').innerHTML = svg('follow-large');
    dialog.showModal();
  });
  document.getElementById('follow-close').addEventListener('click', () => dialog.close());
  document.addEventListener('studio:render', update);
  update();
}
