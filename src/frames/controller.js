import { FRAMES, getFrame } from './catalog.js';
import { frameSvg } from './renderer.js';
import { encodePayload } from '../qr/encoder.js';
import { renderQrSvg } from '../qr/renderer.js';
import { namespaceSvg } from '../ui/svg.js';

export function initFrames(studio) {
  const el = (id) => document.getElementById(id);
  let ready = false,
    group = 'Todos';
  const colors = ['border-color', 'border-text-color', 'border-accent-color'];
  function filter() {
    el('border-options')
      .querySelectorAll('[data-border]')
      .forEach((button) => {
        const frame = getFrame(button.dataset.border);
        button.hidden = group !== 'Todos' && frame.group !== group;
      });
    el('border-filter')
      .querySelectorAll('button')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.textContent === group)),
      );
  }
  function gallery() {
    if (ready) return;
    const base = renderQrSvg(encodePayload('https://morphiq.com.mx'), { size: 128, margin: 4 });
    el('border-filter').innerHTML = ['Todos', ...new Set(FRAMES.map((f) => f.group))]
      .map((name) => `<button type="button" class="mini-action">${name}</button>`)
      .join('');
    el('border-options').innerHTML = FRAMES.map((f) => {
      const svg = frameSvg(base, {
        size: 128,
        background: '#fff',
        border: {
          enabled: true,
          type: f.id,
          text: f.example[0],
          textSecondary: f.example[1],
          textFooter: f.example[2],
          color: '#101820',
          textColor: '#ffffff',
          gradient: f.id === 'wave-gradient',
          accentColor: '#1680ff',
        },
      });
      return `<button type="button" class="frame-option" data-border="${f.id}"><span>${namespaceSvg(svg, 'frame-' + f.id)}</span><b>${f.name}</b></button>`;
    }).join('');
    ready = true;
    sync();
    filter();
  }
  // Populate before the accordion measures its opening animation.
  el('border-gallery').querySelector('summary').addEventListener('click', gallery, true);
  el('border-gallery').addEventListener('toggle', () => {
    if (el('border-gallery').open) gallery();
  });
  el('border-filter').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    group = button.textContent;
    filter();
  });
  el('border-options').addEventListener('click', (event) => {
    const button = event.target.closest('[data-border]');
    if (!button || studio.busy) return;
    const before = getFrame(el('border-type').value),
      after = getFrame(button.dataset.border);
    ['border-text', 'border-text-secondary', 'border-text-footer'].forEach((id, i) => {
      if (el(id).value === before.example[i] || (i === 0 && el(id).value === 'Escanéame'))
        el(id).value = after.example[i] || '';
    });
    el('border-type').value = after.id;
    studio.render();
    el('border-gallery').open = false;
  });
  function sync() {
    const frame = getFrame(el('border-type').value);
    el('border-count').textContent = FRAMES.length + ' marcos';
    el('border-name').textContent = frame.name;
    el('border-controls').hidden = !el('border-enabled').checked;
    el('border-secondary-field').hidden = frame.texts < 2;
    el('border-footer-field').hidden = frame.texts < 3;
    el('border-gradient-controls').hidden = !el('border-gradient').checked;
    ['border-text', 'border-text-secondary', 'border-text-footer'].forEach((id, i) => {
      el(id + '-label').textContent = frame.labels[i];
    });
    for (const id of colors) {
      el(id + '-hex').textContent = el(id).value.toUpperCase();
      document.querySelector(`[data-picker="${id}"]`).style.setProperty('--picked', el(id).value);
    }
    el('border-options')
      .querySelectorAll('[data-border]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.border === frame.id)));
  }
  const fields = [
    'border-enabled',
    'border-text',
    'border-text-secondary',
    'border-text-footer',
    'border-font',
    'border-gradient',
    ...colors,
  ];
  for (const id of fields) {
    el(id).addEventListener('input', () => studio.render());
    if (['checkbox', 'select-one'].includes(el(id).type))
      el(id).addEventListener('change', () => studio.render());
  }
  document.addEventListener('studio:render', sync);
  sync();
}
