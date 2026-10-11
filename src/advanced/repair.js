import { encodePayload } from '../qr/encoder.js';
import { renderQrSvg } from '../qr/renderer.js';
import { QRCheck } from '../validation/qr-checker.js';
import { namespaceSvg } from '../ui/svg.js';

// Undo only the properties changed by a repair; keep later content and manual edits.
export function repairChanges(before, after) {
  const changes = [];
  for (const section of ['fields', 'styles'])
    for (const key of Object.keys(after[section]))
      if (!Object.is(before[section][key], after[section][key]))
        changes.push({ section, key, before: before[section][key], after: after[section][key] });
  if (before.ecc !== after.ecc) changes.push({ key: 'ecc', before: before.ecc, after: after.ecc });
  return changes;
}
export function undoRepair(state, changes) {
  const restored = structuredClone(state);
  for (const change of changes) {
    const target = change.section ? restored[change.section] : restored;
    if (Object.is(target[change.key], change.after)) target[change.key] = change.before;
  }
  return restored;
}
export function initRepair(studio) {
  const el = (id) => document.getElementById(id),
    history = [];
  let revision = 0,
    active = null;
  const panel = el('repair-result'),
    content = el('repair-content');
  function dismiss() {
    revision++;
    active = null;
    panel.hidden = true;
    content.replaceChildren();
    el('repair-qr').disabled = false;
  }
  el('repair-close').addEventListener('click', dismiss);
  el('repair-undo').addEventListener('click', () => {
    const changes = history.pop();
    if (!changes) return;
    studio.applyState(undoRepair(studio.getState(), changes));
    el('repair-undo-row').hidden = !history.length;
    studio.showToast('Reparación deshecha.');
  });
  document.addEventListener('studio:render', dismiss);
  el('repair-qr').addEventListener('click', async () => {
    if (!studio.qr || studio.busy) return;
    const token = ++revision,
      payload = studio.payload,
      base = structuredClone(studio.getOptions()),
      state = structuredClone(studio.getState());
    active = token;
    panel.hidden = false;
    content.textContent = 'Buscando una variante legible…';
    el('repair-qr').disabled = true;
    try {
      for (let i = 0; i < 3; i++) {
        const options = {
          ...base,
          margin: Math.max(4, base.margin),
          foreground: '#000000',
          eyes: '#000000',
          background: '#ffffff',
          gradient: { mode: 'none' },
          imageBackground: '#ffffff',
          imageModules: Math.min(base.imageModules || 7, i === 0 ? 6 : 4),
          blend: 'weave',
        };
        if (i >= 1)
          Object.assign(options, { module: 'extra-rounded', eye: 'rounded', center: 'rounded' });
        if (i === 2)
          Object.assign(options, {
            silhouette: null,
            imageMode: 'center',
            border: { ...base.border, enabled: false },
          });
        const qr = encodePayload(payload, {
            ecc: 'H',
            hasImage: !!options.image,
            imageModules: options.imageMode === 'center' ? options.imageModules : 0,
          }),
          svg = renderQrSvg(qr, options),
          result = await QRCheck.run(svg, payload, {
            isCurrent: () => token === revision,
            onStep: (index, phase) => {
              if (token === revision)
                content.textContent = `Variante ${i + 1} · prueba ${index + 1} / 4 · ${phase === 'running' ? 'leyendo' : 'revisada'}`;
            },
          });
        if (token !== revision) return;
        if (!result?.passed) continue;
        const candidate = structuredClone(state);
        Object.assign(candidate.fields, {
          margin: String(options.margin),
          foreground: '#000000',
          'eye-color': '#000000',
          background: '#ffffff',
          'gradient-mode': 'none',
          'logo-size': String(options.imageModules),
          'logo-base-auto': true,
        });
        candidate.ecc = 'H';
        Object.assign(candidate.styles, {
          blend: 'weave',
          module: options.module,
          eye: options.eye,
          center: options.center,
        });
        if (i === 2)
          Object.assign(candidate.fields, {
            'silhouette-enabled': false,
            'border-enabled': false,
            'image-mode': 'center',
          });
        content.innerHTML = `<span class="eyebrow">4 DE 4 LECTURAS</span><div class="variant-qr">${namespaceSvg(svg, 'repair')}</div><p class="small-note">Margen amplio, tinta negra, resistencia alta${options.image ? ' y menor área de imagen' : ''}${i >= 1 ? ', formas conectadas' : ''}${i === 2 ? ' y silueta/marco desactivados' : ''}.</p><button id="repair-apply" type="button" class="tool-button">Aplicar esta sugerencia</button>`;
        el('repair-apply').addEventListener('click', () => {
          if (token !== revision) return;
          studio.applyState(candidate);
          const changes = repairChanges(state, studio.getState());
          if (changes.length) history.push(changes);
          if (history.length > 10) history.shift();
          el('repair-undo-row').hidden = !history.length;
        });
        return;
      }
      content.textContent =
        'No se encontró una variante que supere las cuatro lecturas. Reduce la imagen, usa un contenido más corto o aumenta el margen.';
    } catch (error) {
      if (token === revision) content.textContent = error.message;
    } finally {
      if (active === token) {
        active = null;
        el('repair-qr').disabled = false;
      }
    }
  });
}
